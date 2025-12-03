const app = document.getElementById("app") as HTMLDivElement | null;

type ViewMap = Record<string, string>;

const views: ViewMap = {
  "/": `
    <h1>Login</h1>
    <form id="loginForm">
      <div>
        <label>Email</label><br />
        <input type="email" id="loginEmail" required />
      </div>
      <div>
        <label>Password</label><br />
        <input type="password" id="loginPassword" required />
      </div>
      <button type="submit">Login</button>
    </form>
    <p>
      Not registered? <a href="#/register">Sign up</a>
    </p>
  `,

  "/register": `
    <h1>Register</h1>
    <form id="registerForm">
      <div>
        <label>Email</label><br />
        <input type="email" id="registerEmail" required />
      </div>
      <div>
        <label>Password</label><br />
        <input type="password" id="registerPassword" required />
      </div>
      <button type="submit">Create account</button>
    </form>
    <p>
      Already have an account? <a href="#/">Login</a>
    </p>
  `,

  "/home": `
    <div class="nav">
      <button id="navHome">Home</button>
      <button id="navPlay">Play</button>
      <button id="navProfile">Profile</button>
      <button id="navLogout">Logout</button>
    </div>
    <h1>Home</h1>
    <p>Welcome! Choose what you want to do:</p>
    <button id="goPlay">Play</button>
    <button id="goProfile">Profile</button>
  `,

  "/play": `
    <div class="nav">
      <button id="navHome">Home</button>
      <button id="navPlay">Play</button>
      <button id="navProfile">Profile</button>
      <button id="navLogout">Logout</button>
    </div>
    <h1>Play</h1>
    <button id="go1v1">1v1</button>
    <button id="goTournament" disabled>Start Tournament (coming later)</button>
  `,

  "/1v1": `
    <div class="nav">
      <button id="navHome">Home</button>
      <button id="navPlay">Play</button>
      <button id="navProfile">Profile</button>
      <button id="navLogout">Logout</button>
    </div>
    <h1>1v1 Setup</h1>
    <p>Player 1 is the currently logged in user.</p>
    <p>Player 2 must log in here:</p>
    <form id="player2Form">
      <div>
        <label>Player 2 Email</label><br />
        <input type="email" id="player2Email" required />
      </div>
      <div>
        <label>Player 2 Password</label><br />
        <input type="password" id="player2Password" required />
      </div>
      <button type="submit">Start Match</button>
    </form>
    <p id="player2Error" style="color:red;"></p>
  `,

  "/game": `
    <div class="nav">
      <button id="navHome">Home</button>
      <button id="navPlay">Play</button>
      <button id="navProfile">Profile</button>
      <button id="navLogout">Logout</button>
    </div>
    <h1>Pong Game</h1>
    <canvas id="pongCanvas" width="800" height="400"></canvas>
  `,

  "/profile": `
    <div class="nav">
      <button id="navHome">Home</button>
      <button id="navPlay">Play</button>
      <button id="navProfile">Profile</button>
      <button id="navLogout">Logout</button>
    </div>
    <h1>Profile</h1>
    <div id="profileInfo">Loading...</div>
    <button id="viewHistory">Match History</button>
  `,

  "/history": `
    <div class="nav">
      <button id="navHome">Home</button>
      <button id="navPlay">Play</button>
      <button id="navProfile">Profile</button>
      <button id="navLogout">Logout</button>
    </div>
    <h1>Match History</h1>
    <div id="historyContainer">Loading...</div>
  `,
};

declare global {
  interface Window {
    pongInterval: any;
    currentSessionId?: number;
  }
}

async function loadLoginModule() {
  const module = await import('./login');
  module.initLoginAndRegister();
}

async function loadGameFrontend() {
  const module = await import('./game_frontend');
  module.startGame();
}

async function load1v1Module() {
  const module = await import('./setup_game');
  module.init1v1Setup();
}

async function loadProfileModule() {
  const module = await import('./profile');
  module.initProfile();
}

async function loadHistoryModule() {
  const module = await import('./profile');
  module.initHistory();
}

async function handleNavButtons() {
  const homeBtn = document.getElementById('navHome');
  const playBtn = document.getElementById('navPlay');
  const profileBtn = document.getElementById('navProfile');
  const logoutBtn = document.getElementById('navLogout');

  if (homeBtn) homeBtn.addEventListener('click', () => (location.hash = '#/home'));
  if (playBtn) playBtn.addEventListener('click', () => (location.hash = '#/play'));
  if (profileBtn) profileBtn.addEventListener('click', () => (location.hash = '#/profile'));

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/login_service/logout', { method: 'POST' });
      window.currentSessionId = undefined;
      location.hash = '#/';
    });
  }
}

// Simple router
async function router() {
  if (!app) return;

  const route = location.hash.replace('#', '') || '/';

  app.innerHTML = views[route] || '<h1>404 Not Found</h1>';

  if (route === '/' || route === '/register') {
    await loadLoginModule();
  }

  if (route === '/home') {
    await handleNavButtons();
    const playBtn = document.getElementById('goPlay');
    const profileBtn = document.getElementById('goProfile');
    playBtn?.addEventListener('click', () => (location.hash = '#/play'));
    profileBtn?.addEventListener('click', () => (location.hash = '#/profile'));
  }

  if (route === '/play') {
    await handleNavButtons();
    const btn1v1 = document.getElementById('go1v1');
    btn1v1?.addEventListener('click', () => (location.hash = '#/1v1'));
  }

  if (route === '/1v1') {
    await handleNavButtons();
    await load1v1Module();
  }

  if (route === '/game') {
    await handleNavButtons();
    await loadGameFrontend();
  }

  if (route === '/profile') {
    await handleNavButtons();
    await loadProfileModule();
  }

  if (route === '/history') {
    await handleNavButtons();
    await loadHistoryModule();
  }
}

window.addEventListener('load', () => {
  router();
});

window.addEventListener('hashchange', () => {
  router();
});
