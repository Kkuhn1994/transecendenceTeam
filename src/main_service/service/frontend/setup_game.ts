alert("setupgame.ts!");

export function setupGameForm() {
    console.log("setup game");
  const form = document.getElementById("playerCountForm") as HTMLFormElement;
  const container = document.getElementById("playerNamesContainer") as HTMLDivElement;
console.log("setup game2");
form.addEventListener("submit", (e) => {
    alert("count butto pressed");
    e.preventDefault();
    const countInput = document.getElementById("playerCount") as HTMLInputElement;
    const playerCount = parseInt(countInput.value);
    alert(playerCount);
    if (isNaN(playerCount) || playerCount < 1)
    {
        alert("you need at least 2 players")
        return;
    }
    container.innerHTML = "";
    for (let i = 1; i <= playerCount; i++) {
      const input = document.createElement("input");
      input.type = "text";
      input.name = `playerName${i}`;
      input.placeholder = `Player Name ${i}`;
      input.required = true;
      input.className = "form-control mb-2";
      container.appendChild(input);
    }
    const startBtn = document.createElement("button");
    startBtn.type = "button"; // type=button, damit kein Submit ausgelöst wird
    startBtn.className = "btn btn-success w-100 mt-3";
    startBtn.textContent = "Start Tournament";
    container.appendChild(startBtn);
    startBtn.addEventListener("click", () => {
        alert("game started")
        location.hash = "#/game";
});
  });
}