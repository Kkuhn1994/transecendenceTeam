export {};

declare global {
  interface Window {
    pongInterval: any;
    currentSessionId?: number;
    currentTournamentId?: number;

    tournamentPlayerMap?: Record<number, string>;
    currentMatchPlayer1Id?: number;
    currentMatchPlayer2Id?: number;
  }
}

function nameOf(id: number): string {
  return window.tournamentPlayerMap?.[id] ?? `Player ${id}`;
}

export function startGame() {
  console.log('game_start');

  const canvasEl = document.getElementById('pongCanvas');
  if (!(canvasEl instanceof HTMLCanvasElement)) {
    console.error('pongCanvas not found');
    return;
  }

  const ctx0 = canvasEl.getContext('2d');
  if (!ctx0) {
    console.error('2D context not available');
    return;
  }

  const ctx: CanvasRenderingContext2D = ctx0;
  const canvas: HTMLCanvasElement = canvasEl;

  // prevent multiple loops
  if (window.pongInterval) {
    clearInterval(window.pongInterval);
    window.pongInterval = null;
  }

  let matchEnding = false;
  let endHandled = false;   // winner flow should run once
  let inFlight = false;     // avoid overlapping /game calls

  // local state
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

  let rafId: number | null = null;
  let running = true;

  function cleanup() {
    running = false;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;

    document.removeEventListener('keydown', keydownHandler);
    document.removeEventListener('keyup', keyupHandler);

    if (window.pongInterval) {
      clearInterval(window.pongInterval);
      window.pongInterval = null;
    }
  }

  function resetLocalStateForNewMatch() {
    leftPaddleY = canvas.height / 2;
    rightPaddleY = canvas.height / 2;
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    scoreLeft = 0;
    scoreRight = 0;
    upPressed = downPressed = wPressed = sPressed = false;
    matchEnding = false;
    endHandled = false;
    inFlight = false;
  }

  function draw() {
    if (!running) return;
    if (!document.body.contains(canvas)) {
      cleanup();
      return;
    }

    const paddleWidth = 12, paddleHeight = 100, ballSize = 8;

    // background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(0.5, '#1a1a1a');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // center line
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.restore();

    function drawPaddle(x: number, y: number) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 255, 255, 0.4)';
      ctx.shadowBlur = 6;

      const paddleGrad = ctx.createLinearGradient(x, y, x + paddleWidth, y + paddleHeight);
      paddleGrad.addColorStop(0, '#f0f0f0');
      paddleGrad.addColorStop(0.5, '#d0d0d0');
      paddleGrad.addColorStop(1, '#f0f0f0');

      ctx.fillStyle = paddleGrad;
      ctx.fillRect(x, y, paddleWidth, paddleHeight);

      ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, paddleWidth, paddleHeight);
      ctx.restore();
    }

    drawPaddle(0, leftPaddleY);
    drawPaddle(canvas.width - paddleWidth, rightPaddleY);

    // ball
    ctx.save();
    const ballGrad = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, ballSize);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(1, '#e0e0e0');

    ctx.beginPath();
    ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();
    ctx.restore();

    // scores
    ctx.save();
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(scoreLeft.toString(), canvas.width / 4, 60);
    ctx.fillText(scoreRight.toString(), (3 * canvas.width) / 4, 60);
    ctx.restore();

    rafId = requestAnimationFrame(draw);
  }

  async function getGameState() {
    if (!document.body.contains(canvas)) {
      cleanup();
      return;
    }
    if (matchEnding || endHandled) return;
    if (inFlight) return;

    const sessionId = window.currentSessionId;
    if (!sessionId) {
      return;
    }

    inFlight = true;

    const data = {
      upPressed,
      downPressed,
      wPressed,
      sPressed,
      canvasheight: canvas.height,
      canvaswidth: canvas.width,
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

      const response = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('game_service/game error:', response);
        return;
      }

      leftPaddleY = response.leftPaddleY;
      rightPaddleY = response.rightPaddleY;
      ballX = response.ballX;
      ballY = response.ballY;

      if (response.scoreLeft !== undefined) scoreLeft = response.scoreLeft;
      if (response.scoreRight !== undefined) scoreRight = response.scoreRight;

      if (response.winnerIndex !== undefined && response.winnerIndex !== null) {
        matchEnding = true;
        endHandled = true;

        if (window.pongInterval) {
          clearInterval(window.pongInterval);
          window.pongInterval = null;
        }

        const p1Id = window.currentMatchPlayer1Id;
        const p2Id = window.currentMatchPlayer2Id;
        const p1Name = (p1Id != null) ? nameOf(p1Id) : 'Player 1';
        const p2Name = (p2Id != null) ? nameOf(p2Id) : 'Player 2';
        const winnerName = response.winnerIndex === 1 ? p1Name : p2Name;

        if (window.currentTournamentId) {
          alert(
            `✅ Match finished!\n${p1Name} vs ${p2Name}\nFinal score: ${scoreLeft} - ${scoreRight}\n🏅 Winner: ${winnerName}`
          );

          const finishRes = await fetch('/game_service/tournament/match-finished', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: window.currentSessionId,
              winnerIndex: response.winnerIndex,
            }),
          });

          const finishData = await finishRes.json().catch(() => ({}));
          if (!finishRes.ok) {
            alert(finishData.error || `match-finished failed (${finishRes.status})`);
            cleanup();
            return;
          }

          if (finishData.tournamentFinished) {
            alert(`🏆 Tournament finished!\nWinner: ${winnerName}`);
            window.currentTournamentId = undefined;
            window.currentSessionId = undefined;
            cleanup();
            location.hash = '#/tournament';
            return;
          }

          const nextRes = await fetch('/game_service/tournament/start-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId: window.currentTournamentId }),
          });

          const nextData = await nextRes.json().catch(() => ({}));
          if (!nextRes.ok) {
            alert(nextData.error || `start-match failed (${nextRes.status})`);
            cleanup();
            return;
          }

          if (nextData.bye) {
            alert('Bye round: one player advances automatically.');
            // resume polling for next real match attempt
            matchEnding = false;
            endHandled = false;
            window.pongInterval = setInterval(getGameState, 20);
            return;
          }

          window.currentSessionId = nextData.sessionId;
          window.currentMatchPlayer1Id = nextData.player1Id;
          window.currentMatchPlayer2Id = nextData.player2Id;

          const nextP1 = nameOf(nextData.player1Id);
          const nextP2 = nameOf(nextData.player2Id);

          const ok = confirm(`Next match ready:\n${nextP1} vs ${nextP2}\n\nPress OK to start.`);
          if (!ok) {
            cleanup();
            location.hash = '#/tournament';
            return;
          }

          resetLocalStateForNewMatch();

          window.pongInterval = setInterval(getGameState, 20);
          alert(`🏓 Match starting!\n${nextP1} vs ${nextP2}`);
          return;
        }

        alert(`Game Over! WinnerIndex=${response.winnerIndex}`);
        window.currentSessionId = undefined;
        cleanup();
        return;
      }
    } catch (err) {
      console.error('Error in game fetch:', err);
    } finally {
      inFlight = false;
    }
  }

  rafId = requestAnimationFrame(draw);
  window.pongInterval = setInterval(getGameState, 20);
}
