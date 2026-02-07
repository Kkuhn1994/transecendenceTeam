export {};

import { initTournamentUI } from './tournament';
import { uiConfirm } from './ui_modal';
import { privacyPage } from './privacy';

const app = document.getElementById('app') as HTMLDivElement | null;

type ViewMap = Record<string, string>;

const views: ViewMap = {
  '/': `
    <div class="login-container">
      <h1><i class="fas fa-lock"></i> Pong Login</h1>

      <form id="loginForm" novalidate>
        <div class="mb-3">
          <label for="loginUsername" class="form-label">
            <i class="fas fa-user"></i> Username
          </label>
          <input type="text" id="loginUsername" class="form-control"
                 placeholder="Enter your username" maxlength="20" required />
        </div>

        <div class="mb-3">
          <label for="loginPassword" class="form-label">
            <i class="fas fa-key"></i> Password
          </label>
          <input type="password" id="loginPassword" class="form-control"
                 placeholder="Enter your password"
                 autocomplete="current-password" maxlength="128" required />
        </div>

        <div class="mb-3">
          <label for="otp" class="form-label">
            <i class="fas fa-mobile-alt"></i> OTP
          </label>
          <input id="otp" class="form-control" placeholder="Enter your OTP" maxlength="6" required />
        </div>

        <button type="submit" class="btn btn-primary">
          <i class="fas fa-sign-in-alt"></i> Login
        </button>
      </form>

      <p class="text-center mt-3">
        Not registered? <a href="#/register"><i class="fas fa-user-plus"></i> Sign up</a>
      </p>

      <div style="position: fixed; bottom: 10px; right: 20px; z-index: 1000;">
        <a href="#/privacy" style="font-size: 0.95em; color: #888; cursor: pointer;">
          <i class="fas fa-shield-alt"></i> Privacy Policy & Terms of Service
        </a>
      </div>
    </div>
  `,

  '/register': `
    <div class="login-container">
      <h1><i class="fas fa-user-plus"></i> Create Account</h1>

      <form id="registerForm" novalidate>
        <div class="mb-3">
          <label for="registerUsername" class="form-label">
            <i class="fas fa-user"></i> Username
          </label>
          <input id="registerUsername" class="form-control"
                 placeholder="Enter your Username" maxlength="20" required />
        </div>

        <div class="mb-3">
          <label for="registerPassword" class="form-label">
            <i class="fas fa-key"></i> Password
          </label>
          <input type="password" id="registerPassword" class="form-control"
                 placeholder="Create a password"
                 autocomplete="new-password" maxlength="128" required />
        </div>

        <button type="submit" class="btn btn-primary">
          <i class="fas fa-check"></i> Create account
        </button>
      </form>

      <p class="text-center mt-3">
        Already have an account? <a href="#/"><i class="fas fa-sign-in-alt"></i> Login</a>
      </p>

      <div class="col-md-4 d-flex justify-content-center align-items-center" style="min-height: 200px;">
        <div class="mb-3" id="qr-container"></div>
      </div>
    </div>
  `,

  '/home': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1><i class="fas fa-home"></i> Home</h1>

      <div class="menu-panel">
        <div class="menu-item">
          <h3><i class="fas fa-table-tennis"></i> Play</h3>
          <p>Start a quick match.</p>
          <button id="homeLaunchGame" class="btn btn-primary">
            <i class="fas fa-play"></i> Launch Game
          </button>
        </div>

        <div class="menu-item">
          <h3><i class="fas fa-trophy"></i> Tournament</h3>
          <p>Create or manage tournaments.</p>
          <button id="homeTournament" class="btn">
            <i class="fas fa-magic"></i> Tournament Wizard
          </button>
        </div>

        <div class="menu-item">
          <h3><i class="fas fa-history"></i> History</h3>
          <p>View past matches and results.</p>
          <button id="homeHistory" class="btn">
            <i class="fas fa-chart-bar"></i> Match History
          </button>
        </div>
      </div>

      <div style="position: fixed; bottom: 10px; right: 20px; z-index: 1000;">
        <a href="#/privacy" style="font-size: 0.95em; color: #888; cursor: pointer;">
          <i class="fas fa-shield-alt"></i> Privacy Policy & Terms of Service
        </a>
      </div>
    </div>
  `,

  '/privacy': privacyPage,

  '/play': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1><i class="fas fa-gamepad"></i> Play Game</h1>

      <div style="border:2px solid #000; padding:12px; background:#e0ddd7; box-shadow: inset 2px 2px 0 #fff, inset -2px -2px 0 #808080;"
           class="d-flex gap-3 justify-content-center mt-4">
        <button id="go1v1" class="btn btn-primary">
          <i class="fas fa-user-friends"></i> 1v1 Match
        </button>
        <button id="goTournament" class="btn btn-primary">
          <i class="fas fa-trophy"></i> Create Tournament
        </button>
      </div>
    </div>
  `,

  '/1v1': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1><i class="fas fa-user-friends"></i> 1v1 Match Setup</h1>
      <p>Player 1 is the currently logged in user.</p>

      <div class="mb-4">
        <h5><i class="fas fa-dice-d20"></i> Choose your opponent:</h5>
        <div class="form-check">
          <input class="form-check-input" type="radio" name="matchType" id="humanMatch" value="human" checked />
          <label class="form-check-label" for="humanMatch">
            <i class="fas fa-user"></i> Play against another player
          </label>
        </div>

        <div class="form-check">
          <input class="form-check-input" type="radio" name="matchType" id="aiMatch" value="ai" />
          <label class="form-check-label" for="aiMatch">
            <i class="fas fa-robot"></i> Play against AI opponent
          </label>
        </div>
      </div>

      <div id="humanMatchSection">
        <p><i class="fas fa-info-circle"></i> Player 2 must log in here:</p>
        <form id="player2Form">
          <div class="mb-3">
            <label for="player2Username" class="form-label">
              <i class="fas fa-user"></i> Player 2 username
            </label>
            <input
              id="player2Username"
              class="form-control"
              placeholder="Enter Player 2's username"
              required
            />
          </div>

          <div class="mb-3">
            <label for="player2Password" class="form-label">
              <i class="fas fa-key"></i> Player 2 Password
            </label>
            <input type="password" id="player2Password" class="form-control"
                   placeholder="Enter Player 2's password" required />
          </div>

          <div class="mb-3">
            <label for="otp" class="form-label">
              <i class="fas fa-mobile-alt"></i> OTP
            </label>
            <input id="otp" class="form-control" placeholder="Enter Player 2's OTP" required />
          </div>

          <button type="submit" class="btn btn-primary">
            <i class="fas fa-play"></i> Start Match vs Player
          </button>
        </form>
      </div>

      <div id="aiMatchSection" style="display: none;">
        <p><i class="fas fa-robot"></i> Ready to challenge our AI opponent?</p>
        <button id="startAiMatch" class="btn btn-primary">
          <i class="fas fa-play"></i> Start Match vs AI
        </button>
      </div>

      <p id="player2Error" style="color:#ff6b6b;" class="mt-3"></p>
    </div>
  `,

  '/game': `
    <div class="game-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1 class="game-title"><i class="fas fa-table-tennis"></i> PONG</h1>

      <div class="game-stage">
        <div class="player-bar">
          <div id="playerLeftName" class="player-name left">
            <i class="fas fa-user"></i> Player 1
          </div>
          <div id="playerRightName" class="player-name right">
            <i class="fas fa-user"></i> Player 2
          </div>
        </div>
        <canvas id="pongCanvas"></canvas>
      </div>

      <div class="game-controls">
        <p><i class="fas fa-keyboard"></i> Player 1: W/S keys | Player 2: ↑/↓ arrow keys</p>
        <p><i class="fas fa-trophy"></i> First to 11 points wins!</p>
      </div>
    </div>
  `,

  '/profile': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1><i class="fas fa-user-circle"></i> Profile</h1>
      <div id="profileInfo" class="mb-4">Loading...</div>

      <div class="text-center" id="profileActions">
        <button id="viewHistory" class="btn btn-primary">
          <i class="fas fa-chart-bar"></i> Match History
        </button>
        <button id="updateProfile" class="btn btn-primary">
          <i class="fas fa-chart-bar"></i> Update Profile
        </button>
      </div>
    </div>
  `,

  '/history': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1><i class="fas fa-history"></i> Match History</h1>
      <div id="historyContainer" class="mt-4">Loading...</div>
    </div>
  `,

  '/tournament': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1><i class="fas fa-trophy"></i> Tournament</h1>
      <p class="text-muted mb-2"><i class="fas fa-info-circle"></i> Minimum 3 players required.</p>

      <div class="mb-3">
        <label for="tournamentName" class="form-label">
          <i class="fas fa-tag"></i> Tournament name
        </label>
        <input id="tournamentName" class="form-control" placeholder="Tournament name" maxlength="40" />
      </div>

      <h3><i class="fas fa-user-plus"></i> Add Players</h3>
      <form id="addPlayerForm" class="mb-3">
        <input
          id="playerUsername"
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
        <button class="btn btn-primary" type="submit">
          <i class="fas fa-plus"></i> Add Player
        </button>
      </form>

      <h3><i class="fas fa-users"></i> Players</h3>
      <ul id="playerList" class="mb-3"></ul>

      <div id="tournamentInfo" class="mb-3">
        <p>No active tournament.</p>
      </div>

      <div class="tournament-actions">
        <button id="startTournamentBtn" class="btn btn-success" disabled>
          <i class="fas fa-plus-circle"></i> Create Tournament
        </button>
        <button id="resetTournamentBtn" class="btn btn-danger" type="button">
          <i class="fas fa-redo"></i> Reset Tournament
        </button>
        <button id="startMatchBtn" class="btn btn-primary" disabled>
          <i class="fas fa-play"></i> Start Match
        </button>
      </div>
    </div>
  `,

  '/tournament_bracket': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1><i class="fas fa-sitemap"></i> Tournament Bracket</h1>
      <div id="bracketRoot" class="mb-3">Loading...</div>

      <button id="backToTournament" class="btn btn-primary">
        <i class="fas fa-arrow-left"></i> Back
      </button>
    </div>
  `,

  '/friends': `
    <div class="page-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1><i class="fas fa-users"></i> Friends</h1>
      <div id="friendsRoot" class="card" style="padding:12px;">Loading...</div>
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
  // Abandon the current game session on the backend
  const sessionId = window.currentSessionId;
  if (sessionId != null) {
    try {
      await fetch('/session/abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // ignore - best effort
    }
    window.currentSessionId = undefined;
  }

  // Tournament abandon = delete tournament + clear everything if (window.currentTournamentId != null) {
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
  (window as any).currentMatchPlayer1Id = undefined;
  (window as any).currentMatchPlayer2Id = undefined;
  (window as any).tournamentPlayerMap = undefined;
  window.currentMatchPlayer1Name = undefined;
  window.currentMatchPlayer2Name = undefined;
  sessionStorage.removeItem(TOURNAMENT_UI_KEY);
}

async function guardedNavigate(targetHash: string): Promise<void> {
  const inGame = location.hash.startsWith('#/game');
  const inProgress =
    inGame && (window.currentSessionId != null || window.currentTournamentId != null || hasPendingMatch());

  if (inProgress) {
    const ok = await uiConfirm(
      'A match/tournament is in progress.\nIf you leave now, progress will be lost.',
      'Leave game?',
      'Leave',
      'Stay',
    );
    if (!ok) return;
    await abandonProgressIfAny();
  }

  location.hash = targetHash;
}

// Register beforeunload cleanup once
window.addEventListener('beforeunload', () => {
  if (window.currentSessionId != null) {
    const abandonData = new Blob(
      [JSON.stringify({ sessionId: window.currentSessionId })],
      { type: 'application/json' },
    );
    navigator.sendBeacon('/session/abandon', abandonData);
  }
});

async function handleNavButtons() {
  const homeBtn = document.getElementById('navHome');
  const playBtn = document.getElementById('navPlay');
  const profileBtn = document.getElementById('navProfile');
  const logoutBtn = document.getElementById('navLogout');
  const friendsBtn = document.getElementById('navFriends');

  if (homeBtn)
    homeBtn.addEventListener('click', () => guardedNavigate('#/home'));
  if (playBtn)
    playBtn.addEventListener('click', () => guardedNavigate('#/play'));
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

  if (route === '/privacy') {
    app.innerHTML = views['/privacy'] || '<h1>404 Not Found</h1>';
    const backBtn = document.getElementById('privacyBack');

    if (backBtn) {
      backBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/login_service/auth/me', {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
          });
          location.hash = res.ok ? '#/home' : '#/';
        } catch {
          location.hash = '#/';
        }
      });
    }
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
        <h2><i class="fas fa-exclamation-triangle"></i> Access Denied</h2>
        <p>You dont have a valid session</p>
      </div>
    `;
    return;
  }

  app.innerHTML = views[route] || '<h1>404 Not Found</h1>';

  if (route === '/home') {
    await handleNavButtons();

    document.getElementById('homeLaunchGame')?.addEventListener('click', () => {
      location.hash = '#/play';
    });

    document.getElementById('homeTournament')?.addEventListener('click', () => {
      location.hash = '#/tournament';
    });

    document.getElementById('homeHistory')?.addEventListener('click', () => {
      location.hash = '#/history';
    });
  }

  if (route === '/play') {
    await handleNavButtons();
    document.getElementById('go1v1')?.addEventListener('click', () => (location.hash = '#/1v1'));
    document.getElementById('goTournament')?.addEventListener('click', () => (location.hash = '#/tournament'));
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
