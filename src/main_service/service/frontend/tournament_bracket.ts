export {};

import { uiAlert } from './ui_modal';

type BracketMatch = {
  round: number;
  match_index: number;
  player1_id: number;
  player1_email: string;
  player2_id: number | null;
  player2_email: string | null;
  session_id: number | null;
  winner_id: number | null;
  winner_email: string | null;
  created_at: string;
};

type BracketPayload = {
  tournament: {
    id: number;
    name: string;
    created_at: string;
    winner_id: number | null;
  };
  matches: BracketMatch[];
};

function getTournamentIdFromHash(): number | null {
  const fullRoute = location.hash.replace('#', '') || '/';
  const qs = fullRoute.split('?')[1] || '';
  const params = new URLSearchParams(qs);
  const v = params.get('tournamentId');
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function initTournamentBracket() {
  const root = document.getElementById('bracketRoot') as HTMLDivElement | null;
  if (!root) return;

  const backBtn = document.getElementById('backToTournament');
  backBtn?.addEventListener('click', () => {
    const backTo = sessionStorage.getItem('bracketBackTo') || '#/tournament';
    location.hash = backTo;
  });

  const id = getTournamentIdFromHash();
  if (!id) {
    root.innerHTML = '<p><i class="fas fa-exclamation-triangle"></i> Missing tournamentId.</p>';
    return;
  }

  try {
    const res = await fetch(`/tournament_service/tournament/${id}/bracket`);
    const data: BracketPayload = await res.json().catch(() => ({}) as any);

    if (!res.ok) {
      await uiAlert(
        (data as any)?.error || `Failed to load bracket (${res.status})`,
        'Error',
      );
      root.innerHTML = '<p><i class="fas fa-times-circle"></i> Could not load bracket.</p>';
      return;
    }

    const byRound = new Map<number, BracketMatch[]>();
    for (const m of data.matches || []) {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round)!.push(m);
    }
    for (const [r, arr] of byRound) {
      arr.sort((a, b) => a.match_index - b.match_index);
      byRound.set(r, arr);
    }

    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);

    let winnerName: string | null = null;
    if (data.tournament.winner_id != null) {
      const w = (data.matches || []).find(
        (m) => m.winner_id === data.tournament.winner_id,
      );
      winnerName = w?.winner_email || `Player ${data.tournament.winner_id}`;
    }

    let html = `
      <div class="mb-3">
        <div class="bracket-header-title">
          <i class="fas fa-trophy"></i> ${data.tournament.name}
        </div>
        <div class="bracket-header-sub">
          <i class="fas fa-hashtag"></i> Tournament id=${data.tournament.id}
        </div>
        ${
          winnerName
            ? `<div class="bracket-header-winner"><i class="fas fa-medal"></i> Winner: <b>${winnerName}</b></div>`
            : ''
        }
      </div>

      <div class="bracket-scroll">
        <div class="bracket">
    `;

    for (const r of rounds) {
      const matches = byRound.get(r)!;

      html += `
        <div class="bracket-round">
          <div class="bracket-round-title">
            <i class="fas fa-layer-group"></i> Round ${r}
          </div>
          <div class="bracket-matches">
      `;

      for (const m of matches) {
        const p1 = m.player1_email || `Player ${m.player1_id}`;
        const p2 = m.player2_id ? (m.player2_email || `Player ${m.player2_id}`) : 'BYE';
        const w = m.winner_id ? (m.winner_email || `Player ${m.winner_id}`) : null;

        html += `
          <div class="bracket-match">
            <div class="bracket-row">
              <span><i class="fas fa-user"></i> ${p1}</span>
            </div>

            <div class="bracket-row">
              <span>
                ${
                  m.player2_id
                    ? `<i class="fas fa-user"></i> ${p2}`
                    : `<i class="fas fa-fast-forward"></i> ${p2}`
                }
              </span>
            </div>

            <div class="bracket-meta">
              ${
                w
                  ? `<i class="fas fa-crown"></i> Winner: <b>${w}</b>`
                  : `<i class="fas fa-hourglass-half"></i> Pending`
              }
            </div>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }
    
    html += `
      </div>
    </div>
    `;
    root.innerHTML = html;
  } catch (e) {
    await uiAlert('Bracket request crashed', 'Network error');
    root.innerHTML = '<p><i class="fas fa-exclamation-triangle"></i> Network error.</p>';
  }
}
