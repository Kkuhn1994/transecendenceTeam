const fastify = require('fastify')({
  logger: false
})

const fs = require('fs')
const path = require('path')

// Declare a route
fastify.get('//tournament', function (request, reply) {

})

let currentSessionId = null;
let ballSpeedX = 4, ballSpeedY = 4;
let scoreLeft = 0;
let scoreRight = 0;

fastify.post("/game", async function (request, reply) {
  try {
    const body = request.body || {};

    // 1) Extract sessionId
    const sessionId = body.sessionId;
    if (!sessionId) {
      return reply.code(400).send({ error: "sessionId is required" });
    }

    // 2) Reset game state if starting a new session
    if (currentSessionId !== sessionId) {
      currentSessionId = sessionId;

      scoreLeft = 0;
      scoreRight = 0;

      ballSpeedX = 4;
      ballSpeedY = 4;
    }

    // 3) Extract values from frontend
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
      sPressed
    } = body;

    const paddleWidth = 10,
      paddleHeight = 100,
      paddleSpeed = 4,
      ballSize = 10;

    // 4) Paddle movement
    if (wPressed) leftPaddleY -= paddleSpeed;
    if (sPressed) leftPaddleY += paddleSpeed;
    if (upPressed) rightPaddleY -= paddleSpeed;
    if (downPressed) rightPaddleY += paddleSpeed;

    leftPaddleY = Math.max(
      0,
      Math.min(canvasheight - paddleHeight, leftPaddleY)
    );
    rightPaddleY = Math.max(
      0,
      Math.min(canvasheight - paddleHeight, rightPaddleY)
    );

    // 5) Ball movement
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    if (ballY <= 0 || ballY + ballSize >= canvasheight) {
      ballSpeedY *= -1;
    }

    // 6) Paddle collision
    if (
      ballX <= paddleWidth &&
      ballY + ballSize >= leftPaddleY &&
      ballY <= leftPaddleY + paddleHeight
    ) {
      ballSpeedX *= -1;
      ballX = paddleWidth; // prevent stuck
    }

    if (
      ballX + ballSize >= canvaswidth - paddleWidth &&
      ballY + ballSize >= rightPaddleY &&
      ballY <= rightPaddleY + paddleHeight
    ) {
      ballSpeedX *= -1;
      ballX = canvaswidth - paddleWidth - ballSize;
    }

    // 7) Scoring logic
    let winnerIndex = null;

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

    // 8) Win condition (score ≥ 11)
    if (scoreLeft >= 11) {
      winnerIndex = 1;
    } else if (scoreRight >= 11) {
      winnerIndex = 2;
    }

    // 9) Inform main_service when match ends
    if (winnerIndex) {
      try {
        await fetch("http://main_service:3000/session/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            scoreLeft,
            scoreRight,
            winnerIndex
          })
        });
      } catch (err) {
        fastify.log.error("Error calling /session/finish:", err);
      }
      // Reset for next match
      scoreLeft = 0;
      scoreRight = 0;
      ballSpeedX = 4;
      ballSpeedY = 4;

      ballX = canvaswidth / 2;
      ballY = canvasheight / 2;
    }

    // 10) Reply with updated game state
    return reply.send({
      leftPaddleY,
      rightPaddleY,
      ballX,
      ballY,
      scoreLeft,
      scoreRight,
      winnerIndex
    });

  } catch (err) {
    fastify.log.error("Error in /game route:", err);
    return reply.code(500).send({ error: "Game service error" });
  }
});


// Run the server!
fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
   fastify.log.info(`Server running at ${address}`)
})
