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
  logger: false,
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

async function getCurrentUser(req, reply) {
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

  // Forward Set-Cookie headers (refreshed JWT) back to the browser
  if (reply) {
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      reply.raw.setHeader('Set-Cookie', cookie);
    }
  }

  return await res.json(); // { id, email }
}

/** Helper: open DB */
function openDb() {
  const db = new sqlite3.Database(DB_PATH);
  db.run('PRAGMA journal_mode = WAL');
  return db;
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

function getJWTToken(refresh_token, db) {
  return new Promise((resolve, reject) => {
    console.log(
      'Looking up user with session cookie:',
      refresh_token ? `${refresh_token.substring(0, 20)}...` : 'null',
    );

    db.get(
      `SELECT u.* FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_cookie = ?`,
      [refresh_token],
      (err, row) => {
        if (err) {
          console.error('Database error in getJWTToken:', err);
          return reject(err);
        }
        if (!row) {
          console.log('No user found with session cookie');
          return reject(new Error('Wrong Refresh Token'));
        }

        console.log('Found user for JWT creation:', {
          id: row.id,
          email: row.email,
        });

        const token = jwt.sign(
          {
            id: row.id,
            email: row.email,
            nickname: row.nickname,
            avatar: row.avatar,
          },
          process.env.JWT_SECRET,
          { expiresIn: '5m' },
        );

        console.log('JWT token created successfully');
        resolve(token);
      },
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
      [email, hashed, secret.base32],
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
    // Insert a new session row (allows multiple concurrent logins)
    await runAsync(
      db,
      'INSERT INTO sessions (user_id, session_cookie) VALUES (?, ?)',
      [id, sessionCookie],
    );

    // Update last_login on the user row
    await runAsync(
      db,
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [id],
    );

    console.log('session inserted into sessions table');

    const JWT = await getJWTToken(sessionCookie, db);

    return reply
      .setCookie('session', sessionCookie, {
        httpOnly: true,
        secure: false, // set true if https
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours in seconds
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
    console.error('Error updating or verifying session cookie:', err);
    return sendError(reply, 500, 'Failed to update session');
  } finally {
    db.close();
  }
});

/**
 * Logout: invalidate session
 */
fastify.post('/logout', async (request, reply) => {
  const sessionCookie = request.cookies.session;

  if (!sessionCookie) {
    reply.clearCookie('session', { path: '/' });
    reply.clearCookie('JWT', { path: '/' });
    return reply.send({ status: 'ok' });
  }

  const db = openDb();
  try {
    await runAsync(db, 'DELETE FROM sessions WHERE session_cookie = ?', [
      sessionCookie,
    ]);
  } catch (err) {
    console.error('Error clearing session:', err);
  } finally {
    db.close();
  }

  reply.clearCookie('session', { path: '/' });
  reply.clearCookie('JWT', { path: '/' });
  return reply.send({ status: 'ok' });
});

/**
 * /auth/me — get current user from cookie (JWT)
 */
fastify.post('/auth/me', async (request, reply) => {
  let token;

  try {
    token = request.cookies.JWT;
    console.log(
      'JWT token from cookies:',
      token ? `${token.substring(0, 20)}...` : 'null',
    );
  } catch (err) {
    console.log('Error reading JWT cookie:', err);
  }

  // First try to verify the existing JWT
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('JWT verification successful for user:', decoded.id);

      return reply.send({
        id: decoded.id,
        email: decoded.email,
        nickname: decoded.nickname,
        avatar: decoded.avatar,
      });
    } catch (jwtErr) {
      console.log('JWT verification failed:', jwtErr.message);
      // Continue to token refresh logic below
    }
  } else {
    console.log('No JWT token found in cookies');
  }

  // Try to refresh the token using session cookie
  const sessionCookie = request.cookies.session;
  console.log(
    'Session cookie for refresh:',
    sessionCookie ? `${sessionCookie.substring(0, 20)}...` : 'null',
  );

  if (!sessionCookie) {
    console.log('No session cookie found - cannot refresh');
    return sendError(reply, 401, 'No valid session');
  }

  const db = openDb();
  try {
    const newToken = await getJWTToken(sessionCookie, db);
    console.log('Token refresh successful, new token created');

    const decoded = jwt.verify(newToken, process.env.JWT_SECRET);

    // Update last_login to track activity
    await runAsync(
      db,
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [decoded.id],
    ).catch((err) => console.error('Failed to update last_login:', err));

    return reply
      .setCookie('JWT', newToken, {
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
      });
  } catch (refreshErr) {
    console.error('Token refresh failed:', refreshErr.message);
    return sendError(reply, 401, 'Session expired or invalid');
  } finally {
    db.close();
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
    'SELECT id, email, secret FROM users WHERE email = ? AND password = ?',
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
      });
    },
  );
});
/**
 * Update user profile
 * Body: { nickname?, avatar? }
 */
fastify.post('/user/update', async (request, reply) => {
  const me = await getCurrentUser(request, reply);
  if (!me)
    return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');

  const { nickname, avatar } = request.body || {};
  if (!nickname && !avatar)
    return sendError(reply, 400, 'Nickname or avatar required');

  const db = openDb();

  db.get(
    'SELECT user_id AS id FROM sessions WHERE session_cookie = ?',
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
        },
      );
    },
  );
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('✅ Login service running');
});
