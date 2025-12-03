declare global {
  interface Window {
    pongInterval: any;
    currentSessionId?: number;
  }
}

export function startGame() {
  console.log('game_start');
  const canvas = document.getElementById('pongCanvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;

  const sessionId = window.currentSessionId;
  if (!sessionId) {
    alert('No active game session. Go back and start a 1v1.');
    return;
  }

  if (window.pongInterval) {
    clearInterval(window.pongInterval);
  }

  let leftPaddleY = canvas.height / 2;
  let rightPaddleY = canvas.height / 2;
  let ballX = canvas.width / 2;
  let ballY = canvas.height / 2;
  let scoreLeft = 0;
  let scoreRight = 0;

  let upPressed = false, downPressed = false;
  let wPressed = false, sPressed = false;

  const keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') upPressed = true;
    if (e.key === 'ArrowDown') downPressed = true;
    if (e.key === 'w') wPressed = true;
    if (e.key === 's') sPressed = true;
  };

  const keyupHandler = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') upPressed = false;
    if (e.key === 'ArrowDown') downPressed = false;
    if (e.key === 'w') wPressed = false;
    if (e.key === 's') sPressed = false;
  };

  document.addEventListener('keydown', keydownHandler);
  document.addEventListener('keyup', keyupHandler);

  function draw() {
    if (!canvas || !document.body.contains(canvas)) {
      document.removeEventListener('keydown', keydownHandler);
      document.removeEventListener('keyup', keyupHandler);
      return;
    }

    const paddleWidth = 10, paddleHeight = 100, ballSize = 10;

    ctx.fillStyle = '#f4f4f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, leftPaddleY, paddleWidth, paddleHeight);
    ctx.fillRect(canvas.width - paddleWidth, rightPaddleY, paddleWidth, paddleHeight);

    ctx.beginPath();
    ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.closePath();

    ctx.font = '30px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(scoreLeft.toString(), canvas.width / 4, 50);
    ctx.fillText(scoreRight.toString(), (3 * canvas.width) / 4, 50);

    requestAnimationFrame(draw);
  }

  async function getGameState() {
    if (!canvas || !document.body.contains(canvas)) return;

    const canvasheight = canvas.height;
    const canvaswidth = canvas.width;

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
      ballY,
      sessionId,
    };

    try {
      const res = await fetch('/game_service/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const response = await res.json();

      leftPaddleY = response.leftPaddleY;
      rightPaddleY = response.rightPaddleY;
      ballX = response.ballX;
      ballY = response.ballY;
      if (response.scoreLeft !== undefined) scoreLeft = response.scoreLeft;
      if (response.scoreRight !== undefined) scoreRight = response.scoreRight;

      if (response.winnerIndex) {
        const winner = response.winnerIndex === 1 ? 'Left player (W/S)' : 'Right player (↑/↓)';
        alert(`Game Over! ${winner} wins!`);
        window.currentSessionId = undefined;
        clearInterval(window.pongInterval);
      }
    } catch (err) {
      console.error('Error in game fetch:', err);
    }
  }

  requestAnimationFrame(draw);
  window.pongInterval = setInterval(getGameState, 20);
}
