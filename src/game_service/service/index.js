const Fastify = require('fastify');
const DB_PATH = '/app/data/database.db';
const sqlite3 = require('sqlite3');
const { PongAI } = require('./opponent_ai.js');

// Game session storage for AI opponents
const gameSessions = new Map();

// Per-session locks to prevent overlapping requests for the same session
const sessionLocks = new Map();

/**
 * Acquire a lock for a specific session to prevent race conditions.
 * Requests for the same sessionId will queue up and execute sequentially.
 */
async function withSessionLock(sessionId, fn) {
  // Wait for any existing operation on this session to complete
  while (sessionLocks.has(sessionId)) {
    try {
      await sessionLocks.get(sessionId);
    } catch (e) {
      // Previous operation failed, that's okay, we can proceed
    }
  }
  
  // Create our lock promise
  let resolveLock, rejectLock;
  const lockPromise = new Promise((resolve, reject) => {
    resolveLock = resolve;
    rejectLock = reject;
  });
  sessionLocks.set(sessionId, lockPromise);
  
  try {
    const result = await fn();
    resolveLock();
    return result;
  } catch (err) {
    rejectLock(err);
    throw err;
  } finally {
    sessionLocks.delete(sessionId);
  }
}

const https = require('https');
const fs = require('fs');

const fastify = Fastify({
  logger: true,
  https: {
    key: fs.readFileSync('/service/service.key'),
    cert: fs.readFileSync('/service/service.crt'),
  },
});

function openDb() {
  const db = new sqlite3.Database(DB_PATH);
  db.run('PRAGMA journal_mode = WAL');
  return db;
}

// const https = require('https');

const { Agent } = require('undici');

const dispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
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

// -------------------- GAME LOOP --------------------

async function setup_newgame(sessionId, body, db) {
  const canvasheight = Number(body.canvasheight);
  const canvaswidth = Number(body.canvaswidth);
  const isAI = body.isAI || false;

  // Always clean up any existing AI session for this sessionId first
  if (gameSessions.has(sessionId)) {
    gameSessions.delete(sessionId);
    console.log('Cleaned up existing AI session for sessionId:', sessionId);
  }

  // For AI games, create a fresh AI session
  if (isAI) {
    const gameSession = {
      currentSessionId: sessionId,
      ballSpeedX: 4,
      ballSpeedY: 4,
      scoreLeft: 0,
      scoreRight: 0,
      ballX: canvaswidth / 2,
      ballY: canvasheight / 2,
      leftPaddleY: (canvasheight - 100) / 2,
      rightPaddleY: (canvasheight - 100) / 2,
      isAI: true,
      ai: new PongAI(),
      aiUpdateCounter: 0,
    };
    gameSessions.set(sessionId, gameSession);
    console.log('Created new AI session for sessionId:', sessionId);
  }

  const paddleHeight = 100;

  const ballX = canvaswidth / 2;
  const ballY = canvasheight / 2;

  const leftPaddleY = (canvasheight - paddleHeight) / 2;
  const rightPaddleY = (canvasheight - paddleHeight) / 2;

  // IMPORTANT: DB schema uses ballSpeedX / ballSpeedY (capital X/Y)
  const ballSpeedX = 4;
  const ballSpeedY = 4;

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO game_data
        (sessionId, scoreLeft, scoreRight, ballSpeedX, ballSpeedY,
         canvaswidth, canvasheight, leftPaddleY, rightPaddleY, ballX, ballY)
       VALUES (?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        ballSpeedX,
        ballSpeedY,
        canvaswidth,
        canvasheight,
        leftPaddleY,
        rightPaddleY,
        ballX,
        ballY,
      ],
      (err) => (err ? reject(err) : resolve(null)),
    );
  });

  // Return the created row so game_actions gets real numbers
  return await getAsync(db, `SELECT * FROM game_data WHERE sessionId = ?`, [
    sessionId,
  ]);
}


function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function speedOf(vx, vy) {
  return Math.sqrt(vx * vx + vy * vy);
}

async function game_actions(sessionId, row, body, db) {
  let {
    canvasheight,
    canvaswidth,
    leftPaddleY,
    rightPaddleY,
    ballX,
    ballY,
    ballSpeedX,
    ballSpeedY,
    scoreLeft,
    scoreRight,
  } = row;
  let { upPressed, downPressed, wPressed, sPressed } = body;
  const isAI = body.isAI || false;
  
  // AI opponent logic
  if (isAI && gameSessions.has(sessionId)) {
    const gameSession = gameSessions.get(sessionId);
    gameSession.aiUpdateCounter++;
    
    // Update AI every 5 frames for performance
    if (gameSession.aiUpdateCounter % 5 === 0) {
      const aiGameState = {
        ballX,
        ballY,
        ballSpeedX,
        ballSpeedY,
        rightPaddleY,
        canvasWidth: canvaswidth,
        canvasHeight: canvasheight,
        paddleHeight: 100,
        paddleWidth: 10
      };
      
      gameSession.ai.update(aiGameState);
    }
    
    // Override AI player input (right paddle)
    upPressed = gameSession.ai.shouldMoveUp(rightPaddleY, 100);
    downPressed = gameSession.ai.shouldMoveDown(rightPaddleY, 100);
  }
  
  const paddleWidth = 10,
    paddleHeight = 100,
    paddleSpeed = 4,
    ballSize = 10;
  const BASE_SPEED = 4;
  const MAX_SPEED = 10;
  const SPEEDUP_PER_HIT = 1.06;     // 6% faster each paddle contact
  const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60 degrees
  const SPIN = 1.2; // how much paddle movement affects Y on impact

  // paddleDY is -paddleSpeed, 0, or +paddleSpeed depending on keys
  const leftDY = (sPressed ? paddleSpeed : 0) + (wPressed ? -paddleSpeed : 0);
  const rightDY = (downPressed ? paddleSpeed : 0) + (upPressed ? -paddleSpeed : 0);

  if (wPressed) leftPaddleY -= paddleSpeed;
  if (sPressed) leftPaddleY += paddleSpeed;
  if (upPressed) rightPaddleY -= paddleSpeed;
  if (downPressed) rightPaddleY += paddleSpeed;
  leftPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, leftPaddleY));
  rightPaddleY = Math.max(
    0,
    Math.min(canvasheight - paddleHeight, rightPaddleY),
  );
  ballX += ballSpeedX;
  ballY += ballSpeedY;
  if (ballY <= 0) {
    ballY = 0;
    ballSpeedY *= -1;
  }
  if (ballY + ballSize >= canvasheight) {
    ballY = canvasheight - ballSize;
    ballSpeedY *= -1;
  }

  // prevent boring perfectly flat shots
  if (Math.abs(ballSpeedY) < 0.25) {
    ballSpeedY = ballSpeedY < 0 ? -0.25 : 0.25;
  }

  const ballCenterY = ballY + ballSize / 2;

  // LEFT paddle collision
  if (
    ballX <= paddleWidth &&
    ballX >= 0 && // avoid weird multi-bounce when already behind
    ballY + ballSize >= leftPaddleY &&
    ballY <= leftPaddleY + paddleHeight
  ) {
    // Where did we hit the paddle? (-1 top, 0 middle, +1 bottom)
    const paddleCenterY = leftPaddleY + paddleHeight / 2;
    const rel = (ballCenterY - paddleCenterY) / (paddleHeight / 2);
    const hit = clamp(rel, -1, 1);

    // Convert hit location to bounce angle
    const angle = hit * MAX_BOUNCE_ANGLE;

    // Increase speed over rally
    let s = speedOf(ballSpeedX, ballSpeedY);
    s = clamp(s * SPEEDUP_PER_HIT, BASE_SPEED, MAX_SPEED);

    // Apply spin from paddle movement
    const spinY = (leftDY / paddleSpeed) * SPIN; // -SPIN..+SPIN

    ballSpeedX = Math.cos(angle) * s;          // to the right
    ballSpeedY = Math.sin(angle) * s + spinY;  // angle + spin

    // push ball outside paddle to prevent sticking
    ballX = paddleWidth;
  }
  // RIGHT paddle collision
  else if (
    ballX + ballSize >= canvaswidth - paddleWidth &&
    ballX + ballSize <= canvaswidth && // avoid weird multi-bounce when already past edge
    ballY + ballSize >= rightPaddleY &&
    ballY <= rightPaddleY + paddleHeight
  ) {
    const paddleCenterY = rightPaddleY + paddleHeight / 2;
    const rel = (ballCenterY - paddleCenterY) / (paddleHeight / 2);
    const hit = clamp(rel, -1, 1);

    const angle = hit * MAX_BOUNCE_ANGLE;

    let s = speedOf(ballSpeedX, ballSpeedY);
    s = clamp(s * SPEEDUP_PER_HIT, BASE_SPEED, MAX_SPEED);

    const spinY = (rightDY / paddleSpeed) * SPIN;

    ballSpeedX = -Math.cos(angle) * s;         // to the left
    ballSpeedY = Math.sin(angle) * s + spinY;

    ballX = canvaswidth - paddleWidth - ballSize;
  }
  if (ballX < 0) {
    scoreRight++;
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;

    // serve toward the player who conceded (to keep it fair-ish)
    // Use same initial speed as game start: √(4² + 4²) ≈ 5.66
    ballSpeedX = BASE_SPEED;
    ballSpeedY = (Math.random() < 0.5 ? -1 : 1) * BASE_SPEED;
  } else if (ballX > canvaswidth) {
    scoreLeft++;
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;

    // Use same initial speed as game start: √(4² + 4²) ≈ 5.66
    ballSpeedX = -BASE_SPEED;
    ballSpeedY = (Math.random() < 0.5 ? -1 : 1) * BASE_SPEED;
  }
  let winnerIndex = null;
  if (scoreLeft >= 2) winnerIndex = 1;
  else if (scoreRight >= 2) winnerIndex = 2;
  const finalScoreLeft = scoreLeft;
  const finalScoreRight = scoreRight;
  if (winnerIndex) {
    console.log(winnerIndex);
    console.log('winnerIndex');
    
    // Clean up AI session if it exists
    if (gameSessions.has(sessionId)) {
      gameSessions.delete(sessionId);
      console.log('AI session cleaned up for sessionId:', sessionId);
    }
    
    try {
      await fetch('https://main_service:3000/session/finish', {
        method: 'POST',
        dispatcher,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          scoreLeft: finalScoreLeft,
          scoreRight: finalScoreRight,
          winnerIndex,
        }),
      });
    } catch (err) {
      console.log('error');
      fastify.log.error('Error calling /session/finish:', err);
    }

    ballSpeedX = 4;
    ballSpeedY = 4;
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;
    await new Promise((resolve, reject) => {
      db.run(
        `
      UPDATE game_data
      SET
        scoreLeft = ?,
        scoreRight = ?,
        ballSpeedX = ?,
        ballSpeedY = ?,
        canvaswidth = ?,
        canvasheight = ?,
        leftPaddleY = ?,
        rightPaddleY = ?,
        ballX = ?,
        ballY = ?
      WHERE sessionId = ?
      `,
        [
          0,
          0,
          ballSpeedX,
          ballSpeedY,
          canvaswidth,
          canvasheight,
          leftPaddleY,
          rightPaddleY,
          ballX,
          ballY,
          sessionId,
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
    return {
      ballX,
      ballY,
      ballSpeedX,
      ballSpeedY,
      leftPaddleY,
      rightPaddleY,
      scoreLeft,
      scoreRight,
      winnerIndex,
    };
  }
  await new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE game_data
      SET
        scoreLeft = ?,
        scoreRight = ?,
        ballSpeedX = ?,
        ballSpeedY = ?,
        canvaswidth = ?,
        canvasheight = ?,
        leftPaddleY = ?,
        rightPaddleY = ?,
        ballX = ?,
        ballY = ?
      WHERE sessionId = ?
      `,
      [
        scoreLeft,
        scoreRight,
        ballSpeedX,
        ballSpeedY,
        canvaswidth,
        canvasheight,
        leftPaddleY,
        rightPaddleY,
        ballX,
        ballY,
        sessionId,
      ],
      (err) => (err ? reject(err) : resolve())
    );
  });
  return {
    ballX,
    ballY,
    ballSpeedX,
    ballSpeedY,
    leftPaddleY,
    rightPaddleY,
    scoreLeft,
    scoreRight,
    winnerIndex,
  };
}

fastify.post('/game', async function (request, reply) {
  console.log('game service');

  const me = await getCurrentUser(request);
  if (!me) {
    console.log('wrong session');
    return reply.code(401).send({ error: 'Not authenticated as Player 1' });
  }

  const body = request.body || {};
  const sessionId = body.sessionId;

  if (!sessionId) {
    console.log('no session ID');
    return reply.code(400).send({ error: 'sessionId is required' });
  }

  // Use session lock to prevent overlapping requests for the same session
  // This prevents the read-compute-write race condition that causes rubberbanding
  return withSessionLock(sessionId, async () => {
    const db = openDb();
    try {
      // Verify user is player1 in this game session
      const gameSessionRecord = await new Promise((resolve, reject) => {
        db.get(
          'SELECT player1_id, player2_id, tournament_id FROM game_sessions WHERE id = ?',
          [sessionId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      if (!gameSessionRecord) {
        console.log('Game session not found:', sessionId);
        return reply.code(404).send({ error: 'Game session not found' });
      }

      // Check if user has permission to control this game
      let hasPermission = false;
      
      // Allow if user is player1 or player2
      if (gameSessionRecord.player1_id === me.id || gameSessionRecord.player2_id === me.id) {
        hasPermission = true;
      }
      
      // For tournament games, allow any participant in the tournament to control the game
      if (!hasPermission && gameSessionRecord.tournament_id) {
        const tournamentParticipant = await new Promise((resolve, reject) => {
          db.get(
            `SELECT 1 FROM tournament_matches 
             WHERE tournament_id = ? AND (player1_id = ? OR player2_id = ?)
             LIMIT 1`,
            [gameSessionRecord.tournament_id, me.id, me.id],
            (err, row) => (err ? reject(err) : resolve(row))
          );
        });
        if (tournamentParticipant) {
          hasPermission = true;
        }
      }
      
      if (!hasPermission) {
        console.log('User', me.id, 'is not a player in session', sessionId);
        return reply.code(403).send({ error: 'You are not a player in this game' });
      }

      // 1) get row
      let row = await getAsync(db, `SELECT * FROM game_data WHERE sessionId = ?`, [
        sessionId,
      ]);

      // 2) if missing, create & fetch row
      if (!row) {
        console.log('new game');
        row = await setup_newgame(sessionId, body, db);
      } else {
        console.log('old game');
        const isAI = body.isAI || false;
        
        // Handle AI session mismatch for existing games
        if (isAI && !gameSessions.has(sessionId)) {
          // AI game but no AI session - create one
          const aiSession = {
            currentSessionId: sessionId,
            ballSpeedX: 4,
            ballSpeedY: 4,
            scoreLeft: 0,
            scoreRight: 0,
            ballX: row.canvaswidth / 2,
            ballY: row.canvasheight / 2,
            leftPaddleY: row.leftPaddleY,
            rightPaddleY: row.rightPaddleY,
            isAI: true,
            ai: new PongAI(),
            aiUpdateCounter: 0,
          };
          gameSessions.set(sessionId, aiSession);
          console.log('Recreated AI session for existing game, sessionId:', sessionId);
        } else if (!isAI && gameSessions.has(sessionId)) {
          // Non-AI game but has AI session - clean it up
          gameSessions.delete(sessionId);
          console.log('Removed AI session from non-AI game, sessionId:', sessionId);
        }
      }

      // 3) step simulation
      const out = await game_actions(sessionId, row, body, db);

      return reply.send({
        leftPaddleY: out.leftPaddleY,
        rightPaddleY: out.rightPaddleY,
        ballX: out.ballX,
        ballY: out.ballY,
        scoreLeft: out.scoreLeft,
        scoreRight: out.scoreRight,
        winnerIndex: out.winnerIndex,
      });
    } catch (err) {
      console.log('error in game route');
      fastify.log.error('Error in /game route:', err);
      return reply.code(500).send({ error: 'Game service error' });
    } finally {
      db.close();
    }
  });
});

fastify.post('/game/reset', async (request, reply) => {
  const me = await getCurrentUser(request);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const db = openDb();
  try {
    const body = request.body || {};
    const sessionId = body.sessionId;
    if (!sessionId) return reply.code(400).send({ error: 'sessionId is required' });

    const canvaswidth = Number(body.canvaswidth) || 800;
    const canvasheight = Number(body.canvasheight) || 400;

    const paddleHeight = 100;

    const leftPaddleY = (canvasheight - paddleHeight) / 2;
    const rightPaddleY = (canvasheight - paddleHeight) / 2;

    const ballX = canvaswidth / 2;
    const ballY = canvasheight / 2;

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE game_data
         SET scoreLeft = 0,
             scoreRight = 0,
             ballSpeedX = 4,
             ballSpeedY = 4,
             canvaswidth = ?,
             canvasheight = ?,
             leftPaddleY = ?,
             rightPaddleY = ?,
             ballX = ?,
             ballY = ?
         WHERE sessionId = ?`,
        [canvaswidth, canvasheight, leftPaddleY, rightPaddleY, ballX, ballY, sessionId],
        (err) => (err ? reject(err) : resolve(null))
      );
    });

    return reply.send({ status: 'ok' });
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'reset failed' });
  } finally {
    db.close();
  }
});

// Cleanup AI session from memory (called when a game is abandoned)
fastify.post('/game/cleanup', async (request, reply) => {
  const body = request.body || {};
  const sessionId = body.sessionId;
  
  if (sessionId && gameSessions.has(sessionId)) {
    gameSessions.delete(sessionId);
    console.log(`AI session cleaned up for sessionId: ${sessionId}`);
  }
  
  // Also clean up session lock if it exists
  if (sessionId && sessionLocks.has(sessionId)) {
    sessionLocks.delete(sessionId);
  }
  
  return reply.send({ ok: true });
});

// Cleanup ALL AI sessions for a specific user (called when user logs out or abandons all)
fastify.post('/game/cleanup-user', async (request, reply) => {
  const body = request.body || {};
  const userId = body.userId;
  
  if (!userId) {
    return reply.code(400).send({ error: 'userId required' });
  }
  
  const db = openDb();
  try {
    // Get all sessions for this user
    const sessions = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id FROM game_sessions WHERE (player1_id = ? OR player2_id = ?)`,
        [userId, userId],
        (err, rows) => (err ? reject(err) : resolve(rows || []))
      );
    });
    
    // Clean up AI sessions for all of them
    for (const session of sessions) {
      if (gameSessions.has(session.id)) {
        gameSessions.delete(session.id);
        console.log(`AI session cleaned up for sessionId: ${session.id}`);
      }
      if (sessionLocks.has(session.id)) {
        sessionLocks.delete(session.id);
      }
    }
    
    return reply.send({ ok: true, cleanedSessions: sessions.length });
  } catch (err) {
    console.error('Error in /game/cleanup-user:', err);
    return reply.code(500).send({ error: 'cleanup failed' });
  } finally {
    db.close();
  }
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server running at ${address}`);
});
