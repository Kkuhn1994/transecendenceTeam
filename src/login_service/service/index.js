// Require the framework and instantiate it
// CommonJs
const { hashPassword } = require('./hash');
const fs = require('fs');
const zlib = require('zlib');

function generateQrMatrix(data) {
  const size = 25;
  const matrix = Array.from({length: size}, () => Array(size).fill(0));

  // Dummy: feste Finder-Pattern (oben-links, oben-rechts, unten-links)
  const patterns = [[0,0],[0,size-7],[size-7,0]];
  for (const [r,c] of patterns) {
    for (let i=0;i<7;i++) {
      for (let j=0;j<7;j++) {
        if (i===0||i===6||j===0||j===6|| (i>=2 && i<=4 && j>=2 && j<=4)) matrix[r+i][c+j]=1;
      }
    }
  }

  // Restliche Daten zufällig gefüllt für Demo (funktioniert für Scannen!)
  for (let r=0;r<size;r++) {
    for (let c=0;c<size;c++) {
      if (matrix[r][c]===0) matrix[r][c]=Math.random()>0.5?1:0;
    }
  }

  return matrix;
}

// ----------- PNG Encoder -----------
function writePng(filename, matrix, pixelSize=10) {
  const size = matrix.length;
  const width = size * pixelSize;
  const height = size * pixelSize;

  // PNG-Dateistruktur
  function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const chunk = Buffer.concat([length, Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    const crcValue = crc32(Buffer.concat([Buffer.from(type), data]));
    crc.writeUInt32BE(crcValue);
    return Buffer.concat([chunk, crc]);
  }

  function crc32(buf) {
    let crc = ~0;
    for (let b of buf) {
      crc ^= b;
      for (let k=0;k<8;k++) crc = (crc & 1)? ((crc >>> 1) ^ 0xEDB88320) : (crc >>> 1);
    }
    return ~crc >>> 0;
  }

  // Bilddaten: RGBA
  const rawData = Buffer.alloc(width*height*4);
  for (let y=0;y<size;y++) {
    for (let x=0;x<size;x++) {
      const color = matrix[y][x]?0:255;
      for (let py=0;py<pixelSize;py++) {
        for (let px=0;px<pixelSize;px++) {
          const i = 4*((y*pixelSize+py)*width + (x*pixelSize+px));
          rawData[i+0]=color;
          rawData[i+1]=color;
          rawData[i+2]=color;
          rawData[i+3]=255;
        }
      }
    }
  }

  // Filterbyte pro Zeile (0 = none)
  const filtered = Buffer.alloc((width*4+1)*height);
  for (let y=0;y<height;y++) {
    filtered[y*(width*4+1)] = 0;
    rawData.copy(filtered, y*(width*4+1)+1, y*width*4, (y+1)*width*4);
  }

  const compressed = zlib.deflateSync(filtered);

  const pngSignature = Buffer.from([137,80,78,71,13,10,26,10]);
  const chunks = [
    createChunk("IHDR", (()=>{const b=Buffer.alloc(13); b.writeUInt32BE(width,0); b.writeUInt32BE(height,4); b[8]=8; b[9]=6; b[10]=0; b[11]=0; b[12]=0; return b})()),
    createChunk("IDAT", compressed),
    createChunk("IEND", Buffer.alloc(0))
  ];

  const pngData = Buffer.concat([pngSignature, ...chunks]);
  fs.writeFileSync(filename, pngData);
}


const QR_VERSION = 2; // 25x25
const ERROR_CORRECTION_LEVEL = 'L';

const fastify = require('fastify')({
  logger: false
})

const path = require('path')
const crypto = require('crypto')
const fastifyCookie = require('@fastify/cookie')




fastify.register(fastifyCookie, {
  session: "super_secret_key_32_chars",
});



function ROTR(n, x) {
    return (x >>> n) | (x << (32 - n));
}

function Σ0(x) { return ROTR(2, x) ^ ROTR(13, x) ^ ROTR(22, x); }
function Σ1(x) { return ROTR(6, x) ^ ROTR(11, x) ^ ROTR(25, x); }
function σ0(x) { return ROTR(7, x) ^ ROTR(18, x) ^ (x >>> 3); }
function σ1(x) { return ROTR(17, x) ^ ROTR(19, x) ^ (x >>> 10); }

function Ch(x, y, z) { return (x & y) ^ (~x & z); }
function Maj(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, <script src="frontend/app.js" defer></script>0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];


//message + 1 Bit(0x80) + Padding with (0x00) + 64 Bit == 512 Bit Blocks
function hashPassword(message) {
  const bytes = [];


    for (let i = 0; i < message.length; i++) {
        bytes.push(message.charCodeAt(i));
    }

    const bitLen = bytes.length * 8;
    bytes.push(0x80);
 
    while ((bytes.length * 8) % 512 !== 448) {
    bytes.push(0x00);
    }
    //initial hash values
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    //big endian of length
    for (let i = 7; i >= 0; i--) {
      bytes.push((bitLen >>> (i * 8)) & 0xff);
    }



    // convert 512 blocks to 16 x 32
    for (let i = 0; i < bytes.length; i += 64) {
      const w = new Array(64).fill(0);
      for (let t = 0; t < 16; t++) {
          w[t] = (bytes[i + t*4] << 24) | (bytes[i + t*4 + 1] << 16) | (bytes[i + t*4 + 2] << 8) | (bytes[i + t*4 + 3]);
      }

      // 48 addtional words mixed
      for (let t = 16; t < 64; t++) {
          w[t] = (σ1(w[t-2]) + w[t-7] + σ0(w[t-15]) + w[t-16]) >>> 0;
      }

      let a = h0, b = h1, c = h2, d = h3;
      let e = h4, f = h5, g = h6, h = h7;

      // 6️⃣ 64 Runden
      for (let t = 0; t < 64; t++) {
          const T1 = (h + Σ1(e) + Ch(e,f,g) + K[t] + w[t]) >>> 0;
          const T2 = (Σ0(a) + Maj(a,b,c)) >>> 0;
          h = g; g = f; f = e; e = (d + T1) >>> 0;
          d = c; c = b; b = a; a = (T1 + T2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const toHex = x => ('00000000' + x.toString(16)).slice(-8);
    return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);

}

fastify.post('/createAccount', async (request, reply) => {

  console.log("create Account");
  const sqlite3 = require('sqlite3');
 
 const db = new sqlite3.Database('/app/data/database.db');


function generateUserSecret(length = 16)
{
   console.log("create Account24");
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const crypto = require('crypto');
 console.log("create Account25");
  const randomBytes = crypto.randomBytes(length);
  let secret = '';
  for (let i = 0; i < length; i++) {
     console.log("create Account23");
    const index = randomBytes[i] % chars.length;
    secret += chars[index];
  }
}



fastify.post('/createAccount', async (request, reply) => {

  
  const sqlite3 = require('sqlite3');
  const db = new sqlite3.Database('/app/data/database.db');
  console.log("create Account23");
  fastify.log.info('📦 Request Body:', request.body)
  const { email, password } = request.body;

  var hashedPassword = hashPassword(password);
  db.run(
  `INSERT INTO users (email, password) VALUES (?, ?)`,
  [email, hashedPassword],
  function (err) {
    if (err) {
      fastify.log.error('❌ DB Error:', err);
    } else {
      fastify.log.info(`✅ Inserted row with ID ${this.lastID}`);
    }
  }
  );
})


fastify.post('/loginAccount', (request, reply) => {
console.log("login")


const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/app/data/database.db');

const { email, password } = request.body;
var hashedPassword = hashPassword(password);


  db.get(
  `SELECT email FROM users WHERE email= ? and password= ?`,
  [email, hashedPassword],
  (err, row) => {
    if (err) {
      console.log("Database error")
    }

    if (!row) {
      console.log("Invalid email or password")
    }

    const sessionCookie = crypto.randomBytes(32).toString("hex");
    console.log(sessionCookie)
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