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
    root.textContent = 'Missing tournamentId.';
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
      root.textContent = 'Could not load bracket.';
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
        <div style="font-size:18px;font-weight:700;">${data.tournament.name}</div>
        <div style="opacity:0.8;font-size:12px;">Tournament id=${data.tournament.id}</div>
        ${winnerName ? `<div style="margin-top:8px;">🏆 Winner: <b>${winnerName}</b></div>` : ''}
      </div>

      <div style="display:flex; gap:16px; overflow:auto; padding-bottom:10px;">
    `;

    for (const r of rounds) {
      const matches = byRound.get(r)!;

      html += `
        <div style="min-width:260px;">
          <div style="font-weight:700; margin-bottom:10px;">Round ${r}</div>
      `;

      for (const m of matches) {
        const p1 = m.player1_email || `Player ${m.player1_id}`;
        const p2 = m.player2_id
          ? m.player2_email || `Player ${m.player2_id}`
          : 'BYE';
        const w = m.winner_id
          ? m.winner_email || `Player ${m.winner_id}`
          : null;

        html += `
          <div style="
            border:1px solid rgba(0,255,255,0.35);
            border-radius:10px;
            padding:10px;
            margin-bottom:10px;
            background: rgba(0,0,0,0.12);
          ">
            <div>${p1} <span style="opacity:0.7;">vs</span> ${p2}</div>
            ${
              w
                ? `<div style="margin-top:6px; opacity:0.9;">Winner: <b>${w}</b></div>`
                : `<div style="margin-top:6px; opacity:0.6;">Pending</div>`
            }
          </div>
        `;
      }

      html += `</div>`;
    }

    html += `</div>`;
    root.innerHTML = html;
  } catch (e) {
    await uiAlert('Bracket request crashed', 'Network error');
    root.textContent = 'Network error.';
  }
}
