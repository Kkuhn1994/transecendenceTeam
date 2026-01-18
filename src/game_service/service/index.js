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

/**
 * If current round finished:
 * - finish tournament if only one winner
 * - else build next round from winners
 *
 * Returns:
 *  - { tournamentFinished: true, winnerId }
 *  - { nextRoundReady: true, remaining }
 *  - null (still matches left)
 */
async function maybeAdvanceRound() {
  if (!activeTournament) return null;

  if (activeTournament.currentMatchIndex < activeTournament.matchQueue.length) {
    return null;
  }

  // finished round
  if (activeTournament.winners.length === 1) {
    const winnerId = activeTournament.winners[0];
    await dbRun(
      'UPDATE tournaments SET winner_id = ? WHERE id = ?',
      [winnerId, activeTournament.id]
    );
    activeTournament = null;
    return { tournamentFinished: true, winnerId };
  }

  // build next round
  const players = [...activeTournament.winners];
  activeTournament.winners = [];
  activeTournament.currentMatchIndex = 0;
  activeTournament.matchQueue = [];

  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  for (let i = 0; i < players.length; i += 2) {
    if (players[i + 1]) activeTournament.matchQueue.push([players[i], players[i + 1]]);
    else activeTournament.matchQueue.push([players[i], null]); // bye
  }

  return { nextRoundReady: true, remaining: players.length };
}

/**
 * Keep advancing through byes / round boundaries until we either:
 * - return a real match (player1Id, player2Id, sessionId)
 * - or tournament finished
 *
 * Also collects bye announcements for UI.
 */
async function getNextPlayableMatch() {
  const byes = [];

  // Safety net: tournament size is tiny, but don’t allow infinite loops
  for (let guard = 0; guard < 100; guard++) {
    if (!activeTournament) {
      return { tournamentFinished: true, byes };
    }

    // If we ran off end of this round, advance round
    if (activeTournament.currentMatchIndex >= activeTournament.matchQueue.length) {
      const adv = await maybeAdvanceRound();
      if (adv && adv.tournamentFinished) {
        return { tournamentFinished: true, winnerId: adv.winnerId, byes };
      }
      continue; // next round built, keep going
    }

    const match = activeTournament.matchQueue[activeTournament.currentMatchIndex];

    // Shouldn't happen, but if it does, treat like end-of-round and advance
    if (!match) {
      activeTournament.currentMatchIndex = activeTournament.matchQueue.length;
      continue;
    }

    const [player1, player2] = match;

    // Bye: auto-advance player1 and move on
    if (!player2) {
      activeTournament.winners.push(player1);
      activeTournament.currentMatchIndex++;
      byes.push(player1);
      continue;
    }

    // Real match: create session and return it
    const result = await dbRun(
      `INSERT INTO game_sessions (player1_id, player2_id, tournament_id)
       VALUES (?, ?, ?)`,
      [player1, player2, activeTournament.id]
    );

    // consume this match
    activeTournament.currentMatchIndex++;

    return {
      byes,
      sessionId: result.lastID,
      player1Id: player1,
      player2Id: player2,
    };
  }

  return { error: 'Tournament loop guard hit (unexpected state).' };
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
      else matchQueue.push([players[i], null]);
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

    const out = await getNextPlayableMatch();

    if (out.error) {
      return reply.code(500).send({ error: out.error });
    }

    // If tournament finished
    if (out.tournamentFinished) {
      return reply.send({
        tournamentFinished: true,
        winnerId: out.winnerId,
        byes: out.byes || [],
      });
    }

    // Real match
    return reply.send({
      sessionId: out.sessionId,
      player1Id: out.player1Id,
      player2Id: out.player2Id,
      byes: out.byes || [], // list of playerIds who got byes before this match
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

    // Advance round if needed (important when last match finishes)
    const adv = await maybeAdvanceRound();
    if (adv && adv.tournamentFinished) {
      return reply.send({ tournamentFinished: true, winnerId: adv.winnerId });
    }
    if (adv && adv.nextRoundReady) {
      return reply.send({ nextRoundReady: true, remaining: adv.remaining });
    }

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

    if (wPressed) leftPaddleY -= paddleSpeed;
    if (sPressed) leftPaddleY += paddleSpeed;
    if (upPressed) rightPaddleY -= paddleSpeed;
    if (downPressed) rightPaddleY += paddleSpeed;

    leftPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, leftPaddleY));
    rightPaddleY = Math.max(0, Math.min(canvasheight - paddleHeight, rightPaddleY));

    ballX += ballSpeedX;
    ballY += ballSpeedY;

    if (ballY <= 0 || ballY + ballSize >= canvasheight) {
      ballSpeedY *= -1;
    }

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

    let winnerIndex = null;
    if (scoreLeft >= 2) winnerIndex = 1;
    else if (scoreRight >= 2) winnerIndex = 2;

    const finalScoreLeft = scoreLeft;
    const finalScoreRight = scoreRight;

    if (winnerIndex) {
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
