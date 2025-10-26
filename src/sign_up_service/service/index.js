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

// Run the server!
fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
   fastify.log.info(`Server running at ${address}`)
})