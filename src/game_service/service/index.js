const fastify = require('fastify')({
  logger: false,
});
const DB_PATH = '/app/data/database.db';
const sqlite3 = require('sqlite3');
const { PongAI } = require('./opponent_ai.js');

// Game session storage
const gameSessions = new Map();

function openDb() {
  return new sqlite3.Database(DB_PATH);
}

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

// -------------------- GAME LOOP --------------------

async function setup_newgame(sessionId, body, db) {
  console.log('Setting up session:', sessionId);
  const canvasheight = body.canvasheight;
  const canvaswidth = body.canvaswidth;
  const isAI = body.isAI || false;
  
  // Initialize or get existing session
  if (!gameSessions.has(sessionId)) {
    console.log('Creating new game session');
    // Set initial speed to achieve magnitude 6
    const componentSpeed = 6 / Math.sqrt(2); // ≈ 4.24
    const gameSession = {
      currentSessionId: sessionId,
      ballSpeedX: componentSpeed,
      ballSpeedY: componentSpeed,
      scoreLeft: 0,
      scoreRight: 0,
      ballX: canvaswidth / 2,
      ballY: canvasheight / 2,
      leftPaddleY: canvasheight / 2,
      rightPaddleY: canvasheight / 2,
      isAI: isAI,
      ai: isAI ? new PongAI() : null,
      aiUpdateCounter: 0, // Limit AI calculations
      totalPointsPlayed: 0, // Track total points for speed progression
      baseSpeed: 6, // Starting speed that increases over time
      rallyTouches: 0 // Track paddle hits in current rally
    };
    gameSessions.set(sessionId, gameSession);
  } else {
    console.log('Using existing game session');
  }
  
  return gameSessions.get(sessionId);
}

async function game_logic_session(sessionId, gameSession, body, db) {
  let {
    ballSpeedX,
    ballSpeedY,
    scoreLeft,
    scoreRight,
    ballX,
    ballY,
    leftPaddleY,
    rightPaddleY
  } = gameSession;
  
  const { canvasheight, canvaswidth } = body;
  let { upPressed, downPressed, wPressed, sPressed } = body;
  
  // limit calculations to every 5 frames
  if (gameSession.isAI && gameSession.ai) {
    gameSession.aiUpdateCounter++;
    
    if (gameSession.aiUpdateCounter % 5 === 0) { // Only update AI every 5
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
    
    // Set AI input flags based on AI decision
    upPressed = gameSession.ai.shouldMoveUp(rightPaddleY, 100);
    downPressed = gameSession.ai.shouldMoveDown(rightPaddleY, 100);
  }
  
  const paddleWidth = 10,
    paddleHeight = 100,
    paddleSpeed = 4,
    ballSize = 10;

  // Paddle movement
  if (wPressed) leftPaddleY -= paddleSpeed;
  if (sPressed) leftPaddleY += paddleSpeed;
  if (upPressed) rightPaddleY -= paddleSpeed;
  if (downPressed) rightPaddleY += paddleSpeed;

  leftPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, leftPaddleY));
  rightPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, rightPaddleY));

  // Ball movement
  // Ball movement
  ballX += ballSpeedX;
  ballY += ballSpeedY;

  // Top/Bottom collision
  if (ballY <= 0 || ballY + ballSize >= canvasheight) {
    ballSpeedY *= -1;
  }

  // Paddle collisions
  if (
    ballX <= paddleWidth &&
    ballY + ballSize >= leftPaddleY &&
    ballY <= leftPaddleY + paddleHeight
  ) {
    ballSpeedX *= -1;
    ballX = paddleWidth;
    
    // Add 0.5 to the displayed speed
    const currentMagnitude = Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);
    const newMagnitude = Math.min(currentMagnitude + 0.5, 15); // Cap at 15
    const scale = newMagnitude / currentMagnitude;
    ballSpeedX *= scale;
    ballSpeedY *= scale;
  }

  if (
    ballX + ballSize >= canvaswidth - paddleWidth &&
    ballY + ballSize >= rightPaddleY &&
    ballY <= rightPaddleY + paddleHeight
  ) {
    ballSpeedX *= -1;
    ballX = canvaswidth - paddleWidth - ballSize;
    const currentMagnitude = Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);
    const newMagnitude = Math.min(currentMagnitude + 0.5, 15); // Cap at 15
    const scale = newMagnitude / currentMagnitude;
    ballSpeedX *= scale;
    ballSpeedY *= scale;
  }

  let winnerIndex = null;

  // Scoring
  if (ballX < 0) {
    scoreRight++;
    gameSession.totalPointsPlayed++;
    
    // Base magnitude of 6 + 0.5 per point scored
    const baseMagnitude = 6 + (gameSession.totalPointsPlayed * 0.5);
    
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;
    // Set speed to achieve target magnitude (45-degree angle)
    const componentSpeed = baseMagnitude / Math.sqrt(2);
    ballSpeedX = componentSpeed;
    ballSpeedY = componentSpeed * (Math.random() > 0.5 ? 1 : -1);
    gameSession.rallyTouches = 0; // Reset rally touches
  } else if (ballX > canvaswidth) {
    scoreLeft++;
    gameSession.totalPointsPlayed++;
    
    // Base magnitude of 6 + 0.5 per point scored
    const baseMagnitude = 6 + (gameSession.totalPointsPlayed * 0.5);
    
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;
    // Set speed to achieve target magnitude (45-degree angle)
    const componentSpeed = baseMagnitude / Math.sqrt(2);
    ballSpeedX = -componentSpeed;
    ballSpeedY = componentSpeed * (Math.random() > 0.5 ? 1 : -1);
    gameSession.rallyTouches = 0; // Reset rally touches
  }

  // Win condition
  if (scoreLeft >= 11) {
    winnerIndex = 1;
  } else if (scoreRight >= 11) {
    winnerIndex = 2;
  }

  // Update session data
  gameSession.ballSpeedX = ballSpeedX;
  gameSession.ballSpeedY = ballSpeedY;
  gameSession.scoreLeft = scoreLeft;
  gameSession.scoreRight = scoreRight;
  gameSession.ballX = ballX;
  gameSession.ballY = ballY;
  gameSession.leftPaddleY = leftPaddleY;
  gameSession.rightPaddleY = rightPaddleY;

  // Report to main_service when match ends
  if (winnerIndex) {
    try {
      await fetch('http://main_service:3000/session/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          scoreLeft,
          scoreRight,
          winnerIndex,
        }),
      });
    } catch (err) {
      console.error('Error calling /session/finish:', err);
    }

    // Reset for next match
    gameSession.scoreLeft = 0;
    gameSession.scoreRight = 0;
    
    // Start next match with progressive base magnitude (+0.3 per point)
    const baseMagnitude = 6 + (gameSession.totalPointsPlayed * 0.3);
    const componentSpeed = baseMagnitude / Math.sqrt(2);
    gameSession.ballSpeedX = componentSpeed;
    gameSession.ballSpeedY = componentSpeed;
    gameSession.ballX = canvaswidth / 2;
    gameSession.ballY = canvasheight / 2;
    gameSession.rallyTouches = 0;
    // Keep totalPointsPlayed to maintain game progression across matches
  }

  // Calculate current ball speed for display
  const currentBallSpeed = Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);

  return {
    leftPaddleY: gameSession.leftPaddleY,
    rightPaddleY: gameSession.rightPaddleY,
    ballX: gameSession.ballX,
    ballY: gameSession.ballY,
    scoreLeft: gameSession.scoreLeft,
    scoreRight: gameSession.scoreRight,
    ballSpeed: Math.round(currentBallSpeed * 10) / 10, // Round to 1 decimal place
    winnerIndex,
  };
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // this.lastID verfügbar
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

async function game_actions(sessionId, row, body, db) {
  // console.log(row);
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
  
  // AI Logic - use the same paddle movement system as human players
  const gameSession = gameSessions.get(sessionId);
  if (gameSession && gameSession.isAI && gameSession.ai) {
    const aiGameState = {
      ballX,
      ballY,
      ballSpeedX,
      ballSpeedY,
      rightPaddleY,
      canvasWidth: canvaswidth,
      canvasHeight: canvasheight,
      paddleHeight: paddleHeight,
      paddleWidth: paddleWidth
    };
    
    const targetY = gameSession.ai.update(aiGameState);
    const currentCenter = rightPaddleY + paddleHeight / 2;
    const targetCenter = targetY + paddleHeight / 2;
    const diff = targetCenter - currentCenter;
    
    // Set AI input flags to use same movement logic as human players
    if (diff < -2) {
      upPressed = true;
      downPressed = false;
    } else if (diff > 2) {
      upPressed = false;
      downPressed = true;
    } else {
      upPressed = false;
      downPressed = false;
    }
  }
  
  const paddleWidth = 10,
    paddleHeight = 100,
    paddleSpeed = 4,
    ballSize = 10;
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
  if (ballY <= 0 || ballY + ballSize >= canvasheight) {
    ballSpeedY *= -1;
  }
  if (
    ballX <= paddleWidth &&
    ballY + ballSize >= leftPaddleY &&
    ballY <= leftPaddleY + paddleHeight
  ) {
    ballSpeedX *= -1;
    ballX = paddleWidth;
  }
  if (
    ballX + ballSize >= canvaswidth - paddleWidth &&
    ballY + ballSize >= rightPaddleY &&
    ballY <= rightPaddleY + paddleHeight
  ) {
    ballSpeedX *= -1;
    ballX = canvaswidth - paddleWidth - ballSize;
  }
  if (ballX < 0) {
    scoreRight++;
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;
    ballSpeedX = 4;
  } else if (ballX > canvaswidth) {
    scoreLeft++;
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;
    ballSpeedX = -4;
  }
  let winnerIndex = null;
  if (scoreLeft >= 2) winnerIndex = 1;
  else if (scoreRight >= 2) winnerIndex = 2;
  const finalScoreLeft = scoreLeft;
  const finalScoreRight = scoreRight;
  if (winnerIndex) {
    try {
      await fetch('https://main_service:3000/session/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          scoreLeft: finalScoreLeft,
          scoreRight: finalScoreRight,
          winnerIndex,
        }),
      });
    } catch (err) {
      fastify.log.error('Error calling /session/finish:', err);
    }
    scoreLeft = 0;
    scoreRight = 0;
    ballSpeedX = 4;
    ballSpeedY = 4;
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;
    await db.run(
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
    );
  }
  await db.run(
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
  );
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
  console.log('game service 2');
  const db = openDb();
  console.log('game service 2');
  if (!me) {
    console.log('wrong session');
    return reply.code(401).send({ error: 'Not authenticated as Player 1' });
  }
  console.log('game service 2');
  try {
    const body = request.body || {};
    console.log(body.sessionId);
    const sessionId = body.sessionId;
    console.log('game service 3');
    if (!sessionId) {
      console.log('no session ID');
      return reply.code(400).send({ error: 'sessionId is required' });
    }

    // Use session-based approach instead of database
    let gameSession = gameSessions.get(sessionId);
    if (!gameSession) {
      console.log('new game');
      gameSession = await setup_newgame(sessionId, body, db);
    } else {
      console.log('continuing game');
    }

    // Run game logic with session data
    const result = await game_logic_session(sessionId, gameSession, body, db);
    return reply.send(result);
  } catch (err) {
    console.log('error in game route');
    fastify.log.error('Error in /game route:', err);
    return reply.code(500).send({ error: 'Game service error' });
  }
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server running at ${address}`);
});
