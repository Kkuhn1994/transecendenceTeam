interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  status: string;
  email?: string;
  userId?: number;
  error?: string;
}

async function createUser(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password };

  try {
    const response = await fetch('/login_service/createAccount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Create user failed:', err);
    return { status: 'error', error: (err as Error).message };
  }
}

async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password };

  try {
    const response = await fetch('/login_service/loginAccount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Login failed:', err);
    return { status: 'error', error: (err as Error).message };
  }
}

export function initLoginAndRegister() {
  const route = location.hash.replace('#', '') || '/';

  if (route === '/') {
    const form = document.getElementById('loginForm') as HTMLFormElement | null;
    const emailInput = document.getElementById('loginEmail') as HTMLInputElement | null;
    const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;

    if (!form || !emailInput || !passwordInput) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const res = await loginUser(email, password);

      if (res.status === 'ok') {
        location.hash = '#/home';
      } else {
        alert(res.error || 'Login failed');
      }
    });
  }

  if (route === '/register') {
    const form = document.getElementById('registerForm') as HTMLFormElement | null;
    const emailInput = document.getElementById('registerEmail') as HTMLInputElement | null;
    const passwordInput = document.getElementById('registerPassword') as HTMLInputElement | null;

    if (!form || !emailInput || !passwordInput) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const res = await createUser(email, password);

      if (res.status === 'ok') {
        alert('Account created. You can log in now.');
        location.hash = '#/';
      } else {
        alert(res.error || 'Registration failed');
      }
    });
  }
}
