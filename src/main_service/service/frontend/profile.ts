export async function initProfile() {
  const infoDiv = document.getElementById('profileInfo') as HTMLDivElement | null;
  const historyBtn = document.getElementById('viewHistory') as HTMLButtonElement | null;

  if (!infoDiv) return;

  try {
    const res = await fetch('/profile/me');
    const data = await res.json();

    if (!res.ok) {
      infoDiv.textContent = data.error || 'Could not load profile.';
      return;
    }

    const winratePercent = (data.winrate * 100).toFixed(1);

    infoDiv.innerHTML = `
      <p>Username: ${data.email}</p>
      <p>Games played: ${data.gamesPlayed}</p>
      <p>Wins: ${data.wins}</p>
      <p>Winrate: ${winratePercent}%</p>
    `;
  } catch (err) {
    console.error('Error loading profile:', err);
    infoDiv.textContent = 'Network error.';
  }

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
