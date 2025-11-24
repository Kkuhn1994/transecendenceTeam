const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
let leftPaddleY = canvas.height / 2;
let rightPaddleY = canvas.height / 2;
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;;

// Tasten für Steuerung
let upPressed = false, downPressed = false;
let wPressed = false, sPressed = false;
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') upPressed = true;
    if (e.key === 'ArrowDown') downPressed = true;
    if (e.key === 'w') wPressed = true;
    if (e.key === 's') sPressed = true;
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') upPressed = false;
    if (e.key === 'ArrowDown') downPressed = false;
    if (e.key === 'w') wPressed = false;
    if (e.key === 's') sPressed = false;
});

function draw() {
const paddleWidth = 10, paddleHeight = 100, ballSize = 10;
// Hintergrund
ctx.fillStyle = '#f4f4f9';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Schläger zeichnen
ctx.fillStyle = '#000';
ctx.fillRect(0, leftPaddleY, paddleWidth, paddleHeight); // Linker Schläger
ctx.fillRect(canvas.width - paddleWidth, rightPaddleY, paddleWidth, paddleHeight); // Rechter Schläger

// Ball zeichnen
ctx.beginPath();
ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
ctx.fillStyle = '#000';
ctx.fill();
ctx.closePath();
requestAnimationFrame(draw);
}


function getGameState() {
let canvasheight = canvas.height
let canvaswidth = canvas.width
const data = {
upPressed,
downPressed,
wPressed,
sPressed,
canvasheight,
canvaswidth,
leftPaddleY,
rightPaddleY,
ballX,
ballY
};

fetch('/game_service/game', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(data)
})
.then(res => res.json())
.then(response => {
console.log('Server Response:', response);
leftPaddleY = response.leftPaddleY;
rightPaddleY = response.rightPaddleY;
ballX = response.ballX;
ballY = response.ballY;
// alert(ballX);
})
.catch(err => {
console.error('Fehler bei der Anfrage:', err);
});
draw();
}

setInterval(getGameState, 10);

