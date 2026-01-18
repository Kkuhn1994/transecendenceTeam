export {};
import { initTournamentUI } from './tournament';

const app = document.getElementById("app") as HTMLDivElement | null;

type ViewMap = Record<string, string>;

const views: ViewMap = {
  "/": `
    <div class="login-container">
      <h1>Pong Login</h1>
      <form id="loginForm" novalidate>
        <div class="mb-3">
          <label for="loginEmail" class="form-label">Email</label>
          <input 
            type="email" 
            id="loginEmail" 
            class="form-control" 
            placeholder="Enter your email" 
            autocomplete="email"
            maxlength="254"
            required 
          />
        </div>
        <div class="mb-3">
          <label for="loginPassword" class="form-label">Password</label>
          <input 
            type="password" 
            id="loginPassword" 
            class="form-control" 
            placeholder="Enter your password" 
            autocomplete="current-password"
            maxlength="128"
            required 
          />
        </div>
         <div class="mb-3">
          <label for="otp" class="form-label">OTP</label>
          <input 
            id="otp" 
            class="form-control" 
            placeholder="Enter your OTP" 
            maxlength="6"
            required 
          />
        </div>
        <button type="submit" class="btn btn-primary">Login</button>
      </form>
      <p class="text-center mt-3">
        Not registered? <a href="#/register">Sign up</a>
      </p>
    </div>
  `,

  "/register": `
    <div class="login-container">
      <h1>🎆 Create Account</h1>
      <form id="registerForm" novalidate>
        <div class="mb-3">
          <label for="registerEmail" class="form-label">Email</label>
          <input 
            type="email" 
            id="registerEmail" 
            class="form-control" 
            placeholder="Enter your email" 
            autocomplete="email"
            maxlength="254"
            required 
          />
        </div>
        <div class="mb-3">
          <label for="registerPassword" class="form-label">Password</label>
          <input 
            type="password" 
            id="registerPassword" 
            class="form-control" 
            placeholder="Create a password" 
            autocomplete="new-password"
            maxlength="128"
            required 
          />
        </div>
        <button type="submit" class="btn btn-primary">Create account</button>
      </form>
      <p class="text-center mt-3">
        Already have an account? <a href="#/">Login</a>
      </p>
      <div class="col-md-4 d-flex justify-content-center align-items-center" style="min-height: 200px;">
        <div class="mb-3" id="qr-container"></div>
      </div>

    </div>
  `,

  "/home": `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navLogout">Logout</button>
      </div>
      <h1>🏠 Home</h1>
      <p>Welcome to Pong! Choose what you want to do:</p>
      <div class="d-flex gap-3 justify-content-center mt-4">
        <button id="goPlay" class="btn btn-primary">🎮 Play Game</button>
        <button id="goProfile" class="btn btn-primary">👤 Profile</button>
        <button id="goFriends" class="btn btn-primary">👥 Friends</button>
      </div>
    </div>
  `,

  "/play": `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navLogout">Logout</button>
      </div>
      <h1>🎮 Play Game</h1>
      <div class="d-flex gap-3 justify-content-center mt-4">
        <button id="go1v1" class="btn btn-primary">⚔️ 1v1 Match</button>
        <button id="goTournament" class="btn btn-secondary">🏆 Create Tournament</button>
      </div>
    </div>
  `,

  "/1v1": `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navLogout">Logout</button>
      </div>
      <h1>⚔️ 1v1 Match Setup</h1>
      <p>Player 1 is the currently logged in user.</p>
      <p>Player 2 must log in here:</p>
      <form id="player2Form">
        <div class="mb-3">
          <label for="player2Email" class="form-label">Player 2 Email</label>
          <input type="email" id="player2Email" class="form-control" placeholder="Enter Player 2's email" required />
        </div>
        <div class="mb-3">
          <label for="player2Password" class="form-label">Player 2 Password</label>
          <input type="password" id="player2Password" class="form-control" placeholder="Enter Player 2's password" required />
        </div>
        <div class="mb-3">
          <label for="playerOTP" class="form-label">OTP</label>
          <input id="otp" class="form-control" placeholder="Enter Player 2's OTP" required />
        </div>
        <button type="submit" class="btn btn-primary">🚀 Start Match</button>
      </form>
      <p id="player2Error" style="color:#ff6b6b;" class="mt-3"></p>
    </div>
  `,

  "/game": `
    <div class="game-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navLogout">Logout</button>
      </div>
      <h1 class="game-title">PONG</h1>
      <canvas id="pongCanvas" width="800" height="400"></canvas>
      <div class="game-controls">
        <p>Player 1: W/S keys | Player 2: ↑/↓ arrow keys</p>
        <p>First to 11 points wins!</p>
      </div>
    </div>
  `,

  "/profile": `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navLogout">Logout</button>
      </div>
      <h1>👤 Profile</h1>
      <div id="profileInfo" class="mb-4">Loading...</div>
      <div class="text-center" id="profileActions">
        <button id="viewHistory" class="btn btn-primary">📊 Match History</button>
      </div>
    </div>
  `,

  "/history": `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navLogout">Logout</button>
      </div>
      <h1>📊 Match History</h1>
      <div id="historyContainer" class="mt-4">Loading...</div>
    </div>
  `,

  "/tournament": `
  <div class="page-container">
    <div class="nav">
      <button id="navHome">Home</button>
      <button id="navPlay">Play</button>
      <button id="navProfile">Profile</button>
      <button id="navLogout">Logout</button>
    </div>

    <h1>🏆 Tournament</h1>

    <h3>Add Players</h3>
    <form id="addPlayerForm" class="mb-3">
      <input
        type="email"
        id="playerEmail"
        class="form-control mb-2"
        placeholder="Player email"
        required
      />
      <input
        type="password"
        id="playerPassword"
        class="form-control mb-2"
        placeholder="Password"
        required
      />
      <input
        id="playerOtp"
        class="form-control mb-2"
        placeholder="OTP"
        required
      />
      <button class="btn btn-primary" type="submit">
        ➕ Add Player
      </button>
    </form>

    <h3>Players</h3>
    <ul id="playerList" class="mb-3"></ul>

    <div id="tournamentInfo" class="mb-3">
      <p>No active tournament.</p>
    </div>

    <button id="startTournamentBtn" class="btn btn-success" disabled>
      Create Tournament
    </button>

    <button id="startMatchBtn" class="btn btn-primary mt-2" disabled>
      Start Match
    </button>
  </div>
`,
};

declare global {
  interface Window {
    pongInterval: any;
    currentSessionId?: number;
    currentTournamentId?: number;
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

async function loadFriendsModule() {
  const module = await import('./friends');
  module.initFriends();
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

async function router() {
  if (!app) return;

  const fullRoute = location.hash.replace('#', '') || '/';
  const route = fullRoute.split('?')[0]; // allow /profile?userId=...

  app.innerHTML = views[route] || '<h1>404 Not Found</h1>';

  if (route === '/' || route === '/register') {
    await loadLoginModule();
  }

  if (route === '/home') {
    await handleNavButtons();
    const playBtn = document.getElementById('goPlay');
    const profileBtn = document.getElementById('goProfile');
    const friendsBtn = document.getElementById('goFriends');
    playBtn?.addEventListener('click', () => (location.hash = '#/play'));
    profileBtn?.addEventListener('click', () => (location.hash = '#/profile'));
    friendsBtn?.addEventListener('click', () => (location.hash = '#/friends'));
  }

  if (route === '/play') {
    await handleNavButtons();

    const btn1v1 = document.getElementById('go1v1');
    const btnTournament = document.getElementById('goTournament');

    btn1v1?.addEventListener('click', () => (location.hash = '#/1v1'));
    btnTournament?.addEventListener('click', () => (location.hash = '#/tournament'));
  }

  if (route === '/1v1') {
    await handleNavButtons();
    await load1v1Module();
  }

  if (route === '/tournament') {
    await handleNavButtons();
    initTournamentUI();
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

  if (route === '/friends') {
    await handleNavButtons();
    await loadFriendsModule();
  }
}

window.addEventListener('load', () => {
  router();
});

window.addEventListener('hashchange', () => {
  router();
});
