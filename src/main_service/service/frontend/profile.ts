export {};

function getUserIdFromHash(): number | null {
  const fullRoute = location.hash.replace('#', '') || '/';
  const qs = fullRoute.split('?')[1] || '';
  const params = new URLSearchParams(qs);
  const v = params.get('userId');
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

type FetchJsonResult<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw?: string;
};

async function fetchJson<T = any>(
  url: string,
  opts: { method?: string; body?: any } = {}
): Promise<FetchJsonResult<T>> {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const raw = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(raw) };
  } catch {
    return { ok: res.ok, status: res.status, data: null, raw };
  }
}

async function getMeId(): Promise<number | null> {
  const me = await fetchJson('/login_service/auth/me', { method: 'POST' });
  if (!me.ok || !me.data?.id) return null;
  const id = Number(me.data.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function initProfile() {
  const infoDiv = document.getElementById('profileInfo') as HTMLDivElement | null;
  const historyBtn = document.getElementById('viewHistory') as HTMLButtonElement | null;
  const actions = document.getElementById('profileActions') as HTMLDivElement | null;

  if (!infoDiv) return;
  if (actions) actions.style.display = 'block';

  // if URL has ?userId => friend, else self
  const friendId = getUserIdFromHash();
  const effectiveUserId = friendId || (await getMeId());

  if (!effectiveUserId) {
    infoDiv.textContent = 'Could not determine user.';
    return;
  }

  // Profile
  const p = await fetchJson(`/login_service/user/profile?userId=${effectiveUserId}`);
  if (!p.ok || !p.data) {
    infoDiv.innerHTML = `
      <p>Could not load profile (HTTP ${p.status}).</p>
      ${friendId ? `<button id="backToFriends" class="btn btn-primary">Back to Friends</button>` : ''}
    `;
    document.getElementById('backToFriends')?.addEventListener('click', () => {
      location.hash = '#/friends';
    });
    return;
  }

  const profile = p.data; // { id, email, nickname, avatar, is_active, last_login }

  const s = await fetchJson(`/login_service/user/summary?userId=${effectiveUserId}`);
  const stats = s.ok && s.data
    ? s.data
    : { gamesPlayed: 0, wins: 0, losses: 0, winrate: 0, tournamentsWon: 0 };

  const displayName = profile.nickname || profile.email;
  const lastSeen = profile.is_active
    ? 'Online'
    : `Last seen ${profile.last_login ? new Date(profile.last_login).toLocaleString() : 'Never'}`;
  const winratePercent = ((stats.winrate ?? 0) * 100).toFixed(1);

  infoDiv.innerHTML = `
    <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
      ${
        profile.avatar
          ? `<img src="${profile.avatar}" alt="Avatar"
              style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #00ffff;background:#222;"
              onerror="this.style.display='none';" />`
          : `<div style="width:72px;height:72px;border-radius:50%;background:#222;border:2px solid #00ffff;display:flex;align-items:center;justify-content:center;">👤</div>`
      }
      <div>
        <div style="font-size:18px;font-weight:bold;">${displayName}</div>
        <div style="opacity:0.75; margin-top:4px;">${lastSeen}</div>
      </div>
    </div>

    <div style="opacity:0.95; line-height:1.6;">
      <div><b>Games played:</b> ${stats.gamesPlayed ?? 0}</div>
      <div><b>Wins:</b> ${stats.wins ?? 0}</div>
      <div><b>Losses:</b> ${stats.losses ?? 0}</div>
      <div><b>Winrate:</b> ${winratePercent}%</div>
      <div><b>Tournaments won:</b> ${stats.tournamentsWon ?? 0}</div>
    </div>
  `;

  if (historyBtn) {
    historyBtn.textContent = 'Match History';
    historyBtn.onclick = () => {
      // always pass userId so history loads the right person (self or friend)
      location.hash = `#/history?userId=${effectiveUserId}`;
    };
  }
}

export async function initHistory() {
  const container = document.getElementById('historyContainer') as HTMLDivElement | null;
  if (!container) return;

  // friend history via ?userId, else self history
  const userIdFromHash = getUserIdFromHash();
  const effectiveUserId = userIdFromHash || (await getMeId());

  if (!effectiveUserId) {
    container.textContent = 'Could not determine user.';
    return;
  }

  const r = await fetchJson(`/login_service/user/matches?userId=${effectiveUserId}&limit=25`);
  if (!r.ok || !r.data) {
    container.textContent = `Could not load history (HTTP ${r.status}).`;
    return;
  }

  const matches = r.data.matches || [];
  if (matches.length === 0) {
    container.textContent = 'No matches played yet.';
    return;
  }

  let html = `<table class="history-table" border="1" cellpadding="4" cellspacing="0">
    <tr>
      <th>ID</th>
      <th>Player 1</th>
      <th>Player 2</th>
      <th>Score</th>
      <th>Winner</th>
      <th>Tournament</th>
      <th>Bracket</th>
      <th>Started</th>
      <th>Ended</th>
    </tr>
  `;

  for (const m of matches) {
    const p1 = m.player1_nickname || m.player1_email || `Player ${m.player1_id}`;
    const p2 = m.player2_nickname || m.player2_email || `Player ${m.player2_id}`;

    const winner =
      m.winner_id === m.player1_id ? p1 : m.winner_id === m.player2_id ? p2 : '–';

    const tName = m.tournament_id ? (m.tournament_name || `Tournament ${m.tournament_id}`) : '–';

    const bracketBtn = m.tournament_id
      ? `<button class="btn btn-primary" data-tour="${m.tournament_id}">See tournament</button>`
      : '–';

    html += `
      <tr>
        <td>${m.id}</td>
        <td>${p1}</td>
        <td>${p2}</td>
        <td>${m.score1} : ${m.score2}</td>
        <td>${winner}</td>
        <td>${tName}</td>
        <td>${bracketBtn}</td>
        <td>${m.started_at || ''}</td>
        <td>${m.ended_at || ''}</td>
      </tr>
    `;
  }

  html += `</table>`;
  container.innerHTML = html;

  container.querySelectorAll('button[data-tour]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLButtonElement).dataset.tour;
      if (!id) return;
      sessionStorage.setItem('bracketBackTo', `#/history?userId=${effectiveUserId}`);
      location.hash = `#/tournament_bracket?tournamentId=${id}`;
    });
  });
}
