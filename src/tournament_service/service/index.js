
function setUpGameInDatabase(request)
{

}


fastify.post('/setupDatabase', function (request, reply) {

    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database('/app/data/database.db');
    setUpGameInDatabase(request);
})
