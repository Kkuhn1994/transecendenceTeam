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

fastify.post('//game', function (request, reply) {
  console.log("route / test")
  console.log(request.body)
  canvasheight = request.body.canvasheight
  canvaswidth = request.body.canvaswidth
  const paddleWidth = 10, paddleHeight = 100, ballSize = 10;
  let paddleSpeed = 4;
  let leftPaddleY = (canvasheight - paddleHeight) / 2;
  let rightPaddleY = (canvasheight - paddleHeight) / 2;
  let ballX = request.body.ballX, ballY = request.body.ballY;
  let ballSpeedX = 4, ballSpeedY = 4;

  ballX += ballSpeedX;
  ballY += ballSpeedY;

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