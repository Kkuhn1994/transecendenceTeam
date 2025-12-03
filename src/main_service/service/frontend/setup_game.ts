export function init1v1Setup() {
  const form = document.getElementById('player2Form') as HTMLFormElement | null;
  const emailInput = document.getElementById('player2Email') as HTMLInputElement | null;
  const passwordInput = document.getElementById('player2Password') as HTMLInputElement | null;
  const errorEl = document.getElementById('player2Error') as HTMLParagraphElement | null;

  if (!form || !emailInput || !passwordInput) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = '';

    const player2Email = emailInput.value.trim();
    const player2Password = passwordInput.value;

    try {
      const response = await fetch('/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player2Email, player2Password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (errorEl) errorEl.textContent = data.error || 'Could not create session';
        return;
      }

      if (!data.sessionId) {
        if (errorEl) errorEl.textContent = 'No sessionId returned';
        return;
      }

      (window as any).currentSessionId = data.sessionId;

      // Go to game
      location.hash = '#/game';
    } catch (err) {
      console.error('Error creating session:', err);
      if (errorEl) errorEl.textContent = 'Network error while creating session';
    }
  });
}
