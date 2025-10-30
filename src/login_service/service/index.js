// Require the framework and instantiate it
// CommonJs
const fastify = require('fastify')({
  logger: false
})
const fs = require('fs')
const path = require('path')

fastify.addHook('onReady', () => {
  console.log('✅ Fastify ready and listening on port 3000');
  console.log(fastify.printRoutes());
});


// fastify.post('/', async (request, reply) => {
//   // const db = new sqlite3.Database('/app/data/database.db');
//   // const { name, password } = request.body;
//   // console.log(name + message);
//   fastify.log.info('📦 Request Body:', request.body)
//   console.log('/ receivged');
//   console.log(request.body);
//   // db.run(
//   // `INSERT INTO messages (name, message) VALUES (?, ?)`,
//   // [name, message],
//   // function (err) {
//   //   if (err) {
//   //     fastify.log.error('❌ DB Error:', err);
//   //     reply.status(500).send({ error: 'Database error' });
//   //   } else {
//   //     fastify.log.info(`✅ Inserted row with ID ${this.lastID}`);
//   //     reply.send({ id: this.lastID, received: request.body });
//   //   }
//   // }
//   // );
// })

fastify.post('/createAccount', async (request, reply) => {

 const sqlite3 = require('sqlite3');
 console.log("create Account")
 const db = new sqlite3.Database('/app/data/database.db');

  fastify.log.info('📦 Request Body:', request.body)
  const { email, password } = request.body;
  db.run(
  `INSERT INTO users (email, password) VALUES (?, ?)`,
  [email, password],
  function (err) {
    if (err) {
      fastify.log.error('❌ DB Error:', err);
    } else {
      fastify.log.info(`✅ Inserted row with ID ${this.lastID}`);
    }
  }
  );
})

fastify.post('/loginAccount', async (request, reply) => {
console.log("login")

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/app/data/database.db');
const { email, password } = request.body;
  db.get(
  `SELECT email FROM users WHERE email= ? and password= ?`,
  [email, password],
  (err, row) => {
    if (err) {
      fastify.log.error('❌ DB Error:', err);
      console.log("Database error")
      return reply.status(500).send({ error: 'Database error' });

    }

    if (!row) {
      fastify.log.info(`❌ Login failed for ${email}`);
      console.log("Invalid email or password")
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    fastify.log.info(`✅ Login successful for ${email}`);
    reply.send({ message: 'Login successful' });
    console.log("Login successful")
  }
  );
})

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})