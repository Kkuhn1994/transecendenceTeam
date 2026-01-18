const fastify = require('fastify')({
  logger: false,
});

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/app/data/database.db');

let currentSessionId = null;
let activeTournament = null;

let ballSpeedX = 4, ballSpeedY = 4;
let scoreLeft = 0, scoreRight = 0;

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// -------------------- TOURNAMENT --------------------

fastify.post('/tournament/create', async (request, reply) => {
  try {
    const body = request.body || {};
    let { playerIds, name } = body;

    if (!Array.isArray(playerIds)) {
      return reply.code(400).send({ error: 'playerIds must be an array' });
    }

    playerIds = [...new Set(playerIds)];

    if (playerIds.length < 2) {
      return reply.code(400).send({ error: 'At least 2 distinct players required' });
    }

    const result = await dbRun(
      'INSERT INTO tournaments (name) VALUES (?)',
      [name || 'Tournament']
    );

    const tournamentId = result.lastID;

    // shuffle players
    const players = [...playerIds];
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }

    const matchQueue = [];
    for (let i = 0; i < players.length; i += 2) {
      if (players[i + 1]) matchQueue.push([players[i], players[i + 1]]);
      else matchQueue.push([players[i], null]); // bye
    }

    activeTournament = {
      id: tournamentId,
      name: name || 'Tournament',
      matchQueue,
      currentMatchIndex: 0,
      winners: [],
    };

    return reply.send({ tournamentId });
  } catch (err) {
    console.error('Tournament create failed', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.post('/tournament/start-match', async (request, reply) => {
  try {
    if (!activeTournament) {
      return reply.code(400).send({ error: 'No active tournament!' });
    }

    const { tournamentId } = request.body || {};
    if (tournamentId && Number(tournamentId) !== Number(activeTournament.id)) {
      return reply.code(400).send({ error: 'Tournament ID mismatch' });
    }

    const match = activeTournament.matchQueue[activeTournament.currentMatchIndex];
    if (!match) {
      return reply.code(400).send({ error: 'No match available' });
    }

    const [player1, player2] = match;

    // bye
    if (!player2) {
      activeTournament.winners.push(player1);
      activeTournament.currentMatchIndex++;
      return reply.send({ bye: true });
    }

    const result = await dbRun(
      `INSERT INTO game_sessions (player1_id, player2_id, tournament_id)
       VALUES (?, ?, ?)`,
      [player1, player2, activeTournament.id]
    );

    return reply.send({
      sessionId: result.lastID,
      player1Id: player1,
      player2Id: player2,
    });
  } catch (err) {
    console.error('Start-match failed', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.post('/tournament/match-finished', async (request, reply) => {
  try {
    const { sessionId, winnerIndex } = request.body || {};

    if (!activeTournament) {
      return reply.code(400).send({ error: 'No active tournament!' });
    }

    if (!sessionId || !winnerIndex) {
      return reply.code(400).send({ error: 'sessionId and winnerIndex are required' });
    }

    const session = await dbGet(
      'SELECT player1_id, player2_id FROM game_sessions WHERE id = ?',
      [sessionId]
    );

    if (!session) {
      return reply.code(400).send({ error: 'Invalid sessionId' });
    }

    let winnerId;
    if (winnerIndex === 1) winnerId = session.player1_id;
    else if (winnerIndex === 2) winnerId = session.player2_id;
    else return reply.code(400).send({ error: 'Invalid winnerIndex' });

    activeTournament.winners.push(winnerId);
    activeTournament.currentMatchIndex++;

    // finished this round?
    if (activeTournament.currentMatchIndex >= activeTournament.matchQueue.length) {
      // tournament finished if exactly one winner left
      if (activeTournament.winners.length === 1) {
        await dbRun(
          'UPDATE tournaments SET winner_id = ? WHERE id = ?',
          [activeTournament.winners[0], activeTournament.id]
        );
        activeTournament = null;
        return reply.send({ tournamentFinished: true });
      }

      // build next round
      const players = [...activeTournament.winners];
      activeTournament.winners = [];
      activeTournament.currentMatchIndex = 0;
      activeTournament.matchQueue = [];

      for (let i = 0; i < players.length; i += 2) {
        if (players[i + 1]) activeTournament.matchQueue.push([players[i], players[i + 1]]);
        else activeTournament.matchQueue.push([players[i], null]);
      }

      return reply.send({ nextRoundReady: true, remaining: players.length });
    }

    // still matches in this round
    return reply.send({ nextMatchReady: true });
  } catch (err) {
    console.error('Match-finished failed', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

// -------------------- GAME LOOP --------------------

fastify.post('/game', async function (request, reply) {
  try {
    const body = request.body || {};
    const sessionId = body.sessionId;

    if (!sessionId) {
      return reply.code(400).send({ error: 'sessionId is required' });
    }

    // Reset game state if new session
    if (currentSessionId !== sessionId) {
      currentSessionId = sessionId;
      scoreLeft = 0;
      scoreRight = 0;
      ballSpeedX = 4;
      ballSpeedY = 4;
    }

    let {
      canvasheight,
      canvaswidth,
      leftPaddleY,
      rightPaddleY,
      ballX,
      ballY,
      upPressed,
      downPressed,
      wPressed,
      sPressed,
    } = body;

    const paddleWidth = 10,
      paddleHeight = 100,
      paddleSpeed = 4,
      ballSize = 10;

    // Paddle movement
    if (wPressed) leftPaddleY -= paddleSpeed;
    if (sPressed) leftPaddleY += paddleSpeed;
    if (upPressed) rightPaddleY -= paddleSpeed;
    if (downPressed) rightPaddleY += paddleSpeed;

    leftPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, leftPaddleY));
    rightPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, rightPaddleY));

    // Ball movement
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Top/Bottom collision
    if (ballY <= 0 || ballY + ballSize >= canvasheight) {
      ballSpeedY *= -1;
    }

    // Paddle collisions
    if (
      ballX <= paddleWidth &&
      ballY + ballSize >= leftPaddleY &&
      ballY <= leftPaddleY + paddleHeight
    ) {
      ballSpeedX *= -1;
      ballX = paddleWidth;
    }

    if (
      ballX + ballSize >= canvaswidth - paddleWidth &&
      ballY + ballSize >= rightPaddleY &&
      ballY <= rightPaddleY + paddleHeight
    ) {
      ballSpeedX *= -1;
      ballX = canvaswidth - paddleWidth - ballSize;
    }

    // Scoring
    if (ballX < 0) {
      scoreRight++;
      ballX = canvaswidth / 2;
      ballY = canvasheight / 2;
      ballSpeedX = 4;
    } else if (ballX > canvaswidth) {
      scoreLeft++;
      ballX = canvaswidth / 2;
      ballY = canvasheight / 2;
      ballSpeedX = -4;
    }

    // Win condition 
    let winnerIndex = null;
    if (scoreLeft >= 2) winnerIndex = 1;
    else if (scoreRight >= 2) winnerIndex = 2;

    // IMPORTANT: capture final scores BEFORE resetting anything
    const finalScoreLeft = scoreLeft;
    const finalScoreRight = scoreRight;

    if (winnerIndex) {
      // Optional: notify main_service
      try {
        await fetch('http://main_service:3000/session/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            scoreLeft: finalScoreLeft,
            scoreRight: finalScoreRight,
            winnerIndex,
          }),
        });
      } catch (err) {
        fastify.log.error('Error calling /session/finish:', err);
      }

      scoreLeft = 0;
      scoreRight = 0;
      ballSpeedX = 4;
      ballSpeedY = 4;
      ballX = canvaswidth / 2;
      ballY = canvasheight / 2;
    }

    return reply.send({
      leftPaddleY,
      rightPaddleY,
      ballX,
      ballY,
      scoreLeft: finalScoreLeft,
      scoreRight: finalScoreRight,
      winnerIndex,
    });
  } catch (err) {
    fastify.log.error('Error in /game route:', err);
    return reply.code(500).send({ error: 'Game service error' });
  }
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server running at ${address}`);
});
