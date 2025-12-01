const fastify = require('fastify')({ logger: false });
const path = require('path');
const fastifyStatic = require('@fastify/static');
const fastifyCookie = require('@fastify/cookie');
const sqlite3 = require('sqlite3');
const DEFAULT_SESSION = "here_will_be_the_session_key1234";

// Statisches Verzeichnis registrieren
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'dist'), // Serve from dist folder
  prefix: '/', // optional, URL-Präfix
});

fastify.register(fastifyCookie, {
  session: "super_secret_key_32_chars",
});


// Index-Route (optional, sendet index.html explizit)
fastify.get('/', (req, reply) => {
  console.log("set cookie")
  // reply.setCookie("session", "here_will_be_the_session_key1234", {
  //       httpOnly: true,
  //       secure: false,
  //       sameSite: "strict",
  //       path: "/",  
  //       maxAge: 60 * 60 * 24   // 1 Tag in Sekunden
  // });
  reply.sendFile('index.html'); // HTML über HTTP ausliefern
});

// fastify.post('/login',  async (req, reply) => {
//   console.log(`login buttton clicked`)
//   fastify.log.info('login button clicked')
//   const { email, password } = req.body
//    try {
//     const res = await fetch( '/login', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email, password })
//     })

//     // Antwort des anderen Containers lesen
//     const data = await res.json()
//     reply.send(data)
//   } catch (err) {
//     fastify.log.error(err.message)
//     reply.code(500).send({ error: 'Login-Service nicht erreichbar' })
//   }
// })

// NEW CODE STARTS HERE -------------------------------------------------------------------------

//    Creating a new game session, doesn't matter if for tournament or not, it will work both ways
// even if for now I though the logic for a 1v1, but tournament is just an id to tie the games together

async function setupGame(player1_id, player2_id)
{
    // 4) Insert the game session into the database
    const db = new sqlite3.Database(DB_PATH);

    const sessionId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO game_sessions (player1_id, player2_id)
         VALUES (?, ?)`,
        [player1_id, player2_id],
        function (err) {
          if (err) return reject(err);
          return resolve(this.lastID);
        }
      );
    }).finally(() => db.close());
}

fastify.post('/session/create', async (req, reply) => {
  console.log("hcreate session");
  console.log(req.headers.cookie);
  try {
    // 1) Get Player 1 ID via the authentication cookie
    const authResponse = await fetch('http://login_service:3000/auth/me', {
      method: 'POST', // Setze die Methode auf POST
      headers: {
        'Content-Type': 'application/json', // Falls du JSON sendest
        'Cookie': req.headers.cookie || '', // Cookie aus den Anfrage-Headern
      },
      body: JSON.stringify( req.headers.cookie ) // Falls du Daten im Body senden möchtest
    });

    if (!authResponse.ok) {
      fastify.log.error('auth/me failed with status', authResponse.status);
      return reply.code(401).send({ error: 'Not authenticated as Player 1' });
    }
console.log("hcreate session3");
    const me = await authResponse.json();
    console.log(req.body);
    //List with identgifiers

const playerIdentifiers = req.body;  // Dein JSON-Objekt (z.B. { playerName1: '2' })

// Füge einen neuen Schlüssel-Wert-Paar hinzu
playerIdentifiers['playerLoggedIn'] = me.email;

console.log(playerIdentifiers);
console.log("hcreate session4");
    // 3) Resolve Player 2's ID via login_service
   try {
  const resolveResponse = await fetch('http://login_service:3000/players/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playerIdentifiers) 
  });

  if (!resolveResponse.ok) {
    throw new Error('Failed to resolve player ID');
  }

  // const data = await resolveResponse.json();
  // console.log('Player resolved:', data);
} catch (error) {
  console.error('Error resolving player:', error);
}
console.log("hcreate session5");
    // resolveResponse will be a json of player1 player2 json --> nested
    //so resolved will be a list of jsons
    data.forEach(item => {
      let { player1_id ,player2_id } = item;
      setupGame(player1_id, player2_id);
    });
    // 5) Return sessionId to frontend
    return reply.send({ sessionId });

  } catch (err) {
    fastify.log.error('Error in /session/create:', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

// Populates the rest of the db entry with the missing information after a match is finished
fastify.post('/session/finish', async (req, reply) => {
  const { sessionId, scoreLeft, scoreRight, winnerIndex } = req.body || {};

  if (!sessionId) return reply.code(400).send({ error: 'sessionId is required' });

  const db = new sqlite3.Database(DB_PATH);

  try {
    // 1) Get player1_id and player2_id to determine the real winner_id
    const row = await new Promise((resolve, reject) => {
      db.get(
        `SELECT player1_id, player2_id FROM game_sessions WHERE id = ?`,
        [sessionId],
        (err, data) => {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });

    if (!row) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const winner_id =
      winnerIndex === 1 ? row.player1_id : row.player2_id;

    // 2) Update session with final values
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE game_sessions
         SET ended_at  = CURRENT_TIMESTAMP,
             score1    = ?,
             score2    = ?,
             winner_id = ?
         WHERE id = ?`,
        [scoreLeft, scoreRight, winner_id, sessionId],
        err => err ? reject(err) : resolve()
      );
    });

    return reply.send({ ok: true });

  } catch (err) {
    fastify.log.error('Error in /session/finish:', err);
    return reply.code(500).send({ error: 'Database error' });
  } finally {
    db.close();
  }
});

//END -----------------------------------------------------------------------------------------------

// Run the server!
fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
   fastify.log.info(`Server running at ${address}`)
})