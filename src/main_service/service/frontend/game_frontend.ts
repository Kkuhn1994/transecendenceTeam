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

    const paddleWidth = 12, paddleHeight = 100, ballSize = 8;
    
    // Dark gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(0.5, '#1a1a1a');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw center line with subtle effect
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.restore();

    // Draw paddles with subtle styling and light glow
    function drawPaddle(x: number, y: number) {
        ctx.save();
        
        // Add subtle glow
        ctx.shadowColor = 'rgba(0, 255, 255, 0.4)';
        ctx.shadowBlur = 6;
        
        // Simple paddle gradient
        const paddleGrad = ctx.createLinearGradient(x, y, x + paddleWidth, y + paddleHeight);
        paddleGrad.addColorStop(0, '#f0f0f0');
        paddleGrad.addColorStop(0.5, '#d0d0d0');
        paddleGrad.addColorStop(1, '#f0f0f0');
        
        ctx.fillStyle = paddleGrad;
        ctx.fillRect(x, y, paddleWidth, paddleHeight);
        
        // Subtle paddle border
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, paddleWidth, paddleHeight);
        ctx.restore();
    }
    
    drawPaddle(0, leftPaddleY);
    drawPaddle(canvas.width - paddleWidth, rightPaddleY);

    // Draw ball with simple styling
    ctx.save();
    
    // Simple ball gradient
    const ballGrad = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, ballSize);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(1, '#e0e0e0');
    
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    
    // Subtle ball border
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();
    ctx.restore();

    // Draw scores with subtle styling
    ctx.save();
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(scoreLeft.toString(), canvas.width / 4, 60);
    ctx.fillText(scoreRight.toString(), (3 * canvas.width) / 4, 60);
    ctx.restore();

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
