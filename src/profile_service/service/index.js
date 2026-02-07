'use strict';

const Fastify = require('fastify');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const fastifyCookie = require('@fastify/cookie');
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

  // Forward refreshed cookies (e.g., JWT refresh) back to the browser
  if (reply) {
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
      // IMPORTANT: don't overwrite previous cookies
      reply.raw.setHeader('Set-Cookie', [
        ...(reply.raw.getHeader('Set-Cookie') || []),
        c,
      ]);
    }
  }

  return await res.json();
}


function openDb() {
  const db = new sqlite3.Database(DB_PATH);
  db.run('PRAGMA journal_mode = WAL');
  return db;
}

function sendError(reply, statusCode, message) {
  return reply.code(statusCode).send({ status: 'error', error: message });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
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

async function canAccessUser(db, viewerId, targetId) {
  if (!Number.isFinite(viewerId) || viewerId <= 0) return false;
  if (!Number.isFinite(targetId) || targetId <= 0) return false;

  if (viewerId === targetId) return true;

  // one-direction check: viewer -> target
  const row = await getAsync(
    db,
    'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? LIMIT 1',
    [viewerId, targetId],
  );
  return !!row;
}
// Not used for now
// fastify.post('/user/update', async (request, reply) => {
//   const me = await getCurrentUser(request, reply);
//   if (!me) return sendError(reply, 401, 'Not authenticated');

//   const sessionCookie = request.cookies.session;
//   if (!sessionCookie) return sendError(reply, 401, 'Authentication required');

//   const { nickname, avatar } = request.body || {};
//   if (!nickname && !avatar) return sendError(reply, 400, 'Nickname or avatar required');

//   const db = openDb();

//   try {
//     const user = await getAsync(db, 'SELECT id FROM users WHERE session_cookie = ?', [sessionCookie]);
//     if (!user) return sendError(reply, 401, 'Invalid session');

//     const updates = [];
//     const values = [];

//     if (nickname) {
//       updates.push('nickname = ?');
//       values.push(nickname);
//     }
//     if (avatar) {
//       updates.push('avatar = ?');
//       values.push(avatar);
//     }

//     values.push(user.id);

//     const result = await runAsync(db, `UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
//     return reply.send({ status: 'ok', updated: result.changes || 0 });
//   } catch (err) {
//     console.error('Error updating profile:', err);
//     return sendError(reply, 500, 'Failed to update profile');
//   } finally {
//     db.close();
//   }
// });

fastify.get('/user/profile', async (request, reply) => {
  const me = await getCurrentUser(request, reply);
  if (!me) return sendError(reply, 401, 'Not authenticated');

  const userId = Number(request.query.userId);
  if (!Number.isFinite(userId) || userId <= 0)
    return sendError(reply, 400, 'userId required');

  const db = openDb();
  try {
    const allowed = await canAccessUser(db, Number(me.id), userId);
    if (!allowed) return sendError(reply, 403, 'Forbidden');

    const row = await getAsync(
      db,
      `
      SELECT
        u.id, u.email, u.nickname, u.avatar,
        (EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = u.id)) AS is_active,
        u.last_login
      FROM users u
      WHERE u.id = ?
      `,
      [userId],
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

fastify.get('/user/matches', async (request, reply) => {
  const me = await getCurrentUser(request, reply);
  if (!me) return sendError(reply, 401, 'Not authenticated');

  const userId = Number(request.query.userId);
  const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 10));
  if (!Number.isFinite(userId) || userId <= 0)
    return sendError(reply, 400, 'userId required');

  const db = openDb();
  try {
    const allowed = await canAccessUser(db, Number(me.id), userId);
    if (!allowed) return sendError(reply, 403, 'Forbidden');

    const rows = await allAsync(
      db,
      `
      SELECT
        gs.*,
        t.name AS tournament_name,
        u1.nickname as player1_nickname, u1.avatar as player1_avatar, u1.email as player1_email,
        u2.nickname as player2_nickname, u2.avatar as player2_avatar, u2.email as player2_email
      FROM game_sessions gs
      JOIN users u1 ON gs.player1_id = u1.id
      LEFT JOIN users u2 ON gs.player2_id = u2.id
      LEFT JOIN tournaments t ON gs.tournament_id = t.id
      WHERE (gs.player1_id = ? OR gs.player2_id = ?)
      AND gs.player2_id != 0
      ORDER BY gs.started_at DESC
      LIMIT ?
      `,
      [userId, userId, limit],
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
  const me = await getCurrentUser(request, reply);
  if (!me) return sendError(reply, 401, 'Not authenticated');

  const uid = Number(request.query.userId);
  if (!Number.isFinite(uid) || uid <= 0)
    return sendError(reply, 400, 'Invalid userId');

  const db = openDb();

  try {
    const allowed = await canAccessUser(db, Number(me.id), uid);
    if (!allowed) return sendError(reply, 403, 'Forbidden');

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
      [uid, uid, uid, uid],
    );

    const tour = await getAsync(
      db,
      `SELECT COUNT(*) AS tournaments_won FROM tournaments WHERE winner_id = ?`,
      [uid],
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
  console.log('✅ Profile service running at', address);
});
