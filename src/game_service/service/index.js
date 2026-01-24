const fastify = require('fastify')({
  logger: false,
});

let currentSessionId = null;

let ballSpeedX = 4,
  ballSpeedY = 4;
let scoreLeft = 0,
  scoreRight = 0;

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

fastify.post('/game', async function (request, reply) {
  const me = await getCurrentUser(req);
  if (!me)
    return reply.code(401).send({ error: 'Not authenticated as Player 1' });
  try {
    const body = request.body || {};
    const sessionId = body.sessionId;

    if (!sessionId) {
      return reply.code(400).send({ error: 'sessionId is required' });
    }

    if (currentSessionId !== sessionId) {
      currentSessionId = sessionId;
      scoreLeft = 0;
      scoreRight = 0;
      ballSpeedX = 4;
      ballSpeedY = 4;
    }

    let {
      canvasheight,
      canvaswidth,
      leftPaddleY,
      rightPaddleY,
      ballX,
      ballY,
      upPressed,
      downPressed,
      wPressed,
      sPressed,
    } = body;

    const paddleWidth = 10,
      paddleHeight = 100,
      paddleSpeed = 4,
      ballSize = 10;

    if (wPressed) leftPaddleY -= paddleSpeed;
    if (sPressed) leftPaddleY += paddleSpeed;
    if (upPressed) rightPaddleY -= paddleSpeed;
    if (downPressed) rightPaddleY += paddleSpeed;

    leftPaddleY = Math.max(
      0,
      Math.min(canvasheight - paddleHeight, leftPaddleY),
    );
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
        await fetch('http://main_service:3000/session/finish', {
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
    }

    return reply.send({
      leftPaddleY,
      rightPaddleY,
      ballX,
      ballY,
      scoreLeft: finalScoreLeft,
      scoreRight: finalScoreRight,
      winnerIndex,
    });
  } catch (err) {
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
