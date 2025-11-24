// Require the framework and instantiate it
// CommonJs
const fastify = require('fastify')({
  logger: true
})
const fs = require('fs')
const path = require('path')

// Declare a route
fastify.get('/', function (request, reply) {
  console.log("route / test")
  const filePath = path.join(__dirname, 'index.html')
  const fileStream = fs.createReadStream(filePath)
  reply.type('text/html').send(fileStream)
})

let ballSpeedX = 4, ballSpeedY = 4;

fastify.post('//game', function (request, reply) {
  console.log("route / test")
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

  if(ballY > canvasheight || ballY < 0)
  {
    ballSpeedY = -ballSpeedY;
  }

  ///work on condition
  if (ballX + ballSize <= 0 + paddleWidth && ballY + ballSize >= leftPaddleY && ballY - ballSize <= leftPaddleY + paddleHeight) 
  {
    ballSpeedX = -ballSpeedX; // Abprallen
  }
  if (ballX + ballSize >= canvaswidth - paddleWidth && ballY + ballSize >= rightPaddleY || ballY - ballSize <= rightPaddleY + paddleHeight) 
  {
    ballSpeedX = -ballSpeedX; // Abprallen
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

  reply.send({
    leftPaddleY,
    rightPaddleY,
    ballX,
    ballY,
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