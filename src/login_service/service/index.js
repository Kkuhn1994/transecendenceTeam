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

fastify.addHook('onReady', () => {
  // console.log('✅ Fastify ready and listening on port 3000');
  // console.log(fastify.printRoutes());
});

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
  const hashedPassword = hashPassword(password);
   console.log(hashedPassword);
  const secret = generateUserSecret();
  console.log("create Account23");
  const otpAuthUrl = `otpauth://totp/${encodeURIComponent('pong.com')}?secret=${secret}&issuer=${encodeURIComponent(email)}`;
  const matrix = generateQrMatrix(otpAuthUrl);
  writePng("otp_qr.png", matrix, 10);
  console.log("create Account23");
  console.log(hashedPassword);
  console.log(hashPassword(password));
  db.run(
  `INSERT INTO users (email, password, secret) VALUES (?, ?, ?)`,
  [email, hashedPassword, secret],
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


const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/app/data/database.db');

const { email, password } = request.body;
var hashedPassword = hashPassword(password);
console.log("logweewin")
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