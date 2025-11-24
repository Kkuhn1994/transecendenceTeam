alert("app.js!");

const app = document.getElementById("app");

// Views (Seiten)
const views = {
  "/": `
    <h1>Home</h1>
    <p>Willkommen!</p>
  `,

  "/login": `
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

  "/game": `
     <div class="card">
      <div class="card-body">
        <h1>👋 Willkommen!</h1>
        <p>Dies ist ein Penis.</p>
        <a href="/login_service" class="btn btn-primary">Zum Login</a>
      </div>
    </div>
    <div class="container">
      <h1 class="text-center">👾 Pong Game</h1>
      <canvas id="pongCanvas" width="800" height="400"></canvas>
    </div>
  `
};

function loadGameScript() {
  const script = document.createElement("script");
  script.src = "frontend/game.js";
  script.defer = true;
  document.body.appendChild(script);
}
// Router
function router() {
    
  const route = location.hash.replace("#", "") || "/"; // default to "/" if no hash
  app.innerHTML = views[route] || "<h1>404 Not Found</h1>";
    console.log("Current route:", route);
  // Optional: Login form handler

  if (route === "/game") {
    loadGameScript(); // Lädt das Spiel-Skript nur für die /game Route
  }
  if (route === "/login") {
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