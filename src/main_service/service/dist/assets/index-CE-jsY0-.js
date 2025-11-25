(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))d(e);new MutationObserver(e=>{for(const r of e)if(r.type==="childList")for(const t of r.addedNodes)t.tagName==="LINK"&&t.rel==="modulepreload"&&d(t)}).observe(document,{childList:!0,subtree:!0});function l(e){const r={};return e.integrity&&(r.integrity=e.integrity),e.referrerPolicy&&(r.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?r.credentials="include":e.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function d(e){if(e.ep)return;e.ep=!0;const r=l(e);fetch(e.href,r)}})();const v="modulepreload",b=function(n){return"/"+n},u={},y=function(s,l,d){let e=Promise.resolve();if(l&&l.length>0){document.getElementsByTagName("link");const t=document.querySelector("meta[property=csp-nonce]"),o=(t==null?void 0:t.nonce)||(t==null?void 0:t.getAttribute("nonce"));e=Promise.allSettled(l.map(i=>{if(i=b(i),i in u)return;u[i]=!0;const c=i.endsWith(".css"),p=c?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${i}"]${p}`))return;const a=document.createElement("link");if(a.rel=c?"stylesheet":v,c||(a.as="script"),a.crossOrigin="",a.href=i,o&&a.setAttribute("nonce",o),document.head.appendChild(a),c)return new Promise((h,g)=>{a.addEventListener("load",h),a.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${i}`)))})}))}function r(t){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=t,window.dispatchEvent(o),!o.defaultPrevented)throw t}return e.then(t=>{for(const o of t||[])o.status==="rejected"&&r(o.reason);return s().catch(r)})};alert("app.ts!");const m=document.getElementById("app"),w={"/":`
    <h1>Home</h1>
    <p>Willkommen!</p>
  `,"/login":`
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
  `,"/game":`
    <div class="container">
      <h1 class="text-center">👾 Pong Game</h1>
      <canvas id="pongCanvas" width="800" height="400"></canvas>
    </div>
  `};async function E(){(await y(()=>import("./game_frontend-Cn8j7UR5.js"),[])).startGame()}function f(){var s;if(!m)return;const n=location.hash.replace("#","")||"/";m.innerHTML=w[n]||"<h1>404 Not Found</h1>",console.log("Current route:",n),n==="/game"&&E(),n==="/login"&&((s=document.getElementById("loginForm"))==null||s.addEventListener("submit",l=>{l.preventDefault(),alert("Login ausgeführt!")}))}window.addEventListener("load",()=>{alert("Page loaded!"),f()});window.addEventListener("hashchange",()=>{alert("Hash changed!"),f()});
