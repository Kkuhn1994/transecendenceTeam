export {};

declare global {
  interface Window {
    currentSessionId?: number;

    currentMatchPlayer1Name?: string;
    currentMatchPlayer2Name?: string;

    lastPairingToken?: string;

    lastP2Email?: string;
    lastP2Password?: string;
    lastP2Otp?: string;
  }
}


export function init1v1Setup() {
  const form = document.getElementById('player2Form') as HTMLFormElement | null;
  const emailInput = document.getElementById(
    'player2Email',
  ) as HTMLInputElement | null;
  const passwordInput = document.getElementById(
    'player2Password',
  ) as HTMLInputElement | null;
  const otpInput = document.getElementById('otp') as HTMLInputElement | null;
  const errorEl = document.getElementById(
    'player2Error',
  ) as HTMLParagraphElement | null;

  if (!form || !emailInput || !passwordInput || !otpInput) return;

  async function getMeEmail(): Promise<string | null> {
    try {
      const res = await fetch('/login_service/auth/me', { method: 'POST' });
      if (!res.ok) return null;
      const me = await res.json().catch(() => ({}));
      return typeof me?.email === 'string' ? me.email : null;
    } catch {
      console.log('auth me fail');
      return null;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = '';

    const player2Email = emailInput.value.trim();
    const player2Password = passwordInput.value;
    const otp = otpInput.value.trim();

    try {
      //  store player2 name right away (we already know it)
      window.currentMatchPlayer2Name = player2Email || 'Player 2';

      //  fetch player1 name (logged-in user)
      const meEmail = await getMeEmail();
      window.currentMatchPlayer1Name = meEmail || 'Player 1';

      const response = await fetch('/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player2Email, player2Password, otp }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (errorEl)
          errorEl.textContent = data.error || 'Could not create session';
        return;
      }

      if (!data.sessionId) {
        if (errorEl) errorEl.textContent = 'No sessionId returned';
        return;
      }

      if (!data.pairingToken) {
        if (errorEl) errorEl.textContent = 'No pairingToken returned';
        return;
      }

      window.currentSessionId = data.sessionId;
      window.lastPairingToken = String(data.pairingToken);

      window.lastP2Email = player2Email;
      window.lastP2Password = player2Password;
      // Go to game
      location.hash = '#/game';
    } catch (err) {
      console.error('Error creating session:', err);
      if (errorEl) errorEl.textContent = 'Network error while creating session';
    }
  });
}
