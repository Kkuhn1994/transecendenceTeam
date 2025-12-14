const fastify = require('fastify')({ logger: false });
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pipeline } = require('stream');
const { promisify } = require('util');
const fastifyStatic = require('@fastify/static');
const fastifyCookie = require('@fastify/cookie');
const fastifyMultipart = require('@fastify/multipart');
const sqlite3 = require('sqlite3');

const DB_PATH = '/app/data/database.db';
const AVATARS_PATH = '/app/data/avatars';
const pump = promisify(pipeline);

// Ensure avatars directory exists
if (!fs.existsSync(AVATARS_PATH)) {
  fs.mkdirSync(AVATARS_PATH, { recursive: true });
}

// Ensure default avatar exists
const defaultAvatarPath = path.join(AVATARS_PATH, 'default.jpg');
if (!fs.existsSync(defaultAvatarPath)) {
  console.log('Default avatar not found at:', defaultAvatarPath);
}

// Static files from dist
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'dist'),
  prefix: '/',
});

// Serve avatar files
fastify.register(fastifyStatic, {
  root: AVATARS_PATH,
  prefix: '/avatars/',
  decorateReply: false
});

fastify.register(fastifyCookie, {
  secret: 'super_secret_key_32_chars',
});

fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  }
});

// Index: serve SPA
fastify.get('/', (req, reply) => {
  reply.sendFile('index.html');
});

/**
 * Helper: open db
 */
function openDb() {
  return new sqlite3.Database(DB_PATH);
}

/**
 * Helper: call login_service /auth/me
 */
async function getCurrentUser(req) {
  const res = await fetch('http://login_service:3000/auth/me', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: req.headers.cookie || '',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) return null;
  return await res.json(); // { id, email }
}

/**
 * Create a 1v1 game session
 * Body: { player2Email, player2Password }
 */
fastify.post('/session/create', async (req, reply) => {
  try {
    // 1) Player 1 via cookie
    const me = await getCurrentUser(req);
    if (!me) {
      return reply.code(401).send({ error: 'Not authenticated as Player 1' });
    }

    const { player2Email, player2Password } = req.body || {};
    if (!player2Email || !player2Password) {
      return reply
        .code(400)
        .send({ error: 'Player 2 email and password are required' });
    }

    // 2) Verify Player 2 credentials via login_service
    const verifyRes = await fetch('http://login_service:3000/verifyCredentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: player2Email, password: player2Password }),
    });

    if (!verifyRes.ok) {
      const errBody = await verifyRes.json().catch(() => ({}));
      return reply
        .code(400)
        .send({ error: errBody.error || 'Invalid Player 2 credentials' });
    }

    const player2 = await verifyRes.json(); // { status, id, email }

    // Optional: prevent playing vs yourself
    if (player2.id === me.id) {
      return reply
        .code(400)
        .send({ error: 'Player 2 must be a different account' });
    }

    // 3) Insert game session
    const db = openDb();
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
    }).finally(() => db.close());

    // 4) Return sessionId
    return reply.send({
      sessionId,
      player1: { id: me.id, email: me.email },
      player2: { id: player2.id, email: player2.email },
    });
  } catch (err) {
    console.error('Error in /session/create:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

/**
 * Finish session: called by game_service
 * Body: { sessionId, scoreLeft, scoreRight, winnerIndex }
 */
fastify.post('/session/finish', async (req, reply) => {
  const { sessionId, scoreLeft, scoreRight, winnerIndex } = req.body || {};

  if (!sessionId) {
    return reply.code(400).send({ error: 'sessionId is required' });
  }

  const db = openDb();

  try {
    const row = await new Promise((resolve, reject) => {
      db.get(
        `SELECT player1_id, player2_id FROM game_sessions WHERE id = ?`,
        [sessionId],
        (err, data) => (err ? reject(err) : resolve(data))
      );
    });

    if (!row) {
      return reply.code(404).send({ error: 'Session not found' });
    }

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
        (err) => (err ? reject(err) : resolve())
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

/**
 * Upload avatar for current user
 * POST /profile/avatar
 */
fastify.post('/profile/avatar', async (req, reply) => {
  try {
    const me = await getCurrentUser(req);
    if (!me) return reply.code(401).send({ error: 'Not authenticated' });

    // Get the uploaded file
    const data = await req.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Basic file type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' });
    }

    // Generate safe filename
    const fileExtension = data.mimetype.split('/')[1] === 'jpeg' ? 'jpg' : data.mimetype.split('/')[1];
    const filename = `${me.id}-${Date.now()}.${fileExtension}`;
    const filepath = path.join(AVATARS_PATH, filename);

    // Save file
    await pump(data.file, fs.createWriteStream(filepath));

    // Update user's avatar in database via login_service
    const updateRes = await fetch('http://login_service:3000/user/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: req.headers.cookie || '',
      },
      body: JSON.stringify({ avatar: `/avatars/${filename}` }),
    });

    if (!updateRes.ok) {
      // Clean up uploaded file if database update fails
      fs.unlinkSync(filepath);
      const errorData = await updateRes.json().catch(() => ({}));
      return reply.code(500).send({ error: errorData.error || 'Failed to update avatar' });
    }

    return reply.send({ 
      success: true, 
      avatar: `/avatars/${filename}` 
    });
  } catch (err) {
    console.error('Error uploading avatar:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

/**
 * Profile stats for current user
 * GET /profile/me
 */
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
        WHERE player1_id = ? OR player2_id = ?
        `,
        [me.id, me.id, me.id],
        (err, row) => (err ? reject(err) : resolve(row || {}))
      );
    }).finally(() => db.close());

    const gamesPlayed = stats.games_played || 0;
    const wins = stats.wins || 0;
    const winrate = gamesPlayed > 0 ? (wins / gamesPlayed) : 0;

    return reply.send({
      id: me.id,
      email: me.email,
      gamesPlayed,
      wins,
      winrate,
    });
  } catch (err) {
    console.error('Error in /profile/me:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

/**
 * Match history for current user
 * GET /profile/history
 */
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
          gs.ended_at
        FROM game_sessions gs
        JOIN users u1 ON gs.player1_id = u1.id
        JOIN users u2 ON gs.player2_id = u2.id
        WHERE gs.player1_id = ? OR gs.player2_id = ?
        ORDER BY gs.started_at DESC
        LIMIT 50
        `,
        [me.id, me.id],
        (err, rows) => (err ? reject(err) : resolve(rows || []))
      );
    }).finally(() => db.close());

    return reply.send({ matches: rows });
  } catch (err) {
    console.error('Error in /profile/history:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

/**
 * Get user statistics by ID (for viewing other users' profiles)
 * GET /profile/stats/:id
 */
fastify.get('/profile/stats/:id', async (req, reply) => {
  try {
    const userId = req.params.id;
    
    if (!userId) {
      return reply.code(400).send({ error: 'User ID required' });
    }

    const db = openDb();
    
    // Get basic stats
    const totalGames = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM game_sessions 
         WHERE (player1_id = ? OR player2_id = ?) AND winner_id IS NOT NULL`,
        [userId, userId],
        (err, row) => (err ? reject(err) : resolve(row?.count || 0))
      );
    });

    const wins = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM game_sessions WHERE winner_id = ?`,
        [userId],
        (err, row) => (err ? reject(err) : resolve(row?.count || 0))
      );
    }).finally(() => db.close());

    const winrate = totalGames > 0 ? wins / totalGames : 0;

    return reply.send({
      gamesPlayed: totalGames,
      wins: wins,
      winrate: winrate
    });
  } catch (err) {
    console.error('Error in /profile/stats/:id:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

// Run the server
fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('✅ Main service running at', address);
});
