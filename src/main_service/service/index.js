const Fastify = require('fastify');
const path = require('path');
const fastifyStatic = require('@fastify/static');
const fastifyCookie = require('@fastify/cookie');
const sqlite3 = require('sqlite3');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const fastify = Fastify({
  logger: true,
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
  return new sqlite3.Database(DB_PATH);
}

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

fastify.post('/session/create', async (req, reply) => {
  try {
    const me = await getCurrentUser(req);
    if (!me) {
      return reply.code(401).send({ error: 'Not authenticated as Player 1' });
    }

    const { player2Email, player2Password, otp } = req.body || {};
    if (!player2Email || !player2Password || !otp) {
      return reply
        .code(400)
        .send({ error: 'Player 2 email, password and otp are required' });
    }

    const verifyRes = await fetch(
      'https://login_service:3000/verifyCredentials',
      {
        method: 'POST',
        dispatcher,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: player2Email,
          password: player2Password,
          otp,
        }),
      }
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
      const sessionId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO game_sessions (player1_id, player2_id)
           VALUES (?, ?)`,
          [me.id, player2.id],
          function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });

      const pairingToken = crypto.randomBytes(32).toString('hex');

      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO session_pairings (player1_id, player2_id, token)
           VALUES (?, ?, ?)`,
          [me.id, player2.id, pairingToken],
          (err) => (err ? reject(err) : resolve(null))
        );
      });

      return reply.send({
        sessionId,
        pairingToken,
        player1: { id: me.id, email: me.email },
        player2: { id: player2.id, email: player2.email },
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
    const me = await getCurrentUser(req);
    if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

    const db = openDb();
    try {
      const sessionId = await new Promise((resolve, reject) => {
        // Use player2_id = 0 to indicate AI opponent
        db.run(
          `INSERT INTO game_sessions (player1_id, player2_id)
           VALUES (?, 0)`,
          [me.id],
          function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });

      return reply.send({
        sessionId,
        player1: { id: me.id, email: me.email },
        ai: { type: 'basic' },
        isAI: true
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
  const me = await getCurrentUser(req);
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
        (err, row) => (err ? reject(err) : resolve(row))
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
        }
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


fastify.get('/profile/me', async (req, reply) => {
  try {
    const me = await getCurrentUser(req);
    if (!me) return reply.code(401).send({ error: 'Not authenticated' });

    const db = openDb();

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
    }).finally(() => db.close());

    const gamesPlayed = stats.games_played || 0;
    const wins = stats.wins || 0;
    const winrate = gamesPlayed > 0 ? wins / gamesPlayed : 0;
    const tournamentsWon = tour.tournaments_won || 0;

    return reply.send({
      id: me.id,
      email: me.email,
      gamesPlayed,
      wins,
      winrate,
      tournamentsWon,
    });
  } catch (err) {
    console.error('Error in /profile/me:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.get('/profile/history', async (req, reply) => {
  try {
    const me = await getCurrentUser(req);
    if (!me) return reply.code(401).send({ error: 'Not authenticated' });

    const db = openDb();
    const rows = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT 
          gs.id,
          gs.player1_id,
          gs.player2_id,
          u1.email AS player1_email,
          u2.email AS player2_email,
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
    }).finally(() => db.close());

    return reply.send({ matches: rows });
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
  console.log('✅ Main service running at', address);
});
