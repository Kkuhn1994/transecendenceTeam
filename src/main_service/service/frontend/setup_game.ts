export {};

declare global {
  interface Window {
    currentSessionId?: number;

    currentMatchPlayer1Name?: string;
    currentMatchPlayer2Name?: string;
    currentSessionIsAI?: boolean;

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

  // AI Match Elements
  const humanMatchRadio = document.getElementById(
    'humanMatch',
  ) as HTMLInputElement | null;
  const aiMatchRadio = document.getElementById(
    'aiMatch',
  ) as HTMLInputElement | null;
  const humanMatchSection = document.getElementById(
    'humanMatchSection',
  ) as HTMLDivElement | null;
  const aiMatchSection = document.getElementById(
    'aiMatchSection',
  ) as HTMLDivElement | null;
  const startAiMatchBtn = document.getElementById(
    'startAiMatch',
  ) as HTMLButtonElement | null;

  // Toggle between human and AI match sections
  function toggleMatchType() {
    if (humanMatchRadio?.checked) {
      if (humanMatchSection) humanMatchSection.style.display = 'block';
      if (aiMatchSection) aiMatchSection.style.display = 'none';
    } else if (aiMatchRadio?.checked) {
      if (humanMatchSection) humanMatchSection.style.display = 'none';
      if (aiMatchSection) aiMatchSection.style.display = 'block';
    }
  }

  // Add event listeners for radio buttons
  humanMatchRadio?.addEventListener('change', toggleMatchType);
  aiMatchRadio?.addEventListener('change', toggleMatchType);

  if (!form || !emailInput || !passwordInput || !otpInput) return;

  async function getMeEmail(): Promise<string | null> {
    try {
      const res = await fetch('/login_service/auth/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const me = await res.json().catch(() => ({}));
      return typeof me?.email === 'string' ? me.email : null;
    } catch {
      return null;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = '';

    const player2Email = emailInput.value.trim();
    const player2Password = passwordInput.value;
    const otp = otpInput.value.trim();

    async function tryCreateSession(): Promise<boolean> {
      const response = await fetch('/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player2Email, player2Password, otp }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (errorEl)
          errorEl.textContent = data.error || 'Could not create session';
        return false;
      }

      if (!data.sessionId) {
        if (errorEl) errorEl.textContent = 'No sessionId returned';
        return false;
      }

      if (!data.pairingToken) {
        if (errorEl) errorEl.textContent = 'No pairingToken returned';
        return false;
      }

      window.currentSessionId = data.sessionId;
      window.currentSessionIsAI = false;
      window.lastPairingToken = String(data.pairingToken);

      window.lastP2Email = player2Email;
      window.lastP2Password = player2Password;
      return true;
    }

    try {
      //  store player2 name right away (we already know it)
      window.currentMatchPlayer2Name = player2Email || 'Player 2';

      //  fetch player1 name (logged-in user)
      const meEmail = await getMeEmail();
      window.currentMatchPlayer1Name = meEmail || 'Player 1';

      const success = await tryCreateSession();
      if (success) {
        // Go to game
        location.hash = '#/game';
      }
    } catch (err) {
      if (errorEl) errorEl.textContent = 'Network error while creating session';
    }
  });

  // AI Match Handler
  startAiMatchBtn?.addEventListener('click', async () => {
    if (errorEl) errorEl.textContent = '';

    async function tryCreateAISession(): Promise<boolean> {
      const response = await fetch('/session/create_ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (errorEl)
          errorEl.textContent = data.error || 'Could not create AI session';
        return false;
      }

      if (!data.sessionId) {
        if (errorEl) errorEl.textContent = 'No sessionId returned';
        return false;
      }

      window.currentSessionId = data.sessionId;
      window.currentSessionIsAI = true;
      return true;
    }

    try {
      // Get player 1 name
      const meEmail = await getMeEmail();
      window.currentMatchPlayer1Name = meEmail || 'Player 1';
      window.currentMatchPlayer2Name = 'AI Bot';

      const success = await tryCreateAISession();
      if (success) {
        // Go to game
        location.hash = '#/game';
      }
    } catch (err) {
      if (errorEl)
        errorEl.textContent = 'Network error while creating AI session';
    }
  });
}
