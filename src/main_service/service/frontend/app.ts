export {};

import { initTournamentUI } from './tournament';
import { uiConfirm } from './ui_modal';

const app = document.getElementById('app') as HTMLDivElement | null;

type ViewMap = Record<string, string>;

const views: ViewMap = {
  '/': `
    <div class="login-container">
      <h1>Pong Login</h1>
      <form id="loginForm" novalidate>
        <div class="mb-3">
          <label for="loginUsername" class="form-label">Username</label>
          <input
            type="text"
            id="loginUsername"
            class="form-control"
            placeholder="Enter your username"
            maxlength="20"
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

  '/register': `
    <div class="login-container">
      <h1>🎆 Create Account</h1>

      <form id="registerForm" novalidate>
        <div class="mb-3">
          <label for="registerUsername" class="form-label">Username</label>
          <input
            id="registerUsername"
            class="form-control"
            placeholder="Enter your Username"
            maxlength="20"
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

      <div
        class="col-md-4 d-flex justify-content-center align-items-center"
        style="min-height: 200px;"
      >
        <div class="mb-3" id="qr-container"></div>
      </div>
    </div>
  `,

  '/home': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navFriends">Friends</button>
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

  '/play': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navFriends">Friends</button>
        <button id="navLogout">Logout</button>
      </div>

      <h1>🎮 Play Game</h1>

      <div class="d-flex gap-3 justify-content-center mt-4">
        <button id="go1v1" class="btn btn-primary">⚔️ 1v1 Match</button>
        <button id="goTournament" class="btn btn-primary">
          🏆 Create Tournament
        </button>
      </div>
    </div>
  `,

  '/1v1': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navFriends">Friends</button>
        <button id="navLogout">Logout</button>
      </div>

      <h1>⚔️ 1v1 Match Setup</h1>
      <p>Player 1 is the currently logged in user.</p>

      <!-- Match Type Selection -->
      <div class="mb-4">
        <h5>Choose your opponent:</h5>

        <div class="form-check">
          <input
            class="form-check-input"
            type="radio"
            name="matchType"
            id="humanMatch"
            value="human"
            checked
          />
          <label class="form-check-label" for="humanMatch">
            👥 Play against another player
          </label>
        </div>

        <div class="form-check">
          <input
            class="form-check-input"
            type="radio"
            name="matchType"
            id="aiMatch"
            value="ai"
          />
          <label class="form-check-label" for="aiMatch">
            🤖 Play against AI opponent
          </label>
        </div>
      </div>

      <!-- Human Player Section -->
      <div id="humanMatchSection">
        <p>Player 2 must log in here:</p>

        <form id="player2Form">
          <div class="mb-3">
            <label for="player2Email" class="form-label">Player 2 username</label>
            <input
              id="player2Email"
              class="form-control"
              placeholder="Enter Player 2's username"
              required
            />
          </div>

          <div class="mb-3">
            <label for="player2Password" class="form-label">Player 2 Password</label>
            <input
              type="password"
              id="player2Password"
              class="form-control"
              placeholder="Enter Player 2's password"
              required
            />
          </div>

          <div class="mb-3">
            <label for="otp" class="form-label">OTP</label>
            <input
              id="otp"
              class="form-control"
              placeholder="Enter Player 2's OTP"
              required
            />
          </div>

          <button type="submit" class="btn btn-primary">
            🚀 Start Match vs Player
          </button>
        </form>
      </div>

      <!-- AI Match Section -->
      <div id="aiMatchSection" style="display: none;">
        <p>Ready to challenge our AI opponent?</p>
        <button id="startAiMatch" class="btn btn-primary">
          🤖 Start Match vs AI
        </button>
      </div>

      <p id="player2Error" style="color:#ff6b6b;" class="mt-3"></p>
    </div>
  `,

  '/game': `
    <div class="game-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navFriends">Friends</button>
        <button id="navLogout">Logout</button>
      </div>

      <h1 class="game-title">PONG</h1>

      <div class="game-stage">
        <div class="player-bar">
          <div id="playerLeftName" class="player-name left">Player 1</div>
          <div id="playerRightName" class="player-name right">Player 2</div>
        </div>

        <canvas id="pongCanvas"></canvas>
      </div>

      <div class="game-controls">
        <p>Player 1: W/S keys | Player 2: ↑/↓ arrow keys</p>
        <p>First to 11 points wins!</p>
      </div>
    </div>
  `,

  '/profile': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navFriends">Friends</button>
        <button id="navLogout">Logout</button>
      </div>

      <h1>👤 Profile</h1>
      <div id="profileInfo" class="mb-4">Loading...</div>

      <div class="text-center" id="profileActions">
        <button id="viewHistory" class="btn btn-primary">📊 Match History</button>
      </div>
    </div>
  `,

  '/history': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navFriends">Friends</button>
        <button id="navLogout">Logout</button>
      </div>

      <h1>📊 Match History</h1>
      <div id="historyContainer" class="mt-4">Loading...</div>
    </div>
  `,

  '/tournament': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navFriends">Friends</button>
        <button id="navLogout">Logout</button>
      </div>

      <h1>🏆 Tournament</h1>
      <p class="text-muted mb-2">Minimum 3 players required.</p>

      <div class="mb-3">
        <label for="tournamentName" class="form-label">Tournament name</label>
        <input
          id="tournamentName"
          class="form-control"
          placeholder="Crazy Tournament"
          maxlength="40"
        />
      </div>

      <h3>Add Players</h3>

      <form id="addPlayerForm" class="mb-3">
        <input
          id="playerEmail"
          class="form-control mb-2"
          placeholder="Player username"
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
        <button class="btn btn-primary" type="submit">➕ Add Player</button>
      </form>

      <h3>Players</h3>
      <ul id="playerList" class="mb-3"></ul>

      <div id="tournamentInfo" class="mb-3">
        <p>No active tournament.</p>
      </div>

      <div class="tournament-actions">
        <button id="startTournamentBtn" class="btn btn-success" disabled>
          Create Tournament
        </button>
        <button id="resetTournamentBtn" class="btn btn-danger" type="button">
          Reset Tournament
        </button>
        <button id="startMatchBtn" class="btn btn-primary" disabled>
          Start Match
        </button>
      </div>
    </div>
  `,

  '/tournament_bracket': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navFriends">Friends</button>
        <button id="navLogout">Logout</button>
      </div>

      <h1>🏆 Tournament Bracket</h1>
      <div id="bracketRoot" class="mb-3">Loading...</div>
      <button id="backToTournament" class="btn btn-primary">Back</button>
    </div>
  `,
};

declare global {
  interface Window {
    pongInterval: any;
    currentSessionId?: number;
    currentTournamentId?: number;
    currentMatchPlayer1Name?: string;
    currentMatchPlayer2Name?: string;
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

const TOURNAMENT_UI_KEY = 'tournament_ui_state_v1';

function hasPendingMatch(): boolean {
  try {
    const raw = sessionStorage.getItem(TOURNAMENT_UI_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    return !!s?.pendingMatch;
  } catch {
    return false;
  }
}

async function abandonProgressIfAny(): Promise<void> {
  // Tournament abandon = real abandon (delete DB + clear everything)
  if (window.currentTournamentId != null) {
    try {
      await fetch('/tournament_service/tournament/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: window.currentTournamentId }),
      });
    } catch {
      // ignore
    }

    window.currentTournamentId = undefined;
    window.currentSessionId = undefined;
    (window as any).currentMatchPlayer1Id = undefined;
    (window as any).currentMatchPlayer2Id = undefined;
    (window as any).tournamentPlayerMap = undefined;
    window.currentMatchPlayer1Name = undefined;
    window.currentMatchPlayer2Name = undefined;

    sessionStorage.removeItem(TOURNAMENT_UI_KEY);
    return;
  }

  // 1v1 match abandon
  if (window.currentSessionId != null) {
    window.currentSessionId = undefined;
  }
}

async function guardedNavigate(targetHash: string): Promise<void> {
  const inGame = location.hash.startsWith('#/game');
  const inProgress =
    inGame &&
    (window.currentSessionId != null ||
      window.currentTournamentId != null ||
      hasPendingMatch());

  if (inProgress) {
    const ok = await uiConfirm(
      'A match/tournament is in progress.\nIf you leave now, progress will be lost.',
      'Leave game?',
      'Leave',
      'Stay'
    );

    if (!ok) return;
    await abandonProgressIfAny();
  }

  location.hash = targetHash;
}

async function handleNavButtons() {
  const homeBtn = document.getElementById('navHome');
  const playBtn = document.getElementById('navPlay');
  const profileBtn = document.getElementById('navProfile');
  const logoutBtn = document.getElementById('navLogout');
  const friendsBtn = document.getElementById('navFriends');

  if (homeBtn) homeBtn.addEventListener('click', () => guardedNavigate('#/home'));
  if (playBtn) playBtn.addEventListener('click', () => guardedNavigate('#/play'));
  if (profileBtn)
    profileBtn.addEventListener('click', () => guardedNavigate('#/profile'));
  if (friendsBtn)
    friendsBtn.addEventListener('click', () => guardedNavigate('#/friends'));
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await guardedNavigate('#/'); // will abandon progress first if needed
      await fetch('/login_service/logout', { method: 'POST' });
      window.currentSessionId = undefined;
      window.currentTournamentId = undefined;
    });
  }

  // Logout on window close/refresh to prevent session lockout
  window.addEventListener('beforeunload', () => {
    // Use sendBeacon for reliable logout on page unload
    navigator.sendBeacon('/login_service/logout');
  });
}

async function router() {
  if (!app) return;

  const fullRoute = location.hash.replace('#', '') || '/';
  const route = fullRoute.split('?')[0];

  if (route === '/' || route === '/register') {
    app.innerHTML = views[route] || '<h1>404 Not Found</h1>';
    await loadLoginModule();
    return;
  }
  const res = await fetch('/login_service/auth/me', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    app.innerHTML = `
      <div class="error">
        <h2>Access Denied</h2>
        <p>You dont have a valid session</p>
      </div>
    `;
    return;
  }

  app.innerHTML = views[route] || '<h1>404 Not Found</h1>';

  if (route === '/home') {
    await handleNavButtons();

    document.getElementById('goPlay')?.addEventListener('click', () => {
      location.hash = '#/play';
    });

    document.getElementById('goProfile')?.addEventListener('click', () => {
      location.hash = '#/profile';
    });

    document.getElementById('goFriends')?.addEventListener('click', () => {
      location.hash = '#/friends';
    });
  }

  if (route === '/play') {
    await handleNavButtons();

    document.getElementById('go1v1')?.addEventListener('click', () => {
      location.hash = '#/1v1';
    });

    document.getElementById('goTournament')?.addEventListener('click', () => {
      location.hash = '#/tournament';
    });
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

  if (route === '/tournament_bracket') {
    await handleNavButtons();
    const module = await import('./tournament_bracket');
    module.initTournamentBracket();
  }
}

window.addEventListener('load', () => router());
window.addEventListener('hashchange', () => router());
