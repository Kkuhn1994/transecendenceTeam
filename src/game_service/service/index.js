const fastify = require('fastify')({
  logger: false,
});
const DB_PATH = '/app/data/database.db';
const sqlite3 = require('sqlite3');

let ballSpeedX = 4,
  ballSpeedY = 4;
let scoreLeft = 0,
  scoreRight = 0;

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
  console.log(sessionId);
  const canvasheight = body.canvasheight;
  const canvaswidth = body.canvaswidth;
  const ballX = body.canvaswidth / 2;
  const ballY = body.canvasheight / 2;
  const leftPaddleY = body.canvasheight / 2;
  const rightPaddleY = body.canvasheight / 2;
  await db.run(
    `INSERT INTO game_data \
    (sessionId, \
    scoreLeft, \
    scoreRight, \
    ballSpeedx, \
    ballSpeedY, \
    canvaswidth, \
    canvasheight, \
    leftPaddleY, \
    rightPaddleY,\
    ballX, \
    ballY) VALUES (?, 0, 0, 4, 4, ?, ?, ? ,? ,?, ?)`,
    [
      sessionId,
      canvaswidth,
      canvasheight,
      leftPaddleY,
      rightPaddleY,
      ballX,
      ballY,
    ],
    function (err) {
      if (err) {
        db.close();
        console.error('Error updating profile:', err);
        return;
      }
    },
  );
  console.log('new game added');
  await db.get(
    `SELECT * FROM game_data WHERE sessionId = ?`,
    [sessionId],
    (err, row) => {
      if (err) {
        return;
      }
      // console.log(row);
      return row;
    },
  );
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
  let { canvasheight, canvaswidth, leftPaddleY, rightPaddleY, ballX, ballY } =
    row;
  let { upPressed, downPressed, wPressed, sPressed } = body;
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

    const row = await getAsync(
      db,
      `SELECT * FROM game_data WHERE sessionId = ?`,
      [sessionId],
    );

    if (!row) {
      console.log('new game');
      const row = await setup_newgame(sessionId, body, db);
      // console.log(row);
      const {
        leftPaddleY,
        rightPaddleY,
        ballX,
        ballY,
        scoreLeft,
        scoreRight,
        winnerIndex,
      } = await game_actions(sessionId, row, body, db);
      return reply.send({
        leftPaddleY,
        rightPaddleY,
        ballX,
        ballY,
        scoreLeft: scoreLeft,
        scoreRight: scoreRight,
        winnerIndex,
      });
    } else {
      console.log('old game');

      const {
        leftPaddleY,
        rightPaddleY,
        ballX,
        ballY,
        scoreLeft,
        scoreRight,
        winnerIndex,
      } = await game_actions(sessionId, row, body, db);
      return reply.send({
        leftPaddleY,
        rightPaddleY,
        ballX,
        ballY,
        scoreLeft: scoreLeft,
        scoreRight: scoreRight,
        winnerIndex,
      });
    }
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
