export {};

import { uiAlert, uiConfirm, uiDialog } from './ui_modal';

type TournamentPlayer = { id: number; email: string };

type PendingMatch = {
  tournamentId: number;
  sessionId: number;
  player1Id: number;
  player2Id: number;
};

declare global {
  interface Window {
    currentTournamentId?: number;
    currentSessionId?: number;
    currentSessionIsAI?: boolean;
    tournamentPlayerMap?: Record<number, string>;
    currentMatchPlayer1Id?: number;
    currentMatchPlayer2Id?: number;
  }
}

let tournamentPlayers: TournamentPlayer[] = [];

const TOURNAMENT_UI_KEY = 'tournament_ui_state_v1';

function readRawUIState(): any | null {
  try {
    const raw = sessionStorage.getItem(TOURNAMENT_UI_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeRawUIState(next: any) {
  sessionStorage.setItem(TOURNAMENT_UI_KEY, JSON.stringify(next));
}

function getPendingMatch(): PendingMatch | null {
  const s = readRawUIState();
  const pm = s?.pendingMatch;
  if (!pm) return null;

  const tournamentId = Number(pm.tournamentId);
  const sessionId = Number(pm.sessionId);
  const player1Id = Number(pm.player1Id);
  const player2Id = Number(pm.player2Id);

  if (![tournamentId, sessionId, player1Id, player2Id].every(Number.isFinite)) return null;
  if (tournamentId <= 0 || sessionId <= 0 || player1Id <= 0 || player2Id <= 0) return null;

  return { tournamentId, sessionId, player1Id, player2Id };
}

function setPendingMatch(pending: PendingMatch | null) {
  const s = readRawUIState() || {};
  s.pendingMatch = pending;
  writeRawUIState(s);
}

function saveTournamentUIState() {
  const name = (document.getElementById('tournamentName') as HTMLInputElement | null)?.value.trim() || 'Tournament';

  // preserve pendingMatch if any
  const raw = readRawUIState() || {};
  const pendingMatch = raw.pendingMatch ?? null;

  sessionStorage.setItem(
    TOURNAMENT_UI_KEY,
    JSON.stringify({
      name,
      players: tournamentPlayers,
      currentTournamentId: window.currentTournamentId ?? null,
      pendingMatch,
    })
  );
}

function loadTournamentUIState(): {
  name: string;
  players: TournamentPlayer[];
  currentTournamentId: number | null;
  pendingMatch: PendingMatch | null;
} | null {
  try {
    const raw = sessionStorage.getItem(TOURNAMENT_UI_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.players)) return null;

    const pendingMatch = (() => {
      const pm = parsed.pendingMatch;
      if (!pm) return null;
      const tournamentId = Number(pm.tournamentId);
      const sessionId = Number(pm.sessionId);
      const player1Id = Number(pm.player1Id);
      const player2Id = Number(pm.player2Id);
      if (![tournamentId, sessionId, player1Id, player2Id].every(Number.isFinite)) return null;
      if (tournamentId <= 0 || sessionId <= 0 || player1Id <= 0 || player2Id <= 0) return null;
      return { tournamentId, sessionId, player1Id, player2Id } as PendingMatch;
    })();

    return {
      name: String(parsed.name || 'Tournament'),
      players: parsed.players.map((p: any) => ({ id: Number(p.id), email: String(p.email) })),
      currentTournamentId: parsed.currentTournamentId != null ? Number(parsed.currentTournamentId) : null,
      pendingMatch,
    };
  } catch {
    return null;
  }
}

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

function nameOf(id: number | null | undefined): string {
  if (!id) return '—';
  return window.tournamentPlayerMap?.[id] ?? `Player ${id}`;
}

async function loadTournamentPlayerMap(tournamentId: number) {
  try {
    const res = await fetch(`/tournament_service/tournament/${tournamentId}/players`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.players)) return;

    window.tournamentPlayerMap = {};
    for (const p of data.players) {
      if (p?.id && p?.email) window.tournamentPlayerMap[Number(p.id)] = String(p.email);
    }
  } catch {
    // ignore
  }
}

async function deleteTournamentFromDB(tournamentId: number) {
  try {
    await fetch('/tournament_service/tournament/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    });
  } catch {
    // ignore
  }
}

function clearRuntimeState() {
  window.currentTournamentId = undefined;
  window.currentSessionId = undefined;
  window.currentMatchPlayer1Id = undefined;
  window.currentMatchPlayer2Id = undefined;
  window.tournamentPlayerMap = undefined;
}

async function startMatchLoop(onAbandonReset: () => Promise<void>): Promise<void> {
  for (let guard = 0; guard < 50; guard++) {
    const res = await fetch('/tournament_service/tournament/start-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId: window.currentTournamentId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      await uiAlert(data.error || `Start match failed (${res.status})`, 'Error');
      return;
    }

    if (Array.isArray(data.byes) && data.byes.length > 0) {
      for (const pid of data.byes) {
        await uiAlert(`Bye round:\n${nameOf(Number(pid))} advances automatically.`, 'Bye round');
      }
      if (!data.sessionId) continue;
    }

    if (data.tournamentFinished) {
      await uiAlert(`🏆 Tournament finished!\nWinner: ${data.winnerId ? nameOf(data.winnerId) : 'Unknown'}`, 'Tournament complete');

      clearRuntimeState();
      sessionStorage.removeItem(TOURNAMENT_UI_KEY);
      return;
    }

    if (!data.sessionId || !data.player1Id || !data.player2Id) {
      await uiAlert('No match available (server returned incomplete data).', 'Error');
      return;
    }

    // ✅ Store as pending BEFORE user decides, so Back doesn't skip
    const pending: PendingMatch = {
      tournamentId: Number(window.currentTournamentId),
      sessionId: Number(data.sessionId),
      player1Id: Number(data.player1Id),
      player2Id: Number(data.player2Id),
    };
    setPendingMatch(pending);

    const choice = await uiDialog<'start' | 'back' | 'abandon'>({
      title: 'Match ready',
      message: `Next match:\n${nameOf(pending.player1Id)} vs ${nameOf(pending.player2Id)}`,
      buttons: [
        { id: 'start', text: 'Start match', variant: 'primary' },
        { id: 'back', text: 'Back', variant: 'ghost' },
        { id: 'abandon', text: 'Abandon', variant: 'danger' },
      ],
      dismissible: true,
    });

    if (choice === 'abandon') {
      await onAbandonReset();
      return;
    }

    if (choice === 'back') {
      await uiAlert('Tournament paused. You can resume by clicking "Start Match".', 'Paused');
      // keep pendingMatch in storage
      return;
    }

    // Start match using pending (no new /start-match call)
    window.currentSessionId = pending.sessionId;
    window.currentMatchPlayer1Id = pending.player1Id;
    window.currentMatchPlayer2Id = pending.player2Id;
    // Tournament matches are NEVER AI matches - reset this flag
    window.currentSessionIsAI = false;

    setPendingMatch(null);
    saveTournamentUIState();
    location.hash = '#/game';
    return;
  }

  await uiAlert('Start match guard hit (unexpected tournament state).', 'Error');
}

export async function initTournamentUI() {
  const saved = loadTournamentUIState();
  tournamentPlayers = [];

  const form = document.getElementById('addPlayerForm') as HTMLFormElement | null;
  const list = document.getElementById('playerList') as HTMLUListElement | null;
  const info = document.getElementById('tournamentInfo') as HTMLDivElement | null;
  const startTournamentBtn = document.getElementById('startTournamentBtn') as HTMLButtonElement | null;
  const startMatchBtn = document.getElementById('startMatchBtn') as HTMLButtonElement | null;
  const resetBtn = document.getElementById('resetTournamentBtn') as HTMLButtonElement | null;

  if (!form || !list || !info || !startTournamentBtn || !startMatchBtn || !resetBtn) {
    console.error('Tournament UI missing elements');
    return;
  }

  startTournamentBtn.disabled = true;
  startMatchBtn.disabled = true;

  const nameInput = document.getElementById('tournamentName') as HTMLInputElement | null;

  function renderPlayers() {
    list!.innerHTML = '';
    tournamentPlayers.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.email} (id=${p.id})`;
      list!.appendChild(li);
    });

    startTournamentBtn!.disabled = tournamentPlayers.length < 3;
    saveTournamentUIState();
  }

  const me = await getMe();
  if (!me) {
    info.innerText = 'You are not logged in. Go back and login first.';
    return;
  }
  const mePlayer = me as TournamentPlayer;

  async function resetTournamentVisualAndState(deleteFromDb: boolean) {
    if (deleteFromDb && window.currentTournamentId) {
      await deleteTournamentFromDB(window.currentTournamentId);
    }

    clearRuntimeState();
    sessionStorage.removeItem(TOURNAMENT_UI_KEY);

    tournamentPlayers = [mePlayer];
    if (nameInput) nameInput.value = '';

    renderPlayers();
    startMatchBtn!.disabled = true;
    info!.innerText = 'Add players and create a tournament.';
  }

  // hydrate UI
  if (saved) {
    if (nameInput) nameInput.value = saved.name;

    tournamentPlayers = saved.players;
    if (!tournamentPlayers.some(p => p.id === mePlayer.id)) {
      tournamentPlayers.unshift(mePlayer);
    }

    window.currentTournamentId = saved.currentTournamentId ?? undefined;
    renderPlayers();

    // if tournament exists, allow start-match.
    // if a pending match exists, show that you can resume without skipping.
    if (window.currentTournamentId) {
      startMatchBtn.disabled = false;
      if (saved.pendingMatch && saved.pendingMatch.tournamentId === window.currentTournamentId) {
        info.innerText = `Tournament paused (id=${window.currentTournamentId}). Pending match ready: ${nameOf(saved.pendingMatch.player1Id)} vs ${nameOf(saved.pendingMatch.player2Id)}.`;
      } else {
        info.innerText = `Tournament already created (id=${window.currentTournamentId}).`;
      }
    } else {
      info.innerText = 'Add players and create a tournament.';
    }
  } else {
    tournamentPlayers.push(mePlayer);
    renderPlayers();
    info.innerText = 'Add players and create a tournament.';
  }

  nameInput?.addEventListener('input', saveTournamentUIState);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = (document.getElementById('playerEmail') as HTMLInputElement | null)?.value.trim() || '';
    const password = (document.getElementById('playerPassword') as HTMLInputElement | null)?.value || '';
    const otp = (document.getElementById('playerOtp') as HTMLInputElement | null)?.value.trim() || '';

    if (!email || !password || !otp) {
      await uiAlert('Please fill username / password / OTP.', 'Missing info');
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
    if (window.currentTournamentId) {
      const ok = await uiConfirm(
        'A tournament is already created. Creating a new one will abandon it.\nContinue?',
        'Overwrite tournament?',
        'Yes, create new',
        'Cancel'
      );
      if (!ok) return;

      await resetTournamentVisualAndState(true);
    }

    const name = nameInput?.value.trim() || 'Tournament';
    const playerIds = tournamentPlayers.map(p => p.id);

    // Helper to create tournament with retry on "already in active game" error
    async function tryCreateTournament(retryCount = 0): Promise<{ success: boolean; data?: any }> {
      // Prevent infinite retry loops
      if (retryCount > 2) {
        await uiAlert('Failed to create tournament after multiple attempts. Please try again later.', 'Error');
        return { success: false };
      }

      const res = await fetch('/tournament_service/tournament/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds, name }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = data.error || '';
        // Check if it's an "already in active game" error
        if (errMsg.includes('already in an active game')) {
          const confirmed = await uiConfirm(
            `${errMsg}\n\nThis may be from a previous game that didn't finish properly.\nDo you want to end those sessions and retry?`,
            'Active Session Detected',
            'End sessions and retry',
            'Cancel'
          );
          if (confirmed) {
            // Call force-end-sessions for all players
            await fetch('/tournament_service/tournament/force-end-sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerIds }),
            });
            // Retry with incremented count
            return tryCreateTournament(retryCount + 1);
          }
          return { success: false };
        }
        await uiAlert(data.error || `Create tournament failed (${res.status})`, 'Error');
        return { success: false };
      }
      return { success: true, data };
    }

    try {
      const result = await tryCreateTournament();
      if (!result.success || !result.data) return;

      const data = result.data;

      window.currentTournamentId = data.tournamentId;
      await loadTournamentPlayerMap(data.tournamentId);
      startMatchBtn.disabled = false;

      info.innerText = `Tournament created: "${data.name || name}" (id=${data.tournamentId}).`;
      saveTournamentUIState();

      const choice = await uiDialog<'start' | 'bracket' | 'close'>({
        title: 'Tournament created',
        message: `Tournament "${data.name || name}" is ready.\nWhat do you want to do next?`,
        buttons: [
          { id: 'start', text: 'Start Match', variant: 'primary' },
          { id: 'bracket', text: 'View Bracket', variant: 'ghost' },
          { id: 'close', text: 'Close', variant: 'ghost' },
        ],
        dismissible: true,
      });

      if (choice === 'start') {
        // if we already have a pending match (shouldn't after create, but safe), resume it
        await loadTournamentPlayerMap(window.currentTournamentId!);
        const pm = getPendingMatch();
        if (pm && pm.tournamentId === window.currentTournamentId) {
          window.currentSessionId = pm.sessionId;
          window.currentMatchPlayer1Id = pm.player1Id;
          window.currentMatchPlayer2Id = pm.player2Id;
          // Tournament matches are NEVER AI matches - reset this flag
          window.currentSessionIsAI = false;
          setPendingMatch(null);
          saveTournamentUIState();
          location.hash = '#/game';
          return;
        }

        await startMatchLoop(async () => resetTournamentVisualAndState(true));
      } else if (choice === 'bracket') {
          sessionStorage.setItem('bracketBackTo', '#/tournament');
          location.hash = `#/tournament_bracket?tournamentId=${data.tournamentId}`;
      }
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

    await loadTournamentPlayerMap(window.currentTournamentId);

    // ✅ Resume pending match without consuming a new one
    const pm = getPendingMatch();
    if (pm && pm.tournamentId === window.currentTournamentId) {
      const choice = await uiDialog<'start' | 'abandon' | 'cancel'>({
        title: 'Match ready',
        message: `Pending match:\n${nameOf(pm.player1Id)} vs ${nameOf(pm.player2Id)}`,
        buttons: [
          { id: 'start', text: 'Start match', variant: 'primary' },
          { id: 'abandon', text: 'Abandon', variant: 'danger' },
          { id: 'cancel', text: 'Cancel', variant: 'ghost' },
        ],
        dismissible: true,
      });

      if (choice === 'abandon') {
        await resetTournamentVisualAndState(true);
        return;
      }
      if (choice === 'cancel') return;

      window.currentSessionId = pm.sessionId;
      window.currentMatchPlayer1Id = pm.player1Id;
      window.currentMatchPlayer2Id = pm.player2Id;
      // Tournament matches are NEVER AI matches - reset this flag
      window.currentSessionIsAI = false;
      setPendingMatch(null);
      saveTournamentUIState();
      location.hash = '#/game';
      return;
    }

    await startMatchLoop(async () => resetTournamentVisualAndState(true));
  });

  resetBtn.addEventListener('click', async () => {
    if (!window.currentTournamentId) {
      await resetTournamentVisualAndState(false);
      await uiAlert('Nothing to delete — no active tournament.\nPlayers list was reset.', 'Reset');
      return;
    }

    const ok = await uiConfirm(
      'This will delete the active tournament and reset the setup.',
      'Reset tournament?',
      'Reset',
      'Cancel'
    );
    if (!ok) return;

    await resetTournamentVisualAndState(true);
    await uiAlert('Tournament reset.', 'Reset');
  });
}
