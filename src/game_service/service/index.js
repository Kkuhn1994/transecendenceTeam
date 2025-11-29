const fastify = require('fastify')({
  logger: false
})
const fs = require('fs')
const path = require('path')

// Declare a route
fastify.get('//tournament', function (request, reply) {

})

let ballSpeedX = 4, ballSpeedY = 4;
let scoreLeft = 0;
let scoreRight = 0;

fastify.post('//game', function (request, reply) {
  // console.log("route / test")
  // console.log(request.body)
  canvasheight = request.body.canvasheight
  canvaswidth = request.body.canvaswidth
  const paddleWidth = 10, paddleHeight = 100, ballSize = 10;
  let paddleSpeed = 4;
  let leftPaddleY = request.body.leftPaddleY;
  let rightPaddleY = request.body.rightPaddleY;
  let ballX = request.body.ballX, ballY = request.body.ballY;
 

  ballX += ballSpeedX;
  ballY += ballSpeedY;

  // Wall collision (Top/Bottom)
  if(ballY + ballSize > canvasheight || ballY - ballSize < 0)
  {
    ballSpeedY = -ballSpeedY;
  }

  // Paddle Collision
  // Left Paddle
  if (ballX - ballSize <= paddleWidth && ballY + ballSize >= leftPaddleY && ballY - ballSize <= leftPaddleY + paddleHeight) 
  {
    ballSpeedX = Math.abs(ballSpeedX); // Force move right
  }
  
  // Right Paddle
  if (ballX + ballSize >= canvaswidth - paddleWidth && ballY + ballSize >= rightPaddleY && ballY - ballSize <= rightPaddleY + paddleHeight) 
  {
    ballSpeedX = -Math.abs(ballSpeedX); // Force move left
  }

  // Scoring
  let winner = null;
  if (ballX < 0) {
    scoreRight++;
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;
    ballSpeedX = 4; // Reset speed direction
  } else if (ballX > canvaswidth) {
    scoreLeft++;
    ballX = canvaswidth / 2;
    ballY = canvasheight / 2;
    ballSpeedX = -4; // Reset speed direction
  }

  if (scoreLeft >= 11) {
    winner = "Player 1";
    scoreLeft = 0;
    scoreRight = 0;
  } else if (scoreRight >= 11) {
    winner = "Player 2";
    scoreLeft = 0;
    scoreRight = 0;
  }

  if(request.body.upPressed == true)
  {
    rightPaddleY -= paddleSpeed;
  }
  else if(request.body.downPressed == true)
  { 
    rightPaddleY += paddleSpeed;
  }
  if(request.body.wPressed == true)
  {
    leftPaddleY -= paddleSpeed;
  }
  else if(request.body.sPressed == true)
  {
    leftPaddleY += paddleSpeed;
  }

  // Constrain paddles to canvas
  leftPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, leftPaddleY));
  rightPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, rightPaddleY));

  reply.send({
    leftPaddleY,
    rightPaddleY,
    ballX,
    ballY,
    scoreLeft,
    scoreRight,
    winner
  });
})

// Run the server!
fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
   fastify.log.info(`Server running at ${address}`)
})
