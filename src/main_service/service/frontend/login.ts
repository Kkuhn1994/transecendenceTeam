alert("login.ts!");

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  status: string;
  email?: string;
  error?: string;
}

async function createUser(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password };

  try {
    alert("request");
    const response = await fetch('http://localhost:1080/login_service/createAccount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Server hat einen Fehlerstatus zurückgegeben
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data: LoginResponse = await response.json();
    return data;

  } catch (err) {
    console.error('Login failed:', err);
    return { status: 'error', error: (err as Error).message };
  }
}

async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password };

  try {
    alert("request");
    const response = await fetch('http://localhost:1080/login_service/loginAccount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Server hat einen Fehlerstatus zurückgegeben
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data: LoginResponse = await response.json();
    return data;

  } catch (err) {
    console.error('Login failed:', err);
    return { status: 'error', error: (err as Error).message };
  }
}

export function loginReady() {
  alert('Script und DOM sind geladen!');
console.log("login_start");

const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const form = document.querySelector('form') as HTMLFormElement;
const signUpButton = document.getElementById('signUp') as HTMLButtonElement;
const loginButton = document.getElementById('login') as HTMLButtonElement;

signUpButton.addEventListener('click', async (e) => {
  console.log('sbmit');
  e.preventDefault(); // verhindert normalen Form-Submit

  const email = emailInput.value;
  const password = passwordInput.value;

  const result = await createUser(email, password);
  console.log('Server response:', result);
});

loginButton.addEventListener('click', async (e) => {
  console.log('sbmit');
  e.preventDefault(); // verhindert normalen Form-Submit

  const email = emailInput.value;
  const password = passwordInput.value;

  const result = await loginUser(email, password);
  console.log('Server response:', result);
  location.hash = "#/profile";
});

}


