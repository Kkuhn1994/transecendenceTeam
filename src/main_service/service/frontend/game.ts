// pong-client.ts (oder in einer .ts-Datei in deinem Projekt)

const canvas = document.getElementById('pongCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

// Anfangspositionen
let leftPaddleY = canvas.height / 2 - 50;   // -50 damit der Schläger mittig startet
let rightPaddleY = canvas.height / 2 - 50;
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;

// Tastenstatus
let upPressed = false;
let downPressed = false;
let wPressed = false;
let sPressed = false;

// --- Eingabe-Event-Listener -------------------------------------------------
document.addEventListener('keydown', (e: KeyboardEvent) => {
    switch (e.key) {
        case 'ArrowUp':    upPressed = true;    break;
        case 'ArrowDown':  downPressed = true;  break;
        case 'w':          wPressed = true;     break;
        case 's':          sPressed = true;     break;
    }
});

document.addEventListener('keyup', (e: KeyboardEvent) => {
    switch (e.key) {
        case 'ArrowUp':    upPressed = false;   break;
        case 'ArrowDown':  downPressed = false; break;
        case 'w':          wPressed = false;    break;
        case 's':          sPressed = false;    break;
    }
});

// --- Typ für die Antwort des Servers ----------------------------------------
interface GameStateResponse {
    leftPaddleY: number;
    rightPaddleY: number;
    ballX: number;
    ballY: number;
    // hier ggf. weitere Werte wie Punkte, Geschwindigkeit usw. ergänzen
}

// --- Zeichnen ---------------------------------------------------------------
function draw(): void {
    const paddleWidth = 10;
    const paddleHeight = 100;
    const ballSize = 10;

    // Hintergrund
    ctx.fillStyle = '#f4f4f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Schläger
    ctx.fillStyle = '#000';
    ctx.fillRect(0, leftPaddleY, paddleWidth, paddleHeight);                     // links
    ctx.fillRect(canvas.width - paddleWidth, rightPaddleY, paddleWidth, paddleHeight); // rechts

    // Ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.closePath();

    requestAnimationFrame(draw);
}

// --- Spielstatus an Server schicken und aktualisierte Werte holen ----------
async function getGameState(): Promise<void> {
    const data = {
        upPressed,
        downPressed,
        wPressed,
        sPressed,
        canvasHeight: canvas.height,
        canvasWidth:  canvas.width,
        leftPaddleY,
        rightPaddleY,
        ballX,
        ballY,
    };

    try {
        const res = await fetch('/game_service/game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response: GameStateResponse = await res.json();

        // Werte vom Server übernehmen
        leftPaddleY  = response.leftPaddleY;
        rightPaddleY = response.rightPaddleY;
        ballX        = response.ballX;
        ballY        = response.ballY;

        console.log('Server → Client:', response);
    } catch (err) {
        console.error('Fehler bei der Anfrage:', err);
    }

    // draw() wird sowieso permanent über requestAnimationFrame aufgerufen
}

// --- Spielschleife -----------------------------------------------------------
requestAnimationFrame(draw);               // Startet das ständige Neuzeichnen
setInterval(getGameState, 10);             // 100 FPS Abfrage an den Server (kann je nach Bedarf angepasst werden)