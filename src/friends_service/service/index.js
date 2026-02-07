'use strict';

const Fastify = require('fastify');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const fastifyCookie = require('@fastify/cookie');
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

  if (reply) {
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
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

fastify.get('/user/friends', async (request, reply) => {
  const me = await getCurrentUser(request, reply);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');

  const db = openDb();

  try {
    const user = await getAsync(db, `SELECT user_id AS id FROM sessions WHERE session_cookie = ?`, [sessionCookie]);
    if (!user) return sendError(reply, 401, 'Invalid session');

    // Accepted friends (existing behavior)
    const accepted = await allAsync(
      db,
      `
      SELECT
        u.id, u.email, u.nickname, u.avatar,
        (EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = u.id)) AS is_active,
        u.last_login,
        f.created_at AS friendship_date,
        'accepted' AS relation,
        NULL AS request_id
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ?
      `,
      [user.id]
    );

    // Outgoing pending (I requested them)
    const outgoing = await allAsync(
      db,
      `
      SELECT
        u.id, u.email, u.nickname, u.avatar,
        (EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = u.id)) AS is_active,
        u.last_login,
        fr.created_at AS friendship_date,
        'outgoing_pending' AS relation,
        fr.id AS request_id
      FROM friend_requests fr
      JOIN users u ON fr.addressee_id = u.id
      WHERE fr.requester_id = ? AND fr.status = 'pending'
      `,
      [user.id]
    );

    // Incoming pending (they requested me)
    const incoming = await allAsync(
      db,
      `
      SELECT
        u.id, u.email, u.nickname, u.avatar,
        (EXISTS(SELECT 1 FROM sessions s WHERE s.user_id = u.id)) AS is_active,
        u.last_login,
        fr.created_at AS friendship_date,
        'incoming_pending' AS relation,
        fr.id AS request_id
      FROM friend_requests fr
      JOIN users u ON fr.requester_id = u.id
      WHERE fr.addressee_id = ? AND fr.status = 'pending'

      `,
      [user.id]
    );

    const rows = [...(accepted || []), ...(incoming || []), ...(outgoing || [])];

    // Optional: sort accepted first, then incoming, then outgoing
    const rank = { accepted: 0, incoming_pending: 1, outgoing_pending: 2 };
    rows.sort((a, b) => (rank[a.relation] ?? 9) - (rank[b.relation] ?? 9));

    return reply.send({ friends: rows });
  } catch (err) {
    console.error('Error fetching friends:', err);
    return sendError(reply, 500, 'Database error');
  } finally {
    db.close();
  }
});

fastify.post('/user/friends/add', async (request, reply) => {
  const me = await getCurrentUser(request, reply);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  const { friendId, friendEmail } = request.body || {};
  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');
  if (!friendId && !friendEmail) return sendError(reply, 400, 'friendId or friendEmail required');

  const db = openDb();

  try {
    const user = await getAsync(db, 'SELECT user_id AS id FROM sessions WHERE session_cookie = ?', [sessionCookie]);
    if (!user) return sendError(reply, 401, 'Invalid session');

    // resolve target
    let target = null;
    if (friendEmail) {
      target = await getAsync(db, 'SELECT id FROM users WHERE email = ?', [friendEmail]);
    } else {
      target = await getAsync(db, 'SELECT id FROM users WHERE id = ?', [friendId]);
    }
    if (!target) return sendError(reply, 404, 'User not found');

    const fromId = Number(user.id);
    const toId = Number(target.id);

    if (!Number.isFinite(toId) || toId <= 0) return sendError(reply, 400, 'Invalid friend id');
    if (fromId === toId) return sendError(reply, 400, 'Cannot add yourself as friend');

    // already accepted friends?
    const already = await getAsync(
      db,
      'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? LIMIT 1',
      [fromId, toId]
    );
    if (already) return sendError(reply, 409, 'Already friends');

    // If THEY already requested me, auto-accept.
    const incomingReq = await getAsync(
      db,
      `
      SELECT id
      FROM friend_requests
      WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
      LIMIT 1
      `,
      [toId, fromId]
    );

    if (incomingReq) {
      await runAsync(
        db,
        `UPDATE friend_requests SET status='accepted', responded_at=CURRENT_TIMESTAMP WHERE id=?`,
        [incomingReq.id]
      );

      await runAsync(db, 'INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)', [fromId, toId]);
      await runAsync(db, 'INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)', [toId, fromId]);

      return reply.send({ status: 'ok', mode: 'accepted' });
    }

    const existingOut = await getAsync(
      db,
      `
      SELECT id, status
      FROM friend_requests
      WHERE requester_id = ? AND addressee_id = ?
      LIMIT 1
      `,
      [fromId, toId]
    );

    if (existingOut) {
      if (existingOut.status === 'pending') {
        return sendError(reply, 409, 'Request already sent');
      }

      if (existingOut.status === 'rejected') {
        // Re-open the request (allow re-send)
        await runAsync(
          db,
          `
          UPDATE friend_requests
          SET status='pending',
              responded_at=NULL
          WHERE id=?
          `,
          [existingOut.id]
        );

        return reply.send({ status: 'ok', mode: 'pending', requestId: existingOut.id });
      }

      if (existingOut.status === 'accepted') {
        // Safety: should already be friends, but just in case
        return sendError(reply, 409, 'Already friends');
      }
    }

    // Otherwise create a brand new pending request
    try {
      const result = await runAsync(
        db,
        'INSERT INTO friend_requests (requester_id, addressee_id, status) VALUES (?, ?, ?)',
        [fromId, toId, 'pending']
      );

      return reply.send({ status: 'ok', mode: 'pending', requestId: result.lastID });
    } catch (err) {
      if (err && err.code === 'SQLITE_CONSTRAINT') {
        // In case of race/double-click
        return sendError(reply, 409, 'Request already sent');
      }
      console.error('Error creating friend request:', err);
      return sendError(reply, 500, 'Failed to create friend request');
    }
  } catch (err) {
    console.error('friends/add unexpected error:', err);
    return sendError(reply, 500, 'Server error');
  } finally {
    db.close();
  }
});

fastify.post('/user/friends/accept', async (request, reply) => {
  const me = await getCurrentUser(request, reply);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  const { requestId } = request.body || {};
  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');
  if (!requestId) return sendError(reply, 400, 'requestId required');

  const db = openDb();

  try {
    const user = await getAsync(db, 'SELECT user_id AS id FROM sessions WHERE session_cookie = ?', [sessionCookie]);
    if (!user) return sendError(reply, 401, 'Invalid session');

    const rid = Number(requestId);
    if (!Number.isFinite(rid) || rid <= 0) return sendError(reply, 400, 'Invalid requestId');

    const fr = await getAsync(
      db,
      `
      SELECT id, requester_id, addressee_id, status
      FROM friend_requests
      WHERE id = ?
      LIMIT 1
      `,
      [rid]
    );
    if (!fr) return sendError(reply, 404, 'Request not found');
    if (fr.status !== 'pending') return sendError(reply, 409, 'Request is not pending');
    if (Number(fr.addressee_id) !== Number(user.id)) return sendError(reply, 403, 'Forbidden');

    await runAsync(db, `UPDATE friend_requests SET status='accepted', responded_at=CURRENT_TIMESTAMP WHERE id=?`, [rid]);

    // Insert both ways so both users see each other as friends.
    await runAsync(db, 'INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)', [
      fr.requester_id,
      fr.addressee_id,
    ]);
    await runAsync(db, 'INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)', [
      fr.addressee_id,
      fr.requester_id,
    ]);

    return reply.send({ status: 'ok' });
  } catch (err) {
    console.error('friends/accept error:', err);
    return sendError(reply, 500, 'Server error');
  } finally {
    db.close();
  }
});

fastify.post('/user/friends/reject', async (request, reply) => {
  const me = await getCurrentUser(request, reply);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  const { requestId } = request.body || {};
  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');
  if (!requestId) return sendError(reply, 400, 'requestId required');

  const db = openDb();

  try {
    const user = await getAsync(db, 'SELECT user_id AS id FROM sessions WHERE session_cookie = ?', [sessionCookie]);
    if (!user) return sendError(reply, 401, 'Invalid session');

    const rid = Number(requestId);
    const fr = await getAsync(db, 'SELECT id, addressee_id, status FROM friend_requests WHERE id=? LIMIT 1', [rid]);
    if (!fr) return sendError(reply, 404, 'Request not found');
    if (fr.status !== 'pending') return sendError(reply, 409, 'Request is not pending');
    if (Number(fr.addressee_id) !== Number(user.id)) return sendError(reply, 403, 'Forbidden');

    await runAsync(db, `UPDATE friend_requests SET status='rejected', responded_at=CURRENT_TIMESTAMP WHERE id=?`, [rid]);
    return reply.send({ status: 'ok' });
  } catch (err) {
    console.error('friends/reject error:', err);
    return sendError(reply, 500, 'Server error');
  } finally {
    db.close();
  }
});

fastify.post('/user/friends/remove', async (request, reply) => {
  const me = await getCurrentUser(request, reply);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const sessionCookie = request.cookies.session;
  const { friendId } = request.body || {};
  if (!sessionCookie) return sendError(reply, 401, 'Authentication required');
  if (!friendId) return sendError(reply, 400, 'friendId required');

  const db = openDb();

  try {
    const user = await getAsync(db, 'SELECT user_id AS id FROM sessions WHERE session_cookie = ?', [sessionCookie]);
    if (!user) return sendError(reply, 401, 'Invalid session');

    const uid = Number(user.id);
    const fid = Number(friendId);

    // Remove accepted friendships both ways
    const r1 = await runAsync(db, 'DELETE FROM friends WHERE user_id = ? AND friend_id = ?', [uid, fid]);
    const r2 = await runAsync(db, 'DELETE FROM friends WHERE user_id = ? AND friend_id = ?', [fid, uid]);

    // Also remove any pending requests between them (either direction)
    await runAsync(
      db,
      `
      DELETE FROM friend_requests
      WHERE (requester_id = ? AND addressee_id = ?)
         OR (requester_id = ? AND addressee_id = ?)
      `,
      [uid, fid, fid, uid]
    );

    return reply.send({ status: 'ok', removed: (r1.changes || 0) + (r2.changes || 0) });
  } catch (err) {
    console.error('Error removing friend:', err);
    return sendError(reply, 500, 'Failed to remove friend');
  } finally {
    db.close();
  }
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('✅ Friends service running at', address);
});
