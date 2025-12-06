const fastify = require('fastify')({
  logger: false
});

const sqlite3 = require('sqlite3');
const crypto = require('crypto');
const fastifyCookie = require('@fastify/cookie');
const { hashPassword } = require('./hash.js');
const { validateAuthRequest } = require('./security.js');

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

/**
 * Create account
 * Body: { email, password }
 */
fastify.post('/createAccount', (request, reply) => {
  // Validate and sanitize input
  const validation = validateAuthRequest(request.body);
  
  if (!validation.isValid) {
    return sendError(reply, 400, validation.errors.join(', '));
  }

  const { email, password } = validation.sanitizedData;
  const db = openDb();
  const hashed = hashPassword(password);

  db.run(
    `INSERT INTO users (email, password) VALUES (?, ?)`,
    [email, hashed],
    function (err) {
      if (err) {
        console.error('DB insert error:', err);
        db.close();
        if (err.code === 'SQLITE_CONSTRAINT') {
          return sendError(reply, 409, 'Email already exists');
        }
        return sendError(reply, 500, 'Database error');
      }
      db.close();
      return reply.send({ status: 'ok', userId: this.lastID, email });
    }
  );
});

/**
 * Login and set session cookie
 * Body: { email, password }
 */
fastify.post('/loginAccount', (request, reply) => {
  // Validate and sanitize input  
  const validation = validateAuthRequest(request.body);
  
  if (!validation.isValid) {
    return sendError(reply, 400, validation.errors.join(', '));
  }

  const { email, password } = validation.sanitizedData;
  const db = openDb();
  const hashed = hashPassword(password);

  db.get(
    `SELECT id, email FROM users WHERE email = ? AND password = ?`,
    [email, hashed],
    (err, row) => {
      if (err) {
        console.error('DB select error:', err);
        db.close();
        return sendError(reply, 500, 'Database error');
      }

      if (!row) {
        db.close();
        return sendError(reply, 401, 'Invalid email or password');
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

// (keep /players/resolve if you want it for tournaments later)
// ...

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('✅ Login service running at', address);
});
