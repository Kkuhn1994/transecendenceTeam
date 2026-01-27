export {};

let scoreLeft = 0;
let scoreRight = 0;

import { uiAlert, uiDialog } from './ui_modal';

declare global {
  interface Window {
    pongInterval: any;
    currentSessionId?: number;
    currentTournamentId?: number;

    tournamentPlayerMap?: Record<number, string>;
    currentMatchPlayer1Id?: number;
    currentMatchPlayer2Id?: number;

    currentMatchPlayer1Name?: string;
    currentMatchPlayer2Name?: string;
  }
}

const TOURNAMENT_UI_KEY = 'tournament_ui_state_v1';

type PendingMatch = {
  tournamentId: number;
  sessionId: number;
  player1Id: number;
  player2Id: number;
};

function nameOf(id: number): string {
  return window.tournamentPlayerMap?.[id] ?? `Player ${id}`;
}

function readTournamentUIState(): any | null {
  try {
    const raw = sessionStorage.getItem(TOURNAMENT_UI_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeTournamentUIState(next: any) {
  sessionStorage.setItem(TOURNAMENT_UI_KEY, JSON.stringify(next));
}

function setPendingMatch(pending: PendingMatch | null) {
  const cur = readTournamentUIState() || {};
  cur.pendingMatch = pending;

  // keep tournament id in sync (helps resume)
  if (window.currentTournamentId != null) {
    cur.currentTournamentId = Number(window.currentTournamentId);
  }

  writeTournamentUIState(cur);
}

function clearTournamentUIState() {
  sessionStorage.removeItem(TOURNAMENT_UI_KEY);
}

async function deleteTournamentFromDB(tournamentId: number) {
  try {
    await fetch('/tournament_service/tournament/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    });
  } catch {
    // ignore; we still clear local state so UI doesn't get stuck
  }
}

function clearTournamentGlobals() {
  window.currentTournamentId = undefined;
  window.currentSessionId = undefined;
  window.currentMatchPlayer1Id = undefined;
  window.currentMatchPlayer2Id = undefined;
  window.tournamentPlayerMap = undefined;
}

async function abandonTournamentAndResetUI() {
  const tid = window.currentTournamentId;
  if (tid != null) await deleteTournamentFromDB(Number(tid));
  clearTournamentGlobals();
  clearTournamentUIState();
  window.currentMatchPlayer1Name = undefined;
  window.currentMatchPlayer2Name = undefined;
  location.hash = '#/tournament';
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

  //  Fixed logical game size (physics stays consistent everywhere)
  const LOGICAL_W = 800;
  const LOGICAL_H = 400;
  const PADDLE_W = 10;
  const PADDLE_H = 100;
  const BALL_SIZE = 10;

  function fitCanvasToStage() {
    const stage = canvas.parentElement as HTMLElement | null;
    if (!stage) return;

    const rectW = stage.getBoundingClientRect().width;
    const availableW = Math.min(900, window.innerWidth - 40); // 20px padding each side
    const baseW = rectW > 200 ? rectW : availableW;           // fallback if layout is tiny
    const cssW = Math.max(320, Math.min(900, baseW));
    const cssH = Math.round(cssW / 2);

    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    const scaleX = cssW / LOGICAL_W;
    const scaleY = cssH / LOGICAL_H;

    ctx.setTransform(scaleX * dpr, 0, 0, scaleY * dpr, 0, 0);
  } 

  fitCanvasToStage();
  window.addEventListener('resize', fitCanvasToStage);

  //  player names above the canvas
  const leftNameEl = document.getElementById('playerLeftName');
  const rightNameEl = document.getElementById('playerRightName');

  if (leftNameEl && rightNameEl) {
    if (window.currentTournamentId != null &&
        window.currentMatchPlayer1Id != null &&
        window.currentMatchPlayer2Id != null) {
      leftNameEl.textContent = nameOf(window.currentMatchPlayer1Id);
      rightNameEl.textContent = nameOf(window.currentMatchPlayer2Id);
    } else {
      // 1v1 fallback (until we store actual usernames for both)
        leftNameEl.textContent = window.currentMatchPlayer1Name || 'Player 1';
        rightNameEl.textContent = window.currentMatchPlayer2Name || 'Player 2';
    }
  }


  // prevent multiple loops
  if (window.pongInterval) {
    clearInterval(window.pongInterval);
    window.pongInterval = null;
  }

  let matchEnding = false;
  let endHandled = false; // winner flow should run once
  let inFlight = false; // avoid overlapping /game calls

  // local state
  let leftPaddleY = (LOGICAL_H - PADDLE_H) / 2;
  let rightPaddleY = (LOGICAL_H - PADDLE_H) / 2;
  let ballX = LOGICAL_W / 2;
  let ballY = LOGICAL_H / 2;
  let scoreLeft = 0;
  let scoreRight = 0;

  let upPressed = false,
    downPressed = false;
  let wPressed = false,
    sPressed = false;

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
    console.log('cleanup');
    running = false;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;

    document.removeEventListener('keydown', keydownHandler);
    document.removeEventListener('keyup', keyupHandler);
    window.removeEventListener('resize', fitCanvasToStage);

    if (window.pongInterval) {
      clearInterval(window.pongInterval);
      window.pongInterval = null;
    }
  }

  function resetLocalStateForNewMatch() {
    leftPaddleY = (LOGICAL_H - PADDLE_H) / 2;
    rightPaddleY = (LOGICAL_H - PADDLE_H) / 2;
    ballX = LOGICAL_W / 2;
    ballY = LOGICAL_H / 2;
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

    const paddleWidth = PADDLE_W;
    const paddleHeight = PADDLE_H;
    const ballSize = BALL_SIZE;

    // background
    const gradient = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(0.5, '#1a1a1a');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // center line
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(LOGICAL_W / 2, 0);
    ctx.lineTo(LOGICAL_W / 2, LOGICAL_H);
    ctx.stroke();
    ctx.restore();

    function drawPaddle(x: number, y: number) {
      ctx.save();

      const paddleGrad = ctx.createLinearGradient(
        x,
        y,
        x + paddleWidth,
        y + paddleHeight,
      );
      paddleGrad.addColorStop(0, '#f0f0f0');
      paddleGrad.addColorStop(0.5, '#d0d0d0');
      paddleGrad.addColorStop(1, '#f0f0f0');

      ctx.fillStyle = paddleGrad;
      ctx.fillRect(x, y, paddleWidth, paddleHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, paddleWidth, paddleHeight);
      ctx.restore();
    }

    drawPaddle(0, leftPaddleY);
    drawPaddle(LOGICAL_W - paddleWidth, rightPaddleY);

    // ball
    ctx.save();
    const ballGrad = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, ballSize / 2);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(1, '#e0e0e0');

    ctx.beginPath();
    ctx.arc(ballX, ballY, ballSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();
    ctx.restore();

    // scores
    ctx.save();
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(scoreLeft.toString(), LOGICAL_W / 4, 60);
    ctx.fillText(scoreRight.toString(), (3 * LOGICAL_W) / 4, 60);
    ctx.restore();

    rafId = requestAnimationFrame(draw);
  }

  async function announceByes(byes: any) {
    if (!Array.isArray(byes) || byes.length === 0) return;
    for (const pid of byes) {
      const id = Number(pid);
      const n = Number.isFinite(id) ? nameOf(id) : 'One player';
      await uiAlert(`Bye round:\n${n} advances automatically.`, 'Bye round');
    }
  }

  async function requestNextMatchOrFinish(): Promise<any> {
    const res = await fetch('/tournament_service/tournament/start-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId: window.currentTournamentId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data.error || 'start-match failed', status: res.status };
    }
    return data;
  }

  function isTournamentMode(): boolean {
    return (
      window.currentTournamentId != null &&
      window.currentMatchPlayer1Id != null &&
      window.currentMatchPlayer2Id != null
    );
  }

  async function handle1v1End(winnerIndex: number) {
    // console.log('1vs1 ' + winnerIndex);
    // console.log('1vs1 ' + scoreLeft);
    // console.log('1vs1 ' + scoreRight);
    const winner = winnerIndex === 1 ? 'Left Player' : 'Right Player';

    const choice = await uiDialog<'again' | 'lobby'>({
      title: '🏁 Game finished!',
      message: `Final score: ${scoreLeft} - ${scoreRight}\nWinner: ${winner}`,
      buttons: [
        { id: 'again', text: 'Play again', variant: 'primary' },
        { id: 'lobby', text: 'Lobby', variant: 'ghost' },
      ],
      dismissible: true,
    });

    if (choice === 'again') {
      resetLocalStateForNewMatch();
      window.pongInterval = setInterval(getGameState, 20);
      return;
    }

    window.currentSessionId = undefined;
    window.currentMatchPlayer1Name = undefined;
    window.currentMatchPlayer2Name = undefined;
    cleanup();
    location.hash = '#/play';
  }

  //  this is the tournament popup after a match: Start / Back / Abandon
  async function askStartNextMatch(pending: PendingMatch): Promise<'start' | 'back' | 'abandon'> {
    const p1 = nameOf(pending.player1Id);
    const p2 = nameOf(pending.player2Id);

    const choice = await uiDialog<'start' | 'back' | 'abandon'>({
      title: 'Next match ready',
      message: `${p1} vs ${p2}`,
      buttons: [
        { id: 'start', text: 'Start match', variant: 'primary' },
        { id: 'back', text: 'Back', variant: 'ghost' },
        { id: 'abandon', text: 'Abandon', variant: 'danger' },
      ],
      dismissible: true,
    });

    return choice;
  }

  async function getGameState() {
    if (!document.body.contains(canvas)) {
      cleanup();
      return;
    }
    if (matchEnding || endHandled) return;
    if (inFlight) return;

    const sessionId = window.currentSessionId;
    if (!sessionId) return;

    inFlight = true;

    const data = {
      upPressed,
      downPressed,
      wPressed,
      sPressed,
      canvasheight: LOGICAL_H,
      canvaswidth: LOGICAL_W,
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
      // console.log(JSON.stringify(response, null, 2));
      // console.log(response.scoreLeft);

      leftPaddleY = response.leftPaddleY;
      rightPaddleY = response.rightPaddleY;
      ballX = response.ballX;
      ballY = response.ballY;

      scoreLeft = response.scoreLeft;
      scoreRight = response.scoreRight;
      // console.log('Response ' + response.scoreLeft);
      // console.log('Response ' + response.scoreRight);
      // console.log('Response ' + scoreLeft);
      // console.log('Response ' + scoreRight);

      const winnerIndex = response.winnerIndex;

      if (winnerIndex !== undefined && winnerIndex !== null) {
        matchEnding = true;
        endHandled = true;

        if (window.pongInterval) {
          clearInterval(window.pongInterval);
          window.pongInterval = null;
        }

        if (isTournamentMode()) {
          const p1Id = window.currentMatchPlayer1Id!;
          const p2Id = window.currentMatchPlayer2Id!;
          const p1Name = nameOf(p1Id);
          const p2Name = nameOf(p2Id);
          const winnerName = winnerIndex === 1 ? p1Name : p2Name;

          await uiAlert(
            `✅ Match finished!\n${p1Name} vs ${p2Name}\nFinal score: ${scoreLeft} - ${scoreRight}\n🏅 Winner: ${winnerName}`,
            'Match finished',
          );

          const finishRes = await fetch(
            '/tournament_service/tournament/match-finished',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: window.currentSessionId,
                winnerIndex,
              }),
            },
          );

          const finishData = await finishRes.json().catch(() => ({}));
          if (!finishRes.ok) {
            await uiAlert(
              finishData.error || `match-finished failed (${finishRes.status})`,
              'Error',
            );
            cleanup();
            return;
          }

          if (finishData.tournamentFinished) {
            const winId = finishData.winnerId;
            const winName = winId != null ? nameOf(winId) : winnerName;

            await uiAlert(
              `🏆 Tournament finished!\nWinner: ${winName}`,
              'Tournament finished',
            );

            //  full cleanup so tournament page resets
            clearTournamentGlobals();
            clearTournamentUIState();

            cleanup();
            location.hash = '#/tournament';
            return;
          }

          // IMPORTANT: ask for next match, but persist it as "pending" BEFORE the user decides.
          const nextData = await requestNextMatchOrFinish();

          if (nextData.error) {
            await uiAlert(
              `${nextData.error} (${nextData.status ?? ''})`,
              'Error',
            );

            window.currentSessionId = undefined;
            window.currentMatchPlayer1Id = undefined;
            window.currentMatchPlayer2Id = undefined;

            cleanup();
            location.hash = '#/tournament';
            return;
          }

          await announceByes(nextData.byes);

          if (nextData.tournamentFinished) {
            const winId = nextData.winnerId;
            const winName = winId != null ? nameOf(winId) : winnerName;

            await uiAlert(
              `🏆 Tournament finished!\nWinner: ${winName}`,
              'Tournament finished',
            );

            clearTournamentGlobals();
            clearTournamentUIState();

            cleanup();
            location.hash = '#/tournament';
            return;
          }

          if (
            !nextData.sessionId ||
            !nextData.player1Id ||
            !nextData.player2Id
          ) {
            await uiAlert(
              'No match to play (tournament state is not ready).',
              'Error',
            );

            window.currentSessionId = undefined;
            window.currentMatchPlayer1Id = undefined;
            window.currentMatchPlayer2Id = undefined;

            cleanup();
            location.hash = '#/tournament';
            return;
          }

          const pending: PendingMatch = {
            tournamentId: Number(window.currentTournamentId),
            sessionId: Number(nextData.sessionId),
            player1Id: Number(nextData.player1Id),
            player2Id: Number(nextData.player2Id),
          };

          //  Persist pending so tournament.ts can resume without skipping
          setPendingMatch(pending);

          const choice = await askStartNextMatch(pending);

          if (choice === 'abandon') {
            cleanup();
            await abandonTournamentAndResetUI();
            return;
          }

          if (choice === 'back') {
            // Pause tournament: clear current session/match globals but keep tournamentId + pending match in storage
            window.currentSessionId = undefined;
            window.currentMatchPlayer1Id = undefined;
            window.currentMatchPlayer2Id = undefined;

            cleanup();
            location.hash = '#/tournament';
            return;
          }

          // Start next match
          window.currentSessionId = pending.sessionId;
          window.currentMatchPlayer1Id = pending.player1Id;
          window.currentMatchPlayer2Id = pending.player2Id;

          const leftNameEl2 = document.getElementById('playerLeftName');
          const rightNameEl2 = document.getElementById('playerRightName');
          if (leftNameEl2 && rightNameEl2) {
            leftNameEl2.textContent = nameOf(pending.player1Id);
            rightNameEl2.textContent = nameOf(pending.player2Id);
          }
          // Clear pending once match actually starts
          setPendingMatch(null);

          resetLocalStateForNewMatch();
          window.pongInterval = setInterval(getGameState, 20);
          return;
        }

        // 1v1 flow
        // alert('pre 1vs1 scorelft ' + scoreLeft);
        await handle1v1End(Number(winnerIndex));
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
