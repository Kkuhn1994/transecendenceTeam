// Require the framework and instantiate it
// CommonJs
const fastify = require('fastify')({
  logger: false
})
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const fastifyCookie = require('@fastify/cookie')
const { hashPassword } = require('./hash.js')



fastify.register(fastifyCookie, {
  session: "super_secret_key_32_chars",
});


fastify.post('/createAccount', async (request, reply) => {

  console.log("create Account");
  const sqlite3 = require('sqlite3');
 
 const db = new sqlite3.Database('/app/data/database.db');
console.log("create Account2");
  fastify.log.info('📦 Request Body:', request.body)
  console.log(request.body)
  const { email, password } = request.body;
  var hashedPassword = hashPassword(password);
  console.log(hashedPassword)
  db.run(
  `INSERT INTO users (email, password) VALUES (?, ?)`,
  [email, hashedPassword],
  function (err) {
    console.log("create Account3");
    if (err) {
      fastify.log.error('❌ DB Error:', err);
    } else {
      fastify.log.info(`✅ Inserted row with ID ${this.lastID}`);
    }
  }
  );
  console.log("created Account");
})

fastify.post('/auth/me', (request, reply) => {
  console.log("check login")

  const sqlite3 = require('sqlite3');
  const db = new sqlite3.Database('/app/data/database.db');
  const { cookie } = request.body;
   db.get(
  `SELECT email FROM users WHERE session_cookie= ?`,
  [cookie],
  (err, row) => {
    if (err) {
      console.log("Database error")
    }
    if (!row) {
      console.log("Invalid cookie")
    }
    reply.code(200).send({ email: row.email });
  }
  );

})

fastify.post('/loginAccount', (request, reply) => {
console.log("login")

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/app/data/database.db');
console.log("login2")
const { email, password } = request.body;
var hashedPassword = hashPassword(password);
console.log("login3")
  db.get(
  `SELECT email FROM users WHERE email= ? and password= ?`,
  [email, hashedPassword],
  (err, row) => {
    console.log("login3")
    if (err) {
      console.log("Database error")
    }

    if (!row) {
      console.log("Invalid email or password")
    }
    console.log("login4")
    const sessionCookie = crypto.randomBytes(32).toString("hex");

    console.log(sessionCookie)
    db.run(
      'UPDATE users SET session_cookie = ? WHERE email = ?',
      [sessionCookie, email],
      (err) => {
        if (err) {
          console.log('Error updating session cookie');
        } else {
          console.log('Session cookie updated successfully');
        }
      }
    );
    reply.setCookie("session", sessionCookie, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        path: "/",  
        maxAge: 60 * 60 * 24   // 1 Tag in Sekunden
    });
    console.log("login successful")
    return reply.send("Login successful");
  }
  );
})

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})

fastify.addHook('onReady', () => {
  console.log('✅ Fastify ready and listening on port 3000');
  console.log(fastify.printRoutes());
  // reply.setCookie("secret", "super_secret_key_32_chars", { signed: true })
});