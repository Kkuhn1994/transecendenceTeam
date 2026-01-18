export {};

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
      alert(data.error || 'Invalid credentials');
      return null;
    }

    if (!data?.id || !data?.email) {
      alert('verifyCredentials returned invalid payload');
      return null;
    }

    return { id: data.id, email: data.email };
  } catch (e) {
    console.error('verifyPlayer failed:', e);
    alert('verifyCredentials crashed (network/server)');
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
      alert('Please fill email/password/otp');
      return;
    }

    const player = await verifyPlayer(email, password, otp);
    if (!player) return;

    if (hasPlayer(player.id)) {
      alert('That account is already added to the tournament.');
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
        alert(data.error || `Create tournament failed (${res.status})`);
        return;
      }

      window.currentTournamentId = data.tournamentId;

      info.innerText = `Tournament created (id=${data.tournamentId}). Click "Start Match".`;
      startMatchBtn.disabled = false;
    } catch (e) {
      console.error(e);
      alert('Create tournament request crashed');
    }
  });

  startMatchBtn.addEventListener('click', async () => {
    try {
      rebuildPlayerMap();

      const res = await fetch('/game_service/tournament/start-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: window.currentTournamentId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || `Start match failed (${res.status})`);
        return;
      }

      if (data.bye) {
        alert('Bye round: one player advances automatically.');
        return;
      }

      window.currentMatchPlayer1Id = data.player1Id;
      window.currentMatchPlayer2Id = data.player2Id;

      alert(`🏓 Match starting!\n${nameOf(data.player1Id)} vs ${nameOf(data.player2Id)}`);

      window.currentSessionId = data.sessionId;
      location.hash = '#/game';
    } catch (e) {
      console.error(e);
      alert('Start match request crashed');
    }
  });
}
