const fastify = require('fastify')({ logger: false });
const path = require('path');
const fastifyStatic = require('@fastify/static');

// Statisches Verzeichnis registrieren
fastify.register(fastifyStatic, {
  root: path.join(__dirname), // index.html muss hier liegen
  prefix: '/', // optional, URL-Präfix
});

// Index-Route (optional, sendet index.html explizit)
fastify.get('/', (req, reply) => {
  reply.sendFile('index.html'); // HTML über HTTP ausliefern
});


fastify.post('/login',  async (req, reply) => {
  console.log(`login buttton clicked`)
  fastify.log.info('login button clicked')
  const { email, password } = req.body
   try {
    const res = await fetch( '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    // Antwort des anderen Containers lesen
    const data = await res.json()
    reply.send(data)
  } catch (err) {
    fastify.log.error(err.message)
    reply.code(500).send({ error: 'Login-Service nicht erreichbar' })
  }
})


// Run the server!
fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
  //  fastify.log.info(`Server running at ${address}`)
})