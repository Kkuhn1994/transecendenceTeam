(() => {
    const canvas = document.getElementById('pongCanvas');
    if (!canvas) return; // Should not happen if loaded after DOM
    const ctx = canvas.getContext('2d');
    
    // Stop previous game loop if it exists
    if (window.pongInterval) {
        clearInterval(window.pongInterval);
    }

    let leftPaddleY = canvas.height / 2;
    let rightPaddleY = canvas.height / 2;
    let ballX = canvas.width / 2;
    let ballY = canvas.height / 2;
    let scoreLeft = 0;
    let scoreRight = 0;

    // Tasten für Steuerung
    let upPressed = false, downPressed = false;
    let wPressed = false, sPressed = false;
    
    const keydownHandler = (e) => {
        if (e.key === 'ArrowUp') upPressed = true;
        if (e.key === 'ArrowDown') downPressed = true;
        if (e.key === 'w') wPressed = true;
        if (e.key === 's') sPressed = true;
    };

    const keyupHandler = (e) => {
        if (e.key === 'ArrowUp') upPressed = false;
        if (e.key === 'ArrowDown') downPressed = false;
        if (e.key === 'w') wPressed = false;
        if (e.key === 's') sPressed = false;
    };

    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', keyupHandler);

    function draw() {
        // Stop drawing if canvas is removed from DOM
        if (!document.body.contains(canvas)) {
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keyup', keyupHandler);
            return;
        }

        const paddleWidth = 10, paddleHeight = 100, ballSize = 10;
        // Hintergrund
        ctx.fillStyle = '#f4f4f9';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Schläger zeichnen
        ctx.fillStyle = '#000';
        ctx.fillRect(0, leftPaddleY, paddleWidth, paddleHeight); // Linker Schläger
        ctx.fillRect(canvas.width - paddleWidth, rightPaddleY, paddleWidth, paddleHeight); // Rechter Schläger

        // Ball zeichnen
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.closePath();

        // Score zeichnen
        ctx.font = "30px Arial";
        ctx.fillStyle = "#000";
        ctx.fillText(scoreLeft, canvas.width / 4, 50);
        ctx.fillText(scoreRight, 3 * canvas.width / 4, 50);

        requestAnimationFrame(draw);
    }


    function getGameState() {
        // Stop if canvas is gone
        if (!document.body.contains(canvas)) return;

        let canvasheight = canvas.height
        let canvaswidth = canvas.width
        const data = {
            upPressed,
            downPressed,
            wPressed,
            sPressed,
            canvasheight,
            canvaswidth,
            leftPaddleY,
            rightPaddleY,
            ballX,
            ballY
        };

        fetch('/game_service/game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(response => {
            // console.log('Server Response:', response);
            leftPaddleY = response.leftPaddleY;
            rightPaddleY = response.rightPaddleY;
            ballX = response.ballX;
            ballY = response.ballY;
            if (response.scoreLeft !== undefined) scoreLeft = response.scoreLeft;
            if (response.scoreRight !== undefined) scoreRight = response.scoreRight;
            if (response.winner) {
                alert(`Game Over! ${response.winner} wins!`);
            }
        })
        .catch(err => {
            console.error('Fehler bei der Anfrage:', err);
        });
    }

    // Start draw loop once
    requestAnimationFrame(draw);
    window.pongInterval = setInterval(getGameState, 10);
})();
