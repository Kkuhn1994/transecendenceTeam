export {};

import { uiAlert, uiConfirm } from './ui_modal';

type TournamentPlayer = { id: number; email: string };

declare global {
  interface Window {
    currentTournamentId?: number;
    currentSessionId?: number;

    tournamentPlayerMap?: Record<number, string>;

    currentMatchPlayer1Id?: number;
    currentMatchPlayer2Id?: number;
  }
}

let tournamentPlayers: TournamentPlayer[] = [];

async function getMe(): Promise<TournamentPlayer | null> {
  try {
    const res = await fetch('/login_service/auth/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;

    const me = await res.json();
    if (!me?.id || !me?.email) return null;

    return { id: me.id, email: me.email };
  } catch (e) {
    console.error('getMe failed:', e);
    return null;
  }
}

async function verifyPlayer(email: string, password: string, otp: string): Promise<TournamentPlayer | null> {
  try {
    const res = await fetch('/login_service/verifyCredentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, otp }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      await uiAlert(data.error || 'Invalid credentials', 'Login failed');
      return null;
    }

    if (!data?.id || !data?.email) {
      await uiAlert('verifyCredentials returned invalid payload', 'Server error');
      return null;
    }

    return { id: data.id, email: data.email };
  } catch (e) {
    console.error('verifyPlayer failed:', e);
    await uiAlert('verifyCredentials crashed (network/server)', 'Network error');
    return null;
  }
}

function hasPlayer(id: number): boolean {
  return tournamentPlayers.some(p => p.id === id);
}

function nameOf(id: number): string {
  return window.tournamentPlayerMap?.[id] ?? `Player ${id}`;
}

function rebuildPlayerMap() {
  window.tournamentPlayerMap = {};
  tournamentPlayers.forEach(p => {
    window.tournamentPlayerMap![p.id] = p.email;
  });
}

async function startMatchLoop(): Promise<void> {
  // This function calls /start-match repeatedly until:
  // - it gets a real match (sessionId/player1Id/player2Id), or
  // - tournament finished, or
  // - an error occurs
  for (let guard = 0; guard < 50; guard++) {
    const res = await fetch('/game_service/tournament/start-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId: window.currentTournamentId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      await uiAlert(data.error || `Start match failed (${res.status})`, 'Error');
      return;
    }

    // Support older server responses too (bye vs byes)
    if (data.bye) {
      const adv = data.advancedPlayerId as number | undefined;
      const advName = adv != null ? nameOf(adv) : 'One player';
      await uiAlert(`Bye round:\n${advName} advances automatically.`, 'Bye round');
      continue; // immediately ask for next playable match
    }

    if (Array.isArray(data.byes) && data.byes.length > 0) {
      for (const pid of data.byes) {
        const id = Number(pid);
        await uiAlert(`Bye round:\n${nameOf(id)} advances automatically.`, 'Bye round');
      }
      // continue: there should also be a playable match in this response in your newer server,
      // but if not, loop is safe.
      if (!data.sessionId) continue;
    }

    if (data.tournamentFinished) {
      const winId = data.winnerId as number | undefined;
      const winName = winId != null ? nameOf(winId) : 'Unknown';
      await uiAlert(`🏆 Tournament finished!\nWinner: ${winName}`, 'Tournament complete');
      window.currentTournamentId = undefined;
      window.currentSessionId = undefined;
      window.currentMatchPlayer1Id = undefined;
      window.currentMatchPlayer2Id = undefined;
      return;
    }

    if (!data.sessionId || !data.player1Id || !data.player2Id) {
      await uiAlert('No match available (server returned incomplete data).', 'Error');
      return;
    }

    // Found a real match
    window.currentMatchPlayer1Id = data.player1Id;
    window.currentMatchPlayer2Id = data.player2Id;

    const p1 = nameOf(data.player1Id);
    const p2 = nameOf(data.player2Id);

    const ok = await uiConfirm(
      `Next match:\n${p1} vs ${p2}`,
      'Match ready',
      'Start match',
      'Back'
    );
    if (!ok) return;

    await uiAlert(`🏓 Match starting!\n${p1} vs ${p2}`, 'Game');

    window.currentSessionId = data.sessionId;
    location.hash = '#/game';
    return;
  }

  await uiAlert('Start match guard hit (unexpected tournament state).', 'Error');
}

export async function initTournamentUI() {
  tournamentPlayers = [];

  const form = document.getElementById('addPlayerForm') as HTMLFormElement | null;
  const list = document.getElementById('playerList') as HTMLUListElement | null;
  const info = document.getElementById('tournamentInfo') as HTMLDivElement | null;
  const startTournamentBtn = document.getElementById('startTournamentBtn') as HTMLButtonElement | null;
  const startMatchBtn = document.getElementById('startMatchBtn') as HTMLButtonElement | null;

  if (!form || !list || !info || !startTournamentBtn || !startMatchBtn) {
    console.error('Tournament UI missing elements');
    return;
  }

  startTournamentBtn.disabled = true;
  startMatchBtn.disabled = true;

  function renderPlayers() {
    rebuildPlayerMap();

    list!.innerHTML = '';
    tournamentPlayers.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.email} (id=${p.id})`;
      list!.appendChild(li);
    });

    startTournamentBtn!.disabled = tournamentPlayers.length < 2;
  }

  const me = await getMe();
  if (!me) {
    info.innerText = 'You are not logged in. Go back and login first.';
    return;
  }

  tournamentPlayers.push(me);
  renderPlayers();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = (document.getElementById('playerEmail') as HTMLInputElement | null)?.value.trim() || '';
    const password = (document.getElementById('playerPassword') as HTMLInputElement | null)?.value || '';
    const otp = (document.getElementById('playerOtp') as HTMLInputElement | null)?.value.trim() || '';

    if (!email || !password || !otp) {
      await uiAlert('Please fill email / password / OTP.', 'Missing info');
      return;
    }

    const player = await verifyPlayer(email, password, otp);
    if (!player) return;

    if (hasPlayer(player.id)) {
      await uiAlert('That account is already added to the tournament.', 'Duplicate player');
      return;
    }

    tournamentPlayers.push(player);
    renderPlayers();
    form.reset();
  });

  startTournamentBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/game_service/tournament/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerIds: tournamentPlayers.map(p => p.id),
          name: 'Pong Tournament',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        await uiAlert(data.error || `Create tournament failed (${res.status})`, 'Error');
        return;
      }

      window.currentTournamentId = data.tournamentId;

      info.innerText = `Tournament created (id=${data.tournamentId}).`;
      startMatchBtn.disabled = false;

      await uiAlert('Tournament created! Click “Start Match” when you’re ready.', 'Ready');
    } catch (e) {
      console.error(e);
      await uiAlert('Create tournament request crashed', 'Network error');
    }
  });

  startMatchBtn.addEventListener('click', async () => {
    if (!window.currentTournamentId) {
      await uiAlert('No active tournament id. Create a tournament first.', 'No tournament');
      return;
    }

    rebuildPlayerMap();
    await startMatchLoop();
  });
}
