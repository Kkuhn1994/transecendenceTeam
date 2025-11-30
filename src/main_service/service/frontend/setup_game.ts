alert("setupgame.ts!");

function getPlayerNames() {
    const playerInputs = document.querySelectorAll("input[name^='playerName']"); // Selektiere alle Inputs, deren Name mit 'playerName' beginnt
    let playerNames: { [key: string]: string } = {};
    let playerNumber = 1
    playerInputs.forEach(input => {
        const inputElement = input as HTMLInputElement;
        playerNames[`playerName${playerNumber}`] = inputElement.value;
        playerNumber += 1;
    });

    console.log(playerNames);// Ausgabe der Player-Namen
}

function renderNameFields(playerCount: number)
{
    const container = document.getElementById("playerNamesContainer") as HTMLDivElement;

    container.innerHTML = "";
    for (let i = 1; i <= playerCount - 1; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.name = `playerName${i + 1}`;
    input.placeholder = `Player Name ${i + 1}`;
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
    console.log("start clicked");
      getPlayerNames();
    });
}

export function setupGameForm() {
    
  const button2 = document.getElementById("setupGame2") as HTMLFormElement;
  const button4 = document.getElementById("setupGame4") as HTMLFormElement;
  const button8 = document.getElementById("setupGame8") as HTMLFormElement;
  const button16 = document.getElementById("setupGame16") as HTMLFormElement;
 

button2.addEventListener("click", (e) => {
    alert("count butto pressed");
    e.preventDefault();
    const countInput = document.getElementById("playerCount") as HTMLInputElement;
    const playerCount = 2;
    renderNameFields(playerCount);
   
});

button4.addEventListener("click", (e) => {
    alert("count butto pressed");
    e.preventDefault();
    const countInput = document.getElementById("playerCount") as HTMLInputElement;
    const playerCount = 4;
    renderNameFields(playerCount);
   
});

button8.addEventListener("click", (e) => {
    alert("count butto pressed");
    e.preventDefault();
    const countInput = document.getElementById("playerCount") as HTMLInputElement;
    const playerCount = 8;
    renderNameFields(playerCount);
   
});

button16.addEventListener("click", (e) => {
    alert("count butto pressed");
    e.preventDefault();
    const countInput = document.getElementById("playerCount") as HTMLInputElement;
    const playerCount = 16;
    renderNameFields(playerCount);
   
});





}