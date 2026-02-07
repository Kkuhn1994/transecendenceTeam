'use strict';

const Fastify = require('fastify');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const jwt = require('jsonwebtoken');
const fastifyCookie = require('@fastify/cookie');
const { Agent } = require('undici');

const { PongAI } = require('./opponent_ai.js');

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
// Game session storage for AI opponents
const gameSessions = new Map();

// Per-session locks to prevent overlapping requests for the same session
const sessionLocks = new Map();

// JWT verify cache: token -> { user, untilMs }
const authCache = new Map();

const liveState = new Map();

const permissionCache = new Map();

const PERM_TTL_MS = 30_000;

function openDb() {
  const db = new sqlite3.Database(DB_PATH);
  db.run('PRAGMA journal_mode = WAL');
  return db;
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
/**
 * JWT auth (LOCAL) with 2s cache
 */
function getCurrentUserLocal(req) {
  const token = req.cookies?.JWT;
  if (!token) return null;

  const now = Date.now();
  const hit = authCache.get(token);
  if (hit && hit.untilMs > now) return hit.user;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = {
      id: decoded.id,
      email: decoded.email,
      nickname: decoded.nickname,
      avatar: decoded.avatar,
    };
    authCache.set(token, { user, untilMs: now + 2000 });
    return user;
  } catch {
    return null;
  }
}
/**
 * Acquire a lock for a specific session to prevent race conditions.
 * Requests for the same sessionId will queue up and execute sequentially.
 */
async function withSessionLock(sessionId, fn) {
  while (sessionLocks.has(sessionId)) {
    try {
      await sessionLocks.get(sessionId);
    } catch {
      // previous op failed; proceed
    }
  }

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

// -------------------- GAME LOOP --------------------

function setup_newgame(sessionId, body) {
  const canvasheight = Number(body.canvasheight) || 400;
  const canvaswidth = Number(body.canvaswidth) || 800;

  const paddleHeight = 100;

  const ballX = canvaswidth / 2;
  const ballY = canvasheight / 2;

  const leftPaddleY = (canvasheight - paddleHeight) / 2;
  const rightPaddleY = (canvasheight - paddleHeight) / 2;

  return {
    sessionId,
    scoreLeft: 0,
    scoreRight: 0,
    ballSpeedX: 4,
    ballSpeedY: 4,
    canvaswidth,
    canvasheight,
    leftPaddleY,
    rightPaddleY,
    ballX,
    ballY,

    // optional fields from your schema if you want them in RAM too
    serveUntilMs: 0,
    serveVX: 0,
    serveVY: 0,
    rallyCount: 0,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function speedOf(vx, vy) {
  return Math.sqrt(vx * vx + vy * vy);
}

async function game_actions(sessionId, row, body) {
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

async function getAllowedIdsForSession(db, sessionId) {
  const row = await new Promise((resolve, reject) => {
    db.get(
      'SELECT player1_id, player2_id, tournament_id FROM game_sessions WHERE id = ?',
      [sessionId],
      (err, r) => (err ? reject(err) : resolve(r))
    );
  });

  if (!row) return null;

  const allowed = new Set([row.player1_id, row.player2_id]);

  // If it’s a tournament session, allow any participant (cache the whole set once)
  if (row.tournament_id) {
    const players = await new Promise((resolve, reject) => {
      db.all(
        `SELECT player1_id, player2_id
           FROM tournament_matches
          WHERE tournament_id = ?`,
        [row.tournament_id],
        (err, rows) => (err ? reject(err) : resolve(rows || []))
      );
    });

    for (const m of players) {
      if (m.player1_id) allowed.add(m.player1_id);
      if (m.player2_id) allowed.add(m.player2_id);
    }
  }

  return allowed;
}

fastify.post('/game', async function (request, reply) {
  const me = getCurrentUserLocal(request);
  if (!me) return reply.code(401).send({ error: 'Not authenticated' });

  const body = request.body || {};
  const sessionId = body.sessionId;
  if (!sessionId) return reply.code(400).send({ error: 'sessionId is required' });

  return withSessionLock(sessionId, async () => {
    // ---- permission check (cached) ----
    const now = Date.now();
    const cached = permissionCache.get(sessionId);

    let allowedIds = cached?.allowedIds;
    if (!allowedIds || cached.untilMs <= now) {
      const db = openDb();
      try {
        allowedIds = await getAllowedIdsForSession(db, sessionId);
        if (!allowedIds) return reply.code(404).send({ error: 'Game session not found' });

        permissionCache.set(sessionId, { allowedIds, untilMs: now + PERM_TTL_MS });
      } finally {
        db.close();
      }
    }

    if (!allowedIds.has(me.id)) {
      return reply.code(403).send({ error: 'You are not a player in this game' });
    }

    // ---- RAM state ----
    let row = liveState.get(sessionId);

    if (!row) {
      row = setup_newgame(sessionId, body);
      liveState.set(sessionId, row);
    }

    // ---- AI brain consistency ----
    const isAI = !!body.isAI;
    if (isAI && !gameSessions.has(sessionId)) {
      gameSessions.set(sessionId, {
        currentSessionId: sessionId,
        isAI: true,
        ai: new PongAI(),
        aiUpdateCounter: 0,
      });
    } else if (!isAI && gameSessions.has(sessionId)) {
      gameSessions.delete(sessionId);
    }

    const out = await game_actions(sessionId, row, body);

    if (!out.winnerIndex) {
      liveState.set(sessionId, { ...row, ...out });
    } else {
      liveState.delete(sessionId);
      gameSessions.delete(sessionId);
      permissionCache.delete(sessionId);
    }

    return reply.send({
      leftPaddleY: out.leftPaddleY,
      rightPaddleY: out.rightPaddleY,
      ballX: out.ballX,
      ballY: out.ballY,
      scoreLeft: out.scoreLeft,
      scoreRight: out.scoreRight,
      winnerIndex: out.winnerIndex,
    });
  });
});

fastify.post('/game/reset', async (request, reply) => {
  const me = getCurrentUserLocal(request);
  if (!me) return reply.code(401).send({ error: 'Not authenticated as Player 1' });

  const body = request.body || {};
  const sessionId = body.sessionId;
  if (!sessionId) return reply.code(400).send({ error: 'sessionId is required' });

  const canvaswidth = Number(body.canvaswidth) || 800;
  const canvasheight = Number(body.canvasheight) || 400;

  const fresh = setup_newgame(sessionId, { canvaswidth, canvasheight });
  liveState.set(sessionId, fresh);

  // also reset AI brain if it exists
  if (gameSessions.has(sessionId)) {
    const s = gameSessions.get(sessionId);
    s.ai = new PongAI();
    s.aiUpdateCounter = 0;
  }

  return reply.send({ status: 'ok' });
});
// Cleanup AI session from memory (called when a game is abandoned)
fastify.post('/game/cleanup', async (request, reply) => {
  const body = request.body || {};
  const sessionId = body.sessionId;
  
  if (sessionId && gameSessions.has(sessionId)) {
    gameSessions.delete(sessionId);
    console.log(`AI session cleaned up for sessionId: ${sessionId}`);
  }
  if (sessionId) {
    liveState.delete(sessionId);
  }
  permissionCache.delete(sessionId);
  
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
      liveState.delete(session.id);
    }
    permissionCache.delete(session.id);
    
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
