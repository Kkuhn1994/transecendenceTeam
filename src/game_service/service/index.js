const fastify = require('fastify')({
  logger: false,
});

let currentSessionId = null;
let ballSpeedX = 4, ballSpeedY = 4;
let scoreLeft = 0, scoreRight = 0;

fastify.post('/game', async function (request, reply) {
  try {
    const body = request.body || {};

    const sessionId = body.sessionId;
    if (!sessionId) {
      return reply.code(400).send({ error: 'sessionId is required' });
    }

    // Reset game state if new session
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

    // Paddle movement
    if (wPressed) leftPaddleY -= paddleSpeed;
    if (sPressed) leftPaddleY += paddleSpeed;
    if (upPressed) rightPaddleY -= paddleSpeed;
    if (downPressed) rightPaddleY += paddleSpeed;

    leftPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, leftPaddleY));
    rightPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, rightPaddleY));

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
    }

    if (
      ballX + ballSize >= canvaswidth - paddleWidth &&
      ballY + ballSize >= rightPaddleY &&
      ballY <= rightPaddleY + paddleHeight
    ) {
      ballSpeedX *= -1;
      ballX = canvaswidth - paddleWidth - ballSize;
    }

    let winnerIndex = null;

    // Scoring
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

    // Win condition
    if (scoreLeft >= 11) {
      winnerIndex = 1;
    } else if (scoreRight >= 11) {
      winnerIndex = 2;
    }

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
        fastify.log.error('Error calling /session/finish:', err);
      }

      // Reset for next match (same session or new)
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
      scoreLeft,
      scoreRight,
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
