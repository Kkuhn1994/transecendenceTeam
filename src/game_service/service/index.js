// Require the framework and instantiate it
// CommonJs
const fastify = require('fastify')({
  logger: false
})
const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/app/data/database.db');

// Declare a route
fastify.get('/', function (request, reply) {
  // console.log("route / test")
  const filePath = path.join(__dirname, 'index.html')
  const fileStream = fs.createReadStream(filePath)
  reply.type('text/html').send(fileStream)
})

let ballSpeedX = 4, ballSpeedY = 4;
let leftPaddleY;
let rightPaddleY;
let ballX, ballY;
let paddleSpeed = 4;
const paddleWidth = 10, paddleHeight = 100, ballSize = 10;


function createGamesTableIfNotExists() {

    db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id    TEXT    UNIQUE NOT NULL,
            ballX         REAL    DEFAULT 400,
            ballY         REAL    DEFAULT 300,
            paddleLeftY   REAL    DEFAULT 250,
            paddleRightY  REAL    DEFAULT 250
        )
    `);
}


function searchGame(cookie) {
console.log("game search");
 let game = db.prepare(`
        SELECT ballX, ballY,
               paddleLeftY, paddleRightY
        FROM games 
        WHERE session_id = ?
    `).get(cookie);
console.log("game search3");
  return game;
}

function writeNewPositionsToDB(cookie) {

  db.prepare(`
      INSERT INTO games (session_id,
                        ballX, ballY,
                        paddleLeftY, paddleRightY)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
  `).run(cookie, ballX, ballY, leftPaddleY, leftPaddleX);

}

fastify.post('//game', function (request, reply) {
  console.log("game");
  createGamesTableIfNotExists();
  console.log("table created");
  const canvasheight = request.body.canvasheight
  const canvaswidth = request.body.canvaswidth
  const sessionCookie = req.cookies.session;
  game = searchGame(sessionCookie);
  console.log("game search");
  if(!game) {
    console.log("new game");
    leftPaddleY = canvasheight / 2;
    rightPaddleY = canvasheight / 2;
    ballX =  canvaswidth / 2, 
    ballY =  canvasheight / 2;
  }
  else {
    console.log("game search");
     console.log("old game");
    leftPaddleY = game.leftPaddleY;
    rightPaddleY = game.rightPaddleY;
    ballX =  game.ballX; 
    ballY =  game.ballY;
  }

  console.log("t")
  // console.log(request.body)
  
//  db.get(
//   `SELECT email FROM games WHERE game_session`,
//   [email, hashedPassword],
//   (err, row) => {
//     if (err) {
//       console.log("Database error")
//     }
//     if (!row) {
//       console.log("Invalid")
//     }

//     console.log("login successful")
//   }
//   );
  ballX += ballSpeedX;
  ballY += ballSpeedY;

  if(ballY > canvasheight || ballY < 0)
  {
    ballSpeedY = -ballSpeedY;
  }
  if (ballX + ballSize <= 0 + paddleWidth && ballY + ballSize >= leftPaddleY && ballY - ballSize <= leftPaddleY + paddleHeight) 
  {
    ballSpeedX = -ballSpeedX; // Abprallen
  }
  if (ballX + ballSize >= canvaswidth - paddleWidth && ballY + ballSize >= rightPaddleY && ballY - ballSize <= rightPaddleY + paddleHeight) 
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

  writeNewPositionsToDB(sessionCookie);

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