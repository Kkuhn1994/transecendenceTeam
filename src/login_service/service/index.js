'use strict';

const Fastify = require('fastify');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const crypto = require('crypto');
const fastifyCookie = require('@fastify/cookie');
const { hashPassword } = require('./hash.js');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { validateAuthRequest } = require('./security.js');
const base32 = require('thirty-two');
const jwt = require('jsonwebtoken');
const { Agent } = require('undici');

const DB_PATH = '/app/data/database.db';

const fastify = Fastify({
  logger: true,
  https: {
    key: fs.readFileSync('/service/service.key'),
    cert: fs.readFileSync('/service/service.crt'),
  },
});

fastify.register(fastifyCookie, {
  secret: 'super_secret_key_32_chars',
});

const dispatcher = new Agent({
  connect: { rejectUnauthorized: false },
});

async function getCurrentUser(req) {
  const res = await fetch('https://login_service:3000/auth/me', {
    method: 'POST',
    dispatcher,
    headers: {
      'Content-Type': 'application/json',
      Cookie: req.headers.cookie || '',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) return null;
  return await res.json(); // { id, email }
}

/** Helper: open DB */
function openDb() {
  return new sqlite3.Database(DB_PATH);
}

/** Helper: respond with JSON error */
function sendError(reply, statusCode, message) {
  return reply.code(statusCode).send({ status: 'error', error: message });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // this.lastID, this.changes
    });
  });
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getJWTToken(refresh_token, db) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM users WHERE session_cookie = ?',
      [refresh_token],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Wrong Refresh Token'));

        const token = jwt.sign(
          {
            id: row.id,
            email: row.email,
            nickname: row.nickname,
            avatar: row.avatar,
            is_active: row.is_active,
          },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );

        resolve(token);
      }
    );
  });
}

function getTimeBytes(counter) {
  const buffer = Buffer.alloc(8); // 64-bit
  buffer.writeUInt32BE(0, 0); // upper 32 bits
  buffer.writeUInt32BE(counter, 4); // lower 32 bits
  return buffer;
}

function generateTOTP(secret, time) {
  const timeCounter = Math.floor(time / 30);
  const timeBytes = getTimeBytes(timeCounter);
  const key = base32.decode(secret);

  const hmac = crypto.createHmac('sha1', key).update(timeBytes).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const hashPart = hmac.slice(offset, offset + 4);

  let value = hashPart.readUInt32BE(0);
  value = value & 0x7fffffff;

  const nrDigits = 6;
  const code = value % Math.pow(10, nrDigits);

  return code.toString().padStart(nrDigits, '0');
}

function verifyTOTP(secret, otp, window = 1, period = 30) {
  const currentTime = Math.floor(Date.now() / 1000);

  for (let i = -window; i <= window; i++) {
    const testTime = currentTime + i * period;
    const generatedOtp = generateTOTP(secret, testTime);
    if (generatedOtp === otp) return true;
  }

  return false;
}

/**
 * Create account
 * Body: { email, password }
 */
fastify.post('/createAccount', async (request, reply) => {
  const validation = validateAuthRequest(request.body);
  if (!validation.isValid) {
    return sendError(reply, 400, validation.errors.join(', '));
  }

  const { email, password } = validation.sanitizedData;
  const db = openDb();
  const hashed = hashPassword(password);

  const secret = speakeasy.generateSecret({
    length: 20,
    name: 'Pong',
    issuer: 'PongHUB',
  });

  try {
    const result = await runAsync(
      db,
      'INSERT INTO users (email, password, secret) VALUES (?, ?, ?)',
      [email, hashed, secret.base32]
    );

    const otpAuthUrl = secret.otpauth_url;
    const qr = await qrcode.toDataURL(otpAuthUrl);

    return reply.send({
      status: 'ok',
      userId: result.lastID,
      email,
      qr,
      otpAuthUrl,
    });
  } catch (err) {
    console.error('DB insert error:', err);
    if (err.code === 'SQLITE_CONSTRAINT') {
      return sendError(reply, 409, 'User already exists');
    }
    return sendError(reply, 500, 'Database error');
  } finally {
    db.close();
  }
});

/**
 * Login and set session cookie
 * Body: { email, password, otp }
 */
fastify.post('/loginAccount', async (request, reply) => {
  console.log('login 1');

  const validation = validateAuthRequest(request.body);
  console.log('login');

  if (!validation.isValid) {
    return sendError(reply, 400, validation.errors.join(', '));
  }

  const { email, password } = validation.sanitizedData;
  const otp = request.body.otp;

  const db = openDb();
  let sessionCookie;

  const res = await fetch('https://localhost:3000/verifyCredentials', {
    method: 'POST',
    dispatcher,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, otp }),
  });

  const data = await res.json();

  console.log(res.status);
  console.log(data.id);

  const id = data.id;

  if (res.status !== 200) {
    console.log('login status not ok');
    db.close();
    return sendError(reply, 401, 'Wrong User Credentials');
  }

  console.log('update session');

  sessionCookie = crypto.randomBytes(32).toString('hex');

  try {
    await runAsync(
      db,
      'UPDATE users SET session_cookie = ?, is_active = 1, last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [sessionCookie, id]
    );

    console.log('session updated');

    const JWT = await getJWTToken(sessionCookie, db);

    return reply
      .setCookie('session', sessionCookie, {
        httpOnly: true,
        secure: false, // set true if https
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24,
      })
      .setCookie('JWT', JWT, {
        httpOnly: true,
        secure: false, // set true if https
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24,
      })
      .send({ status: 'ok', email: data.email, userId: id });
  } catch (err) {
    console.error('Error updating session cookie:', err);
    return sendError(reply, 500, 'Failed to update session');
  } finally {
    db.close();
  }
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
    'UPDATE users SET session_cookie = NULL, is_active = 0 WHERE session_cookie = ?',
    [sessionCookie],
    (err) => {
      db.close();
      if (err) console.error('Error clearing session cookie:', err);

      reply.clearCookie('session', { path: '/' });
      return reply.send({ status: 'ok' });
    }
  );
});

/**
 * /auth/me — get current user from cookie (JWT)
 */
fastify.post('/auth/me', async (request, reply) => {
  let token;

  try {
    token = request.cookies.JWT;
  } catch (err) {
    console.log(err);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    return reply.send({
      id: decoded.id,
      email: decoded.email,
      nickname: decoded.nickname,
      avatar: decoded.avatar,
      is_active: decoded.is_active,
    });
  } catch (err) {
    try {
      const db = openDb();
      token = await getJWTToken(request.cookies.session, db);
      console.log('token refresh');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      return reply
        .setCookie('JWT', token, {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path: '/',
          maxAge: 60 * 60 * 24,
        })
        .send({
          id: decoded.id,
          email: decoded.email,
          nickname: decoded.nickname,
          avatar: decoded.avatar,
          is_active: decoded.is_active,
        });
    } catch (e2) {
      return sendError(reply, 401, 'corrupted jwt');
    }
  }
});

/**
 * /verifyCredentials — check email+password WITHOUT setting cookie
 * Body: { email, password, otp }
 */
fastify.post('/verifyCredentials', (request, reply) => {
  const { email, password, otp } = request.body || {};

  console.log(email);
  console.log(password);

  if (!email || !password) {
    return sendError(reply, 400, 'Email and password are required');
  }

  const db = openDb();
  const hashed = hashPassword(password);

  console.log('DB call pre');

  db.get(
    'SELECT id, email, secret, is_active FROM users WHERE email = ? AND password = ?',
    [email, hashed],
    (err, row) => {
      db.close();
      console.log('DB call');

      if (err) {
        console.log('DB error in verifyCredentials:');
        return sendError(reply, 500, 'Database error');
      }

      if (!row) {
        console.log('user not found');
        return sendError(reply, 401, 'Invalid email or password for Player 2');
      }

      const secret = row.secret;

      console.log('OTP:', otp);

      if (!verifyTOTP(secret, otp)) {
        return sendError(reply, 401, 'Invalid OTP');
      }

      console.log(row.id);

      return reply.send({
        status: 'ok',
        id: row.id,
        email: row.email,
        is_active: row.is_active,
      });
    }
  );
});

/**
 * Update user profile
 * Body: { nickname?, avatar? }
 */
fastify.post('/user/update', async (request, reply) => {
  const me = await getCurrentUser(request);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');

  const { nickname, avatar } = request.body || {};
  if (!nickname && !avatar) return sendError(reply, 400, 'Nickname or avatar required');

  const db = openDb();

  db.get(
    'SELECT id FROM users WHERE session_cookie = ?',
    [sessionCookie],
    (err, user) => {
      if (err || !user) {
        db.close();
        return sendError(reply, 401, 'Invalid session');
      }

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
        function (err2) {
          db.close();

          if (err2) {
            console.error('Error updating profile:', err2);
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
fastify.get('/user/profile', async (request, reply) => {
  const me = await getCurrentUser(request);
  if (!me) return reply.code(401).send({ status: 'error', error: 'Not authenticated as Player 1' });

  const userId = Number(request.query.userId);
  if (!Number.isFinite(userId) || userId <= 0) return sendError(reply, 400, 'userId required');

  const db = openDb();
  try {
    const row = await getAsync(
      db,
      'SELECT id, email, nickname, avatar, is_active, last_login FROM users WHERE id = ?',
      [userId]
    );

    if (!row) return sendError(reply, 404, 'User not found');
    return reply.send(row);
  } catch (err) {
    console.error('DB error in user/profile:', err);
    return sendError(reply, 500, 'Database error');
  } finally {
    db.close();
  }
});

/**
 * Get friends list for current user
 */
fastify.get('/user/friends', async (request, reply) => {
  const me = await getCurrentUser(request);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');

  const db = openDb();

  try {
    // 1) resolve current user id by session cookie
    const user = await getAsync(db, `SELECT id FROM users WHERE session_cookie = ?`, [sessionCookie]);
    if (!user) return sendError(reply, 401, 'Invalid session');

    // 2) get friends list
    const rows = await allAsync(
      db,
      `SELECT u.id, u.email, u.nickname, u.avatar, u.is_active, u.last_login, f.created_at as friendship_date
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ?
       ORDER BY u.is_active DESC, u.nickname ASC`,
      [user.id],
    );

    return reply.send({ friends: rows || [] });
  } catch (err) {
    console.error('Error fetching friends:', err);
    return sendError(reply, 500, 'Database error');
  } finally {
    db.close();
  }
});
/**
 * Add a friend
 * Body: { friendId } or { friendEmail }
 */
fastify.post('/user/friends/add', async (request, reply) => {
  const me = await getCurrentUser(request);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  const { friendId, friendEmail } = request.body || {};

  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');
  if (!friendId && !friendEmail) return sendError(reply, 400, 'friendId or friendEmail required');

  const db = openDb();

  try {
    const user = await getAsync(db, 'SELECT id FROM users WHERE session_cookie = ?', [sessionCookie]);
    if (!user) return sendError(reply, 401, 'Invalid session');

    let target = null;

    if (friendEmail) {
      target = await getAsync(db, 'SELECT id FROM users WHERE email = ?', [friendEmail]);
      if (!target) return sendError(reply, 404, 'User not found');
    } else {
      target = await getAsync(db, 'SELECT id FROM users WHERE id = ?', [friendId]);
      if (!target) return sendError(reply, 404, 'User not found');
    }

    const targetFriendId = Number(target.id);

    if (!Number.isFinite(targetFriendId) || targetFriendId <= 0) {
      return sendError(reply, 400, 'Invalid friend id');
    }

    if (user.id === targetFriendId) {
      return sendError(reply, 400, 'Cannot add yourself as friend');
    }

    try {
      const result = await runAsync(
        db,
        'INSERT INTO friends (user_id, friend_id) VALUES (?, ?)',
        [user.id, targetFriendId]
      );

      return reply.send({ status: 'ok', friendshipId: result.lastID });
    } catch (err) {
      if (err && err.code === 'SQLITE_CONSTRAINT') {
        return sendError(reply, 409, 'Already friends');
      }
      console.error('Error adding friend:', err);
      return sendError(reply, 500, 'Failed to add friend');
    }
  } catch (err) {
    console.error('friends/add unexpected error:', err);
    return sendError(reply, 500, 'Server error');
  } finally {
    db.close();
  }
});

/**
 * Remove a friend
 * Body: { friendId }
 */
fastify.post('/user/friends/remove', async (request, reply) => {
  const me = await getCurrentUser(request);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  const { friendId } = request.body || {};

  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');
  if (!friendId) return sendError(reply, 400, 'friendId required');

  const db = openDb();

  try {
    const user = await getAsync(db, 'SELECT id FROM users WHERE session_cookie = ?', [sessionCookie]);
    if (!user) return sendError(reply, 401, 'Invalid session');

    const result = await runAsync(
      db,
      'DELETE FROM friends WHERE user_id = ? AND friend_id = ?',
      [user.id, friendId]
    );

    return reply.send({ status: 'ok', removed: result.changes || 0 });
  } catch (err) {
    console.error('Error removing friend:', err);
    return sendError(reply, 500, 'Failed to remove friend');
  } finally {
    db.close();
  }
});

/**
 * Get user stats (wins/losses)
 * Query: ?userId=123
 */
fastify.get('/user/stats', async (request, reply) => {
  const me = await getCurrentUser(request);
  if (!me) return reply.code(401).send({ status: 'error', error: 'Not authenticated as Player 1' });

  const userId = Number(request.query.userId);
  if (!Number.isFinite(userId) || userId <= 0) return sendError(reply, 400, 'userId required');

  const db = openDb();
  try {
    const row = await getAsync(
      db,
      `
      SELECT
        COUNT(*) as total_games,
        SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN winner_id != ? AND winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses
      FROM game_sessions
      WHERE player1_id = ? OR player2_id = ?
      `,
      [userId, userId, userId, userId]
    );

    return reply.send(row || { total_games: 0, wins: 0, losses: 0 });
  } catch (err) {
    console.error('Error fetching stats:', err);
    return sendError(reply, 500, 'Database error');
  } finally {
    db.close();
  }
});

fastify.get('/user/matches', async (request, reply) => {
  const me = await getCurrentUser(request);
  if (!me) return reply.code(401).send({ status: 'error', error: 'Not authenticated as Player 1' });

  const userId = Number(request.query.userId);
  const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 10));
  if (!Number.isFinite(userId) || userId <= 0) return sendError(reply, 400, 'userId required');

  const db = openDb();
  try {
    const rows = await allAsync(
      db,
      `
      SELECT
        gs.*,
        u1.nickname as player1_nickname, u1.avatar as player1_avatar, u1.email as player1_email,
        u2.nickname as player2_nickname, u2.avatar as player2_avatar, u2.email as player2_email
      FROM game_sessions gs
      JOIN users u1 ON gs.player1_id = u1.id
      LEFT JOIN users u2 ON gs.player2_id = u2.id
      WHERE (gs.player1_id = ? OR gs.player2_id = ?)
      AND gs.player2_id != 0
      ORDER BY gs.started_at DESC
      LIMIT ?
      `,
      [userId, userId, limit]
    );

    return reply.send({ matches: rows || [] });
  } catch (err) {
    console.error('Error fetching match history:', err);
    return sendError(reply, 500, 'Database error');
  } finally {
    db.close();
  }
});

fastify.get('/user/summary', async (request, reply) => {
  const me = await getCurrentUser(request);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const userId = request.query.userId;
  if (!userId) return sendError(reply, 400, 'userId required');

  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return sendError(reply, 400, 'Invalid userId');

  const db = openDb();

  try {
    const stats = await getAsync(
      db,
      `
      SELECT
        COUNT(*) AS games_played,
        SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN winner_id IS NOT NULL AND winner_id != ? THEN 1 ELSE 0 END) AS losses
      FROM game_sessions
      WHERE (player1_id = ? OR player2_id = ?)
       AND player2_id != 0`,
      [uid, uid, uid, uid]
    );

    const tour = await getAsync(
      db,
      `
      SELECT COUNT(*) AS tournaments_won
      FROM tournaments
      WHERE winner_id = ?
      `,
      [uid]
    );

    const gamesPlayed = Number(stats?.games_played || 0);
    const wins = Number(stats?.wins || 0);
    const losses = Number(stats?.losses || 0);
    const winrate = gamesPlayed > 0 ? wins / gamesPlayed : 0;
    const tournamentsWon = Number(tour?.tournaments_won || 0);

    return reply.send({
      userId: uid,
      gamesPlayed,
      wins,
      losses,
      winrate,
      tournamentsWon,
    });
  } catch (err) {
    console.error('Error in /user/summary:', err);
    return sendError(reply, 500, 'Database error');
  } finally {
    db.close();
  }
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('✅ Login service running at', address);
});
