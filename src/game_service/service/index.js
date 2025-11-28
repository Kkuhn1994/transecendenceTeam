// Require the framework and instantiate it
// CommonJs
const fastify = require('fastify')({
  logger: false
})

fastify.register(require('@fastify/cookie'), {
  // optional: secret für signierte Cookies (empfohlen!)
  secret: "mein-geheimes-cookie-signier-secret-12345", // mind. 32 Zeichen in Prod!
  parseOptions: {}     // oder z.B. { httpOnly: true, sameSite: 'lax' }
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


async function searchGame(cookie) {
    return new Promise((resolve) => {
        console.log("test1 – Suche Spielstand für:", JSON.stringify(cookie));

        const stmt = db.prepare(`
            SELECT ballX, ballY, paddleLeftY, paddleRightY
            FROM games
            WHERE session_id = ?
        `);

        stmt.get(cookie, (err, row) => {
            if (err) {
            
                resolve(null);
            } else {
                 // ← hier siehst du endlich die Wahrheit!
                resolve(row);// row ist entweder das Objekt oder undefined
            }
        });

        stmt.finalize(); // sauber
        console.log(stmt);
    });
}

async function writeNewPositionsToDB(cookie) {
    return new Promise((resolve, reject) => {
        console.log("position new");
        db.prepare(`
            INSERT INTO games (session_id, ballX, ballY, paddleLeftY, paddleRightY)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                ballX = excluded.ballX,
                ballY = excluded.ballY,
                paddleLeftY = excluded.paddleLeftY,
                paddleRightY = excluded.paddleRightY
        `).run(cookie, ballX, ballY, leftPaddleY, rightPaddleY, function(err) {
            if (err) {
                console.error("DB Schreibfehler:", err);
                reject(err);
            } else {
                console.log("position new2 – erfolgreich gespeichert!");
                resolve();
            }
        });
    });
}
fastify.post('//game', async (request, reply) => {
 
  createGamesTableIfNotExists();
 
  const canvasheight = request.body.canvasheight
  const canvaswidth = request.body.canvaswidth
   const sessionCookie = request.cookies.session;
  console.log(sessionCookie);
  game = await searchGame(sessionCookie);
   console.log("game");
  console.log(game);
  if(!game || Object.keys(game).length == 0) {
    console.log("new game");
    leftPaddleY = canvasheight / 2;
    rightPaddleY = canvasheight / 2;
    ballX =  canvaswidth / 2, 
    ballY =  canvasheight / 2;
  }
  else {
    console.log("old game");
    leftPaddleY = game.leftPaddleY;
    rightPaddleY = game.rightPaddleY;
    ballX =  game.ballX; 
    ballY =  game.ballY;
    if(ballX < 0 || ballX > canvaswidth)
    {
      ballX = canvaswidth / 2;
    }
  }

  console.log("t")
  // console.log(request.body)
  

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
  if(!sessionCookie)
  {
    console.log('no cookie'); 
    return;
  }
  await writeNewPositionsToDB(sessionCookie);

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