// Require the framework and instantiate it
// CommonJs
const fastify = require('fastify')({
  logger: false
})
const fs = require('fs')
const path = require('path')

fastify.post('/', async (request, reply) => {
  fastify.log.info('📦 Request Body:', request.body)
  console.log('/ receivged');
  console.log(request.body);
  reply.send({ received: request.body })
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