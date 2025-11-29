alert("app.ts!");

const app = document.getElementById("app");

// Views (Seiten)
const views: Record<string, string> = {
  // "/": `
  //   <h1>Hoallo</h1>
  //   <p>Willkommen!</p>
  // `,

  "/": `
      <div class="login-container">
      <h3 class="text-center mb-4">Login</h3>
      <form novalidate>
        <div class="mb-3">
          <label for="email" class="form-label">Email address</label>
          <input
            type="email"
            class="form-control"
            id="email"
            name="email"
            placeholder="Enter your email"
            required
          />
        </div>
        <div class="mb-3">
          <label for="password" class="form-label">Password</label>
          <input
            type="password"
            class="form-control"
            id="password"
            name="password"
            placeholder="Enter your password"
            required
          />
        </div>
        <button type="submit" class="btn btn-primary w-100" id="signUp">Create New Account</button>
        <button type="submit" class="btn btn-primary w-100" id="login">Login</button>
        <p class="text-center mt-3 mb-0">
          <small>Don’t have an account? <a href="#">Register</a></small>
        </p>
      </form>
    </div>
  `,
    "/profile": `
      <div class="profile-container">
      <h3 class="text-center mb-4">start tournament</h3>
      <form id="playerCountForm" novalidate>
        <div class="mb-3">
          <input
            class="form-control"
            id="playerCount"
            name="playerCount"
            placeholder="How many players will join the tournament"
            required
          />
        </div>
        <button type="submit" class="btn btn-primary w-100" id="player">Start Game</button>
      </form>
      <div id="playerNamesContainer" class="mt-3"></div>
    </div>
  `,

  "/game": `
    <nav>
    <a href="#/">Home</a> |
    <a href="#/login">Login</a> |
    <a href="#/game">Game</a>
    </nav>
    <div class="container">
      <h1 class="text-center">👾 Pong Game</h1>
      <canvas id="pongCanvas" width="800" height="400"></canvas>
    </div>
  `
};

async function loadGameScript() {
  const module = await import('./game_frontend');
  module.startGame();
}

async function loadGameSetup() {
  const module = await import('./setup_game');
  module.setupGameForm();
}

async function loadLoginScript() {
  console.log("import start");
  const module = await import('./login');
  module.loginReady();
  console.log("import ready");
}

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  console.log(value);
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()!.split(";")[0];
  }
  return null;
}

// const DEFAULT_SESSION = "super_secret_key_32_chars";
// Router
async function router() {
  if (!app) return;
    
  const route = location.hash.replace("#", "") || "/"; // default to "/" if no hash
  alert("new route");

  app.innerHTML = views[route] || "<h1>404 Not Found</h1>";
    console.log("Current route:", route);
  // Optional: Login form handler
  
  if (route === "/profile") {
    await loadGameSetup(); // Lädt das Spiel-Skript nur für die /game Route
  }

  if (route === "/game") {
    await loadGameScript(); // Lädt das Spiel-Skript nur für die /game Route
  }
  if (route === "/") {
    console.log("Current route:", route);
    await loadLoginScript();
    document.getElementById("loginForm")?.addEventListener("submit", e => {
      e.preventDefault();
      alert("Login ausgeführt!");
    });
  }
}

// Initialize router on page load
window.addEventListener("load", () => {
alert("Page loaded!");
  router(); // manually call router to render the initial page
});

window.addEventListener("hashchange", () => {
  alert("Hash changed!");
  router();
});