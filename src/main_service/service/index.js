const Fastify = require('fastify');
const path = require('path');
const fastifyStatic = require('@fastify/static');
const fastifyCookie = require('@fastify/cookie');
const sqlite3 = require('sqlite3');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const fastify = Fastify({
  logger: false,
  https: {
    key: fs.readFileSync('/service/service.key'),
    cert: fs.readFileSync('/service/service.crt'),
  },
});

const { Agent } = require('undici');

const dispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

const DB_PATH = '/app/data/database.db';

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'dist'),
  prefix: '/',
});

fastify.register(fastifyCookie, {
  secret: 'super_secret_key_32_chars',
});

fastify.get('/', (req, reply) => {
  reply.sendFile('index.html');
});

function openDb() {
  const db = new sqlite3.Database(DB_PATH);
  db.run('PRAGMA journal_mode = WAL');
  return db;
}

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

  return await res.json(); // { id, username }
}

fastify.post('/session/create', async (req, reply) => {
  try {
    const me = await getCurrentUser(req, reply);
    if (!me) {
      return reply.code(401).send({ error: 'Not authenticated as Player 1' });
    }

    const { player2Username, player2Password, otp } = req.body || {};
    if (!player2Username || !player2Password || !otp) {
      return reply
        .code(400)
        .send({ error: 'Player 2 username, password and otp are required' });
    }

    const verifyRes = await fetch(
      'https://login_service:3000/verifyCredentials',
      {
        method: 'POST',
        dispatcher,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: player2Username,
          password: player2Password,
          otp,
        }),
      },
    );

    if (!verifyRes.ok) {
      const errBody = await verifyRes.json().catch(() => ({}));
      return reply
        .code(400)
        .send({ error: errBody.error || 'Invalid Player 2 credentials' });
    }

    const player2 = await verifyRes.json();

    if (player2.id === me.id) {
      return reply
        .code(400)
        .send({ error: 'Player 2 must be a different account' });
    }

    const db = openDb();
    try {
      // Clean up stale sessions first (handles crashed browsers, etc.)
      await cleanupStaleSessions(db, me.id);
      await cleanupStaleSessions(db, player2.id);

      const sessionId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO game_sessions (player1_id, player2_id)
           VALUES (?, ?)`,
          [me.id, player2.id],
          function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
          },
        );
      });

      const pairingToken = crypto.randomBytes(32).toString('hex');

      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO session_pairings (player1_id, player2_id, token)
           VALUES (?, ?, ?)`,
          [me.id, player2.id, pairingToken],
          (err) => (err ? reject(err) : resolve(null)),
        );
      });

      return reply.send({
        sessionId,
        pairingToken,
        player1: { id: me.id, username: me.username },
        player2: { id: player2.id, username: player2.username },
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('Error in /session/create:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.post('/session/create_ai', async (req, reply) => {
  try {
    const me = await getCurrentUser(req, reply);
    if (!me)
      return reply.code(401).send({ error: 'Not authenticated as Player 1' });

    const db = openDb();
    try {
      // Clean up stale sessions first (handles crashed browsers, etc.)
      await cleanupStaleSessions(db, me.id);

      const sessionId = await new Promise((resolve, reject) => {
        // Use player2_id = 0 to indicate AI opponent
        db.run(
          `INSERT INTO game_sessions (player1_id, player2_id)
           VALUES (?, 0)`,
          [me.id],
          function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
          },
        );
      });

      return reply.send({
        sessionId,
        player1: { id: me.id, username: me.username },
        ai: { type: 'basic' },
        isAI: true,
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('Error in /session/create_ai:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.post('/session/finish', async (req, reply) => {
  console.log('/session/finish');
  // console.log(req.body);
  const { sessionId, scoreLeft, scoreRight, winnerIndex } = req.body || {};
  console.log(req.body);
  if (!sessionId)
    return reply.code(400).send({ error: 'sessionId is required' });

  const db = openDb();
  try {
    const row = await new Promise((resolve, reject) => {
      db.get(
        `SELECT player1_id, player2_id FROM game_sessions WHERE id = ?`,
        [sessionId],
        (err, data) => (err ? reject(err) : resolve(data)),
      );
    });

    if (!row) return reply.code(404).send({ error: 'Session not found' });

    const winner_id = winnerIndex === 1 ? row.player1_id : row.player2_id;

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE game_sessions
         SET ended_at  = CURRENT_TIMESTAMP,
             score1    = ?,
             score2    = ?,
             winner_id = ?
         WHERE id = ?`,
        [scoreLeft, scoreRight, winner_id, sessionId],
        (err) => (err ? reject(err) : resolve()),
      );
    });

    return reply.send({ ok: true });
  } catch (err) {
    console.error('Error in /session/finish:', err);
    return reply.code(500).send({ error: 'Database error' });
  } finally {
    db.close();
  }
});

fastify.post('/session/rematch', async (req, reply) => {
  const me = await getCurrentUser(req, reply);
  if (!me) return reply.code(401).send({ error: 'Not authenticated' });

  const { pairingToken } = req.body || {};
  if (!pairingToken) {
    return reply.code(400).send({ error: 'pairingToken required' });
  }

  const db = openDb();
  try {
    const pairing = await new Promise((resolve, reject) => {
      db.get(
        `SELECT player1_id, player2_id FROM session_pairings WHERE token = ?`,
        [pairingToken],
        (err, row) => (err ? reject(err) : resolve(row)),
      );
    });

    if (!pairing) {
      return reply.code(403).send({ error: 'Invalid pairing token' });
    }

    if (Number(pairing.player1_id) !== Number(me.id)) {
      return reply.code(403).send({ error: 'Pairing does not belong to you' });
    }

    const sessionId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO game_sessions (player1_id, player2_id)
         VALUES (?, ?)`,
        [pairing.player1_id, pairing.player2_id],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        },
      );
    });

    return reply.send({ sessionId });
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Rematch failed' });
  } finally {
    db.close();
  }
});

// Abandon a game session (when player leaves early)
// This marks the session as ended so players can start new games
fastify.post('/session/abandon', async (req, reply) => {
  const me = await getCurrentUser(req, reply);
  if (!me) return reply.code(401).send({ error: 'Not authenticated' });

  const { sessionId } = req.body || {};
  if (!sessionId)
    return reply.code(400).send({ error: 'sessionId is required' });

  const db = openDb();
  try {
    const session = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, player1_id, player2_id FROM game_sessions WHERE id = ? AND winner_id IS NULL`,
        [sessionId],
        (err, row) => (err ? reject(err) : resolve(row)),
      );
    });

    if (
      session &&
      (session.player1_id === me.id || session.player2_id === me.id)
    ) {
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE game_sessions SET ended_at = CURRENT_TIMESTAMP, winner_id = -1 WHERE id = ?`,
          [sessionId],
          (err) => (err ? reject(err) : resolve()),
        );
      });
      console.log(`Session ${sessionId} abandoned by user ${me.id}`);

      // Clean up AI session in game_service
      try {
        await fetch('https://game_service:3000/game/cleanup', {
          method: 'POST',
          dispatcher,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (err) {
        console.log('Failed to cleanup game_service session:', err.message);
      }
    }

    return reply.send({ ok: true });
  } catch (err) {
    console.error('Error in /session/abandon:', err);
    return reply.code(500).send({ error: 'Database error' });
  } finally {
    db.close();
  }
});

// Cleanup stale sessions (sessions that have been inactive for too long)
// This is called before creating new sessions to prevent stuck states
async function cleanupStaleSessions(db, userId) {
  // Mark sessions as abandoned if they've been active for more than 10 minutes without finishing
  // This handles cases where beforeunload didn't fire (crash, force quit, etc.)
  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE game_sessions 
       SET ended_at = CURRENT_TIMESTAMP, winner_id = -1 
       WHERE (player1_id = ? OR player2_id = ?) 
         AND winner_id IS NULL 
         AND started_at < datetime('now', '-10 minutes')`,
      [userId, userId],
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

fastify.get('/profile/me', async (req, reply) => {
  try {
    const me = await getCurrentUser(req, reply);
    if (!me) return reply.code(401).send({ error: 'Not authenticated' });

    const db = openDb();
    try {
      const stats = await new Promise((resolve, reject) => {
        db.get(
          `
          SELECT
            COUNT(*) AS games_played,
            SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS wins
          FROM game_sessions
          WHERE (player1_id = ? OR player2_id = ?)
            AND player2_id != 0
          `,
          [me.id, me.id, me.id],
          (err, row) => (err ? reject(err) : resolve(row || {})),
        );
      });

      const tour = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) AS tournaments_won
           FROM tournaments
           WHERE winner_id = ?`,
          [me.id],
          (err, row) => (err ? reject(err) : resolve(row || {})),
        );
      });

      const gamesPlayed = stats.games_played || 0;
      const wins = stats.wins || 0;
      const winrate = gamesPlayed > 0 ? wins / gamesPlayed : 0;
      const tournamentsWon = tour.tournaments_won || 0;

      return reply.send({
        id: me.id,
        username: me.username,
        gamesPlayed,
        wins,
        winrate,
        tournamentsWon,
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('Error in /profile/me:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.get('/profile/history', async (req, reply) => {
  try {
    const me = await getCurrentUser(req, reply);
    if (!me) return reply.code(401).send({ error: 'Not authenticated' });

    const db = openDb();
    try {
      const rows = await new Promise((resolve, reject) => {
        db.all(
          `
          SELECT 
            gs.id,
            gs.player1_id,
            gs.player2_id,
            u1.username AS player1_username,
            u2.username AS player2_username,
            gs.score1,
            gs.score2,
            gs.winner_id,
            gs.started_at,
            gs.ended_at,
            gs.tournament_id,
            t.name AS tournament_name
          FROM game_sessions gs
          JOIN users u1 ON gs.player1_id = u1.id
          LEFT JOIN users u2 ON gs.player2_id = u2.id
          LEFT JOIN tournaments t ON gs.tournament_id = t.id
          WHERE (gs.player1_id = ? OR gs.player2_id = ?)
            AND gs.player2_id != 0
          ORDER BY gs.started_at DESC
          LIMIT 50
          `,
          [me.id, me.id],
          (err, rows2) => (err ? reject(err) : resolve(rows2 || [])),
        );
      });

      return reply.send({ matches: rows });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('Error in /profile/history:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('✅ Main service running');
  console.log('Website available on https://localhost:1080');
});
