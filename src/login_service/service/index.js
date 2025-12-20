const fastify = require('fastify')({
  logger: false
});

const sqlite3 = require('sqlite3');
const crypto = require('crypto');
const fastifyCookie = require('@fastify/cookie');
const { hashPassword } = require('./hash.js');
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { validateAuthRequest } = require('./security.js');
const base32 = require("thirty-two");

const DB_PATH = '/app/data/database.db';

fastify.register(fastifyCookie, {
  secret: "super_secret_key_32_chars",
});

/**
 * Helper: open DB
 */
function openDb() {
  return new sqlite3.Database(DB_PATH);
}

/**
 * Helper: respond with JSON error
 */
function sendError(reply, statusCode, message) {
  return reply.code(statusCode).send({ status: 'error', error: message });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // this.lastID verfügbar
    });
  });
}

/**
 * Create account
 * Body: { email, password }
 */
fastify.post('/createAccount', async (request, reply) => {
  // Validate and sanitize input
  const validation = validateAuthRequest(request.body);
  
  if (!validation.isValid) {
    return sendError(reply, 400, validation.errors.join(', '));
  }

  const { email, password } = validation.sanitizedData;
  const db = openDb();
  const hashed = hashPassword(password);
  const secret = speakeasy.generateSecret({
    length: 20, // 160 Bit (Standard)
    name: "Pong",        // App-Name
    issuer: "PongHUB"       // Optional, aber empfohlen
  });

    try {
    const result = await runAsync(
      db,
      `INSERT INTO users (email, password, secret) VALUES (?, ?, ?)`,
      [email, hashed, secret.base32] // ❗ Base32 speichern, NICHT das ganze Objekt
    );

    const otpAuthUrl = secret.otpauth_url;
    const qr = await qrcode.toDataURL(otpAuthUrl);

    return reply.send({
      status: 'ok',
      userId: result.lastID,
      email,
      qr,
      otpAuthUrl
    });

  } catch (err) {
    console.error('DB insert error:', err);

    if (err.code === 'SQLITE_CONSTRAINT') {
      return sendError(reply, 409, 'Email already exists');
    }

    return sendError(reply, 500, 'Database error');
  } finally {
    db.close();
  }
});

/**
 * Login and set session cookie
 * Body: { email, password }
 */

function getBinaryString(time_counter)
{
  let binary_string = "";
  while (time_counter > 0)
  {
    binary_part = (time_counter % 2);
    asciiString = binary_part.toString();
    time_counter = Math.floor(time_counter / 2);
    binary_string = asciiString + binary_string;
  }
  return binary_string;
}

function getTimeBytes(counter) {
  const buffer = Buffer.alloc(8);       // 8 Bytes = 64 Bit
  buffer.writeUInt32BE(0, 0);           // obere 4 Bytes = 0
  buffer.writeUInt32BE(counter, 4);     // untere 4 Bytes = counter
  return buffer;
}

function generateTOTP(secret, time)  {
  let time_counter = Math.floor(time / 30);
  console.log("time_counter:" + time_counter);
  let timeBytes = getTimeBytes(time_counter);
  console.log("time_bytes:" + timeBytes);
  let key = base32.decode(secret);
  const hmac = crypto
    .createHmac("sha1", key)
    .update(timeBytes)
    .digest();
    //offset ist 0 - 15 because of the masking
  const offset = hmac[hmac.length - 1] & 0x0f;
  const hashPart = hmac.slice(offset, offset + 4);
  let value = hashPart.readUInt32BE(0);
 // removes sign
  value = value & 0x7fffffff;
  let nrDigits = 6;
  const code = value % (Math.pow(10, nrDigits));
  return code.toString().padStart(nrDigits, "0");
}

function verifyTOTP(secret, otp, window = 1, period = 30) {
  const currentTime = Math.floor(Date.now() / 1000);

  for (let i = -window; i <= window; i++) {
    const testTime = currentTime + i * period;
    const generatedOtp = generateTOTP(secret, testTime);
    console.log(generatedOtp);
    console.log(otp);
    if (generatedOtp === otp) {
      return true;
    }
  }
  return false;
}

fastify.post('/loginAccount', (request, reply) => {
  // Validate and sanitize input  
  const validation = validateAuthRequest(request.body);
  
  if (!validation.isValid) {
    return sendError(reply, 400, validation.errors.join(', '));
  }
  console.log(request.body);
  const { email, password } = validation.sanitizedData;
  const otp = request.body.otp;
  const db = openDb();
  const hashed = hashPassword(password);

  // First check if email exists
  db.get(

    `SELECT id, email, secret FROM users WHERE email = ? AND password = ?`,
    [email, hashed],
    (err, row) => {
      if (err) {
        console.error('DB select error:', err);
        db.close();
        return sendError(reply, 500, 'Database error');
      }

      // Email doesn't exist
      if (!userRow) {
        db.close();
        return sendError(reply, 401, 'Email is not registered');
      }
      const secret = row.secret;
      if(!verifyTOTP(secret, otp))
      {
        return sendError(reply, 401, 'Invalid OTP');
      }
      const sessionCookie = crypto.randomBytes(32).toString('hex');

          // Password is wrong
          if (!row) {
            db.close();
            return sendError(reply, 401, 'Incorrect password');
          }

          const sessionCookie = crypto.randomBytes(32).toString('hex');

          db.run(
            `UPDATE users SET session_cookie = ?, is_active = 1, last_login = CURRENT_TIMESTAMP WHERE id = ?`,
            [sessionCookie, row.id],
            (err2) => {
              db.close();
              if (err2) {
                console.error('Error updating session cookie:', err2);
                return sendError(reply, 500, 'Failed to update session');
              }

              reply.setCookie('session', sessionCookie, {
                httpOnly: true,
                secure: false, // set true if https
                sameSite: 'strict',
                path: '/',
                maxAge: 60 * 60 * 24,
              });

              return reply.send({
                status: 'ok',
                email: row.email,
                userId: row.id,
              });
            }
          );
        }
      );
    }
  );
});

/**
 * Logout: invalidate session
 */
fastify.post('/logout', (request, reply) => {
  const sessionCookie = request.cookies.session;
  const db = openDb();

  if (!sessionCookie) {
    db.close();
    reply.clearCookie('session', { path: '/' });
    return reply.send({ status: 'ok' });
  }

  db.run(
    `UPDATE users SET session_cookie = NULL, is_active = 0 WHERE session_cookie = ?`,
    [sessionCookie],
    (err) => {
      db.close();
      if (err) {
        console.error('Error clearing session cookie:', err);
      }

      reply.clearCookie('session', { path: '/' });
      return reply.send({ status: 'ok' });
    }
  );
});

/**
 * /auth/me — get current user from cookie
 * Returns: { id, email }
 */
fastify.post('/auth/me', (request, reply) => {
  const sessionCookie = request.cookies.session;

  if (!sessionCookie) {
    return sendError(reply, 401, 'No session cookie');
  }

  const db = openDb();
  db.get(
    `SELECT id, email, nickname, avatar, is_active FROM users WHERE session_cookie = ?`,
    [sessionCookie],
    (err, row) => {
      db.close();
      if (err) {
        console.error('DB error in auth/me:', err);
        return sendError(reply, 500, 'Database error');
      }
      if (!row) {
        return sendError(reply, 401, 'Invalid session');
      }
      return reply.send({ 
        id: row.id, 
        email: row.email,
        nickname: row.nickname,
        avatar: row.avatar,
        is_active: row.is_active
      });
    }
  );
});

/**
 * /verifyCredentials — check email+password WITHOUT setting cookie
 * Used for Player 2 in 1v1
 * Body: { email, password }
 * Returns: { status:"ok", id, email } or error
 */
fastify.post('/verifyCredentials', (request, reply) => {
  const { email, password } = request.body || {};

  if (!email || !password) {
    return sendError(reply, 400, 'Email and password are required');
  }

  const db = openDb();
  const hashed = hashPassword(password);

  db.get(
    `SELECT id, email FROM users WHERE email = ? AND password = ?`,
    [email, hashed],
    (err, row) => {
      db.close();
      if (err) {
        console.error('DB error in verifyCredentials:', err);
        return sendError(reply, 500, 'Database error');
      }
      if (!row) {
        return sendError(reply, 401, 'Invalid email or password for Player 2');
      }
      return reply.send({ status: 'ok', id: row.id, email: row.email });
    }
  );
});

/**
 * Update user profile
 * Body: { nickname?, avatar? }
 * Requires authentication via session cookie
 */
fastify.post('/user/update', (request, reply) => {
  const sessionCookie = request.cookies.session;
  
  if (!sessionCookie) {
    return sendError(reply, 401, 'Authentication required');
  }

  const { nickname, avatar } = request.body || {};
  
  if (!nickname && !avatar) {
    return sendError(reply, 400, 'Nickname or avatar required');
  }

  const db = openDb();
  
  // First verify session
  db.get(
    `SELECT id FROM users WHERE session_cookie = ?`,
    [sessionCookie],
    (err, user) => {
      if (err || !user) {
        db.close();
        return sendError(reply, 401, 'Invalid session');
      }

      // Build dynamic update query
      const updates = [];
      const values = [];
      
      if (nickname) {
        updates.push('nickname = ?');
        values.push(nickname);
      }
      if (avatar) {
        updates.push('avatar = ?');
        values.push(avatar);
      }
      
      values.push(user.id);
      
      db.run(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          db.close();
          if (err) {
            console.error('Error updating profile:', err);
            return sendError(reply, 500, 'Failed to update profile');
          }
          return reply.send({ status: 'ok', updated: this.changes });
        }
      );
    }
  );
});

/**
 * Get user profile by ID
 * Query: ?userId=123
 */
fastify.get('/user/profile', (request, reply) => {
  const userId = request.query.userId;
  
  if (!userId) {
    return sendError(reply, 400, 'userId required');
  }

  const db = openDb();
  db.get(
    `SELECT id, email, nickname, avatar, is_active, last_login FROM users WHERE id = ?`,
    [userId],
    (err, row) => {
      db.close();
      if (err) {
        console.error('DB error in user/profile:', err);
        return sendError(reply, 500, 'Database error');
      }
      if (!row) {
        return sendError(reply, 404, 'User not found');
      }
      return reply.send(row);
    }
  );
});

/**
 * Get friends list for current user
 * Returns array of friend profiles with online status
 */
fastify.get('/user/friends', (request, reply) => {
  const sessionCookie = request.cookies.session;
  
  if (!sessionCookie) {
    return sendError(reply, 401, 'Authentication required');
  }

  const db = openDb();
  
  // First get current user ID
  db.get(
    `SELECT id FROM users WHERE session_cookie = ?`,
    [sessionCookie],
    (err, user) => {
      if (err || !user) {
        db.close();
        return sendError(reply, 401, 'Invalid session');
      }

      // Get friends with their profiles
      db.all(
        `SELECT u.id, u.email, u.nickname, u.avatar, u.is_active, u.last_login, f.created_at as friendship_date
         FROM friends f
         JOIN users u ON f.friend_id = u.id
         WHERE f.user_id = ?
         ORDER BY u.is_active DESC, u.nickname ASC`,
        [user.id],
        (err, rows) => {
          db.close();
          if (err) {
            console.error('Error fetching friends:', err);
            return sendError(reply, 500, 'Database error');
          }
          return reply.send({ friends: rows || [] });
        }
      );
    }
  );
});

/**
 * Add a friend
 * Body: { friendId } or { friendEmail }
 */
fastify.post('/user/friends/add', (request, reply) => {
  const sessionCookie = request.cookies.session;
  const { friendId, friendEmail } = request.body || {};
  
  if (!sessionCookie) {
    return sendError(reply, 401, 'Authentication required');
  }
  
  if (!friendId && !friendEmail) {
    return sendError(reply, 400, 'friendId or friendEmail required');
  }

  const db = openDb();
  
  db.get(
    `SELECT id FROM users WHERE session_cookie = ?`,
    [sessionCookie],
    (err, user) => {
      if (err || !user) {
        db.close();
        return sendError(reply, 401, 'Invalid session');
      }

      // Function to add friend once we have their ID
      const addFriendById = (targetFriendId) => {
        if (user.id === parseInt(targetFriendId)) {
          db.close();
          return sendError(reply, 400, 'Cannot add yourself as friend');
        }

        // Add friendship
        db.run(
          `INSERT INTO friends (user_id, friend_id) VALUES (?, ?)`,
          [user.id, targetFriendId],
          function(err) {
            db.close();
            if (err) {
              if (err.code === 'SQLITE_CONSTRAINT') {
                return sendError(reply, 409, 'Already friends');
              }
              console.error('Error adding friend:', err);
              return sendError(reply, 500, 'Failed to add friend');
            }
            return reply.send({ status: 'ok', friendshipId: this.lastID });
          }
        );
      };

      // If friendEmail provided, look up user ID first
      if (friendEmail) {
        db.get(
          `SELECT id, email FROM users WHERE email = ?`,
          [friendEmail],
          (err, friend) => {
            if (err || !friend) {
              db.close();
              return sendError(reply, 404, 'User with that email not found');
            }
            addFriendById(friend.id);
          }
        );
      } else {
        // friendId provided directly
        db.get(
          `SELECT id FROM users WHERE id = ?`,
          [friendId],
          (err, friend) => {
            if (err || !friend) {
              db.close();
              return sendError(reply, 404, 'User not found');
            }
            addFriendById(friend.id);
          }
        );
      }
    }
  );
});

/**
 * Remove a friend
 * Body: { friendId }
 */
fastify.post('/user/friends/remove', (request, reply) => {
  const sessionCookie = request.cookies.session;
  const { friendId } = request.body || {};
  
  if (!sessionCookie) {
    return sendError(reply, 401, 'Authentication required');
  }
  
  if (!friendId) {
    return sendError(reply, 400, 'friendId required');
  }

  const db = openDb();
  
  db.get(
    `SELECT id FROM users WHERE session_cookie = ?`,
    [sessionCookie],
    (err, user) => {
      if (err || !user) {
        db.close();
        return sendError(reply, 401, 'Invalid session');
      }

      db.run(
        `DELETE FROM friends WHERE user_id = ? AND friend_id = ?`,
        [user.id, friendId],
        function(err) {
          db.close();
          if (err) {
            console.error('Error removing friend:', err);
            return sendError(reply, 500, 'Failed to remove friend');
          }
          return reply.send({ status: 'ok', removed: this.changes });
        }
      );
    }
  );
});

/**
 * Get user stats (wins/losses)
 * Query: ?userId=123
 */
fastify.get('/user/stats', (request, reply) => {
  const userId = request.query.userId;
  
  if (!userId) {
    return sendError(reply, 400, 'userId required');
  }

  const db = openDb();
  
  db.all(
    `SELECT 
      COUNT(*) as total_games,
      SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN winner_id != ? AND winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
     FROM game_sessions
     WHERE player1_id = ? OR player2_id = ?`,
    [userId, userId, userId, userId],
    (err, rows) => {
      db.close();
      if (err) {
        console.error('Error fetching stats:', err);
        return sendError(reply, 500, 'Database error');
      }
      
      const stats = rows[0] || { total_games: 0, wins: 0, losses: 0 };
      return reply.send(stats);
    }
  );
});

/**
 * Get match history for user
 * Query: ?userId=123&limit=10
 */
fastify.get('/user/matches', (request, reply) => {
  const userId = request.query.userId;
  const limit = parseInt(request.query.limit) || 10;
  
  if (!userId) {
    return sendError(reply, 400, 'userId required');
  }

  const db = openDb();
  
  db.all(
    `SELECT 
      gs.*,
      u1.nickname as player1_nickname,
      u1.avatar as player1_avatar,
      u2.nickname as player2_nickname,
      u2.avatar as player2_avatar
     FROM game_sessions gs
     JOIN users u1 ON gs.player1_id = u1.id
     JOIN users u2 ON gs.player2_id = u2.id
     WHERE gs.player1_id = ? OR gs.player2_id = ?
     ORDER BY gs.started_at DESC
     LIMIT ?`,
    [userId, userId, limit],
    (err, rows) => {
      db.close();
      if (err) {
        console.error('Error fetching match history:', err);
        return sendError(reply, 500, 'Database error');
      }
      return reply.send({ matches: rows || [] });
    }
  );
});

// (keep /players/resolve if you want it for tournaments later)
// ...

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('✅ Login service running at', address);
});
