// Require the framework and instantiate it
// CommonJs
const fastify = require('fastify')({
  logger: false
})
const fs = require('fs')
const path = require('path')

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

fastify.post('/', async (request, reply) => {


  console.log('/ receivged');
  // const db = new sqlite3.Database('/app/data/database.db');
  fastify.log.info('📦 Request Body:', request.body)
  const { email, password } = request.body;
  console.log( email + password);
  
  console.log(request.body);
  reply.send({ received: request.body })
  //   db.run(
  // `INSERT INTO users (email, password) VALUES (?, ?)`,
  // [email, password],
  // function (err) {
  //   if (err) {
  //     fastify.log.error('❌ DB Error:', err);
  //     reply.status(500).send({ error: 'Database error' });
  //   } else {
  //     fastify.log.info(`✅ Inserted row with ID ${this.lastID}`);
  //     reply.send({ id: this.lastID, received: request.body });
  //   }
  // }
  // );
})

fastify.get('/messages', (request, reply) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      reply.status(500).send({ error: 'Database read error' });
    } else {
      reply.send(rows);
    }
  });
});

// Run the server!
fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
  //  fastify.log.info(`Server running at ${address}`)
})