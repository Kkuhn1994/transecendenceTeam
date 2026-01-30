const Fastify = require('fastify');
const DB_PATH = '/app/data/database.db';
const sqlite3 = require('sqlite3');

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
  return new sqlite3.Database(DB_PATH);
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
    ballSpeedX = BASE_SPEED;
    ballSpeedY = (Math.random() < 0.5 ? -1 : 1) * (BASE_SPEED * 0.6);
  } else if (ballX > canvaswidth) {
    scoreLeft++;
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;

    ballSpeedX = -BASE_SPEED;
    ballSpeedY = (Math.random() < 0.5 ? -1 : 1) * (BASE_SPEED * 0.6);
  }
  let winnerIndex = null;
  if (scoreLeft >= 2) winnerIndex = 1;
  else if (scoreRight >= 2) winnerIndex = 2;
  const finalScoreLeft = scoreLeft;
  const finalScoreRight = scoreRight;
  if (winnerIndex) {
    console.log(winnerIndex);
    console.log('winnerIndex');
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
  if (!me) {
    console.log('wrong session');
    return reply.code(401).send({ error: 'Not authenticated as Player 1' });
  }

  const db = openDb();
  try {
    const body = request.body || {};
    const sessionId = body.sessionId;

    if (!sessionId) {
      console.log('no session ID');
      return reply.code(400).send({ error: 'sessionId is required' });
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

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server running at ${address}`);
});
