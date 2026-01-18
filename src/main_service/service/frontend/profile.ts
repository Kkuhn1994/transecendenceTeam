export {};

type FriendLite = {
  id: number;
  email: string;
  nickname: string | null;
  avatar: string;
};

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

function readFriendFromSession(): FriendLite | null {
  try {
    const raw = sessionStorage.getItem('friendProfile');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.email) return null;
    return {
      id: Number(parsed.id),
      email: String(parsed.email),
      nickname: parsed.nickname != null ? String(parsed.nickname) : null,
      avatar: parsed.avatar != null ? String(parsed.avatar) : '',
    };
  } catch {
    return null;
  }
}

export async function initProfile() {
  const infoDiv = document.getElementById('profileInfo') as HTMLDivElement | null;
  const historyBtn = document.getElementById('viewHistory') as HTMLButtonElement | null;
  const actions = document.getElementById('profileActions') as HTMLDivElement | null;

  if (!infoDiv) return;

  const friendId = getUserIdFromHash();

  // FRIEND PROFILE VIEW (no backend call needed)
  if (friendId) {
    const friend = readFriendFromSession();

    // Hide history button for friend profiles
    if (actions) actions.style.display = 'none';

    if (!friend || friend.id !== friendId) {
      infoDiv.innerHTML = `
        <p>Friend profile not found in session.</p>
        <p style="opacity:0.8;">Go back to Friends and click "See profile" again.</p>
        <button id="backToFriends" class="btn btn-primary">Back to Friends</button>
      `;
      document.getElementById('backToFriends')?.addEventListener('click', () => {
        location.hash = '#/friends';
      });
      return;
    }

    const displayName = friend.nickname || friend.email;

    infoDiv.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
        ${
          friend.avatar
            ? `<img src="${friend.avatar}" alt="Avatar"
                style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #00ffff;background:#222;"
                onerror="this.style.display='none';" />`
            : `<div style="width:72px;height:72px;border-radius:50%;background:#222;border:2px solid #00ffff;display:flex;align-items:center;justify-content:center;">👤</div>`
        }
        <div>
          <div style="font-size:18px;font-weight:bold;">${displayName}</div>
          <div style="opacity:0.8;">${friend.email}</div>
          <div style="opacity:0.6;font-size:12px;">id=${friend.id}</div>
        </div>
      </div>

      <p style="opacity:0.85;">Friend profile view (stats coming soon).</p>

      <div class="mt-3">
        <button id="backToFriends" class="btn btn-primary">Back to Friends</button>
      </div>
    `;

    document.getElementById('backToFriends')?.addEventListener('click', () => {
      location.hash = '#/friends';
    });

    return;
  }

  // MY PROFILE VIEW (your original logic)
  try {
    const res = await fetch('/profile/me');
    const data = await res.json();

    if (!res.ok) {
      infoDiv.textContent = data.error || 'Could not load profile.';
      return;
    }

    const winratePercent = (data.winrate * 100).toFixed(1);

    infoDiv.innerHTML = `
      <p>Email: ${data.email}</p>
      <p>Games played: ${data.gamesPlayed}</p>
      <p>Wins: ${data.wins}</p>
      <p>Winrate: ${winratePercent}%</p>
    `;
  } catch (err) {
    console.error('Error loading profile:', err);
    infoDiv.textContent = 'Network error.';
  }

  if (actions) actions.style.display = 'block';

  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      location.hash = '#/history';
    });
  }
}

export async function initHistory() {
  const container = document.getElementById('historyContainer') as HTMLDivElement | null;
  if (!container) return;

  try {
    const res = await fetch('/profile/history');
    const data = await res.json();

    if (!res.ok) {
      container.textContent = data.error || 'Could not load history.';
      return;
    }

    const matches = data.matches || [];
    if (matches.length === 0) {
      container.textContent = 'No matches played yet.';
      return;
    }

    let html = `<table border="1" cellpadding="4" cellspacing="0">
      <tr>
        <th>ID</th>
        <th>Player 1</th>
        <th>Player 2</th>
        <th>Score</th>
        <th>Winner</th>
        <th>Started</th>
        <th>Ended</th>
      </tr>
    `;

    for (const m of matches) {
      const winner =
        m.winner_id === m.player1_id
          ? m.player1_email
          : m.winner_id === m.player2_id
          ? m.player2_email
          : '–';

      html += `
        <tr>
          <td>${m.id}</td>
          <td>${m.player1_email}</td>
          <td>${m.player2_email}</td>
          <td>${m.score1} : ${m.score2}</td>
          <td>${winner}</td>
          <td>${m.started_at || ''}</td>
          <td>${m.ended_at || ''}</td>
        </tr>
      `;
    }

    html += `</table>`;
    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading history:', err);
    container.textContent = 'Network error.';
  }
}
