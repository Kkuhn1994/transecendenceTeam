const fastify = require('fastify')({ logger: false });

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/app/data/database.db');

let activeTournament = null;

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

async function maybeAdvanceRound() {
  if (!activeTournament) return null;

  if (activeTournament.currentMatchIndex < activeTournament.matchQueue.length) {
    return null;
  }

  if (activeTournament.winners.length === 1) {
    const winnerId = activeTournament.winners[0];
    await dbRun('UPDATE tournaments SET winner_id = ? WHERE id = ?', [
      winnerId,
      activeTournament.id,
    ]);
    activeTournament = null;
    return { tournamentFinished: true, winnerId };
  }

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
    else activeTournament.matchQueue.push([players[i], null]);
  }

  return { nextRoundReady: true, remaining: players.length };
}

async function getNextPlayableMatch() {
  const byes = [];

  for (let guard = 0; guard < 100; guard++) {
    if (!activeTournament) return { tournamentFinished: true, byes };

    if (activeTournament.currentMatchIndex >= activeTournament.matchQueue.length) {
      const adv = await maybeAdvanceRound();
      if (adv && adv.tournamentFinished) {
        return { tournamentFinished: true, winnerId: adv.winnerId, byes };
      }
      continue;
    }

    const match = activeTournament.matchQueue[activeTournament.currentMatchIndex];
    if (!match) {
      activeTournament.currentMatchIndex = activeTournament.matchQueue.length;
      continue;
    }

    const [player1, player2] = match;

    if (!player2) {
      activeTournament.winners.push(player1);
      activeTournament.currentMatchIndex++;
      byes.push(player1);
      continue;
    }

    const result = await dbRun(
      `INSERT INTO game_sessions (player1_id, player2_id, tournament_id)
       VALUES (?, ?, ?)`,
      [player1, player2, activeTournament.id]
    );

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

// -------------------- ROUTES --------------------

fastify.post('/tournament/create', async (request, reply) => {
  try {
    const body = request.body || {};
    let { playerIds, name } = body;

    if (!Array.isArray(playerIds)) {
      return reply.code(400).send({ error: 'playerIds must be an array' });
    }

    playerIds = [...new Set(playerIds)];
    if (playerIds.length < 3) {
      return reply.code(400).send({ error: 'At least 3 distinct players required' });
    }

    const result = await dbRun('INSERT INTO tournaments (name) VALUES (?)', [
      name || 'Tournament',
    ]);

    const tournamentId = result.lastID;

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

    if (out.error) return reply.code(500).send({ error: out.error });

    if (out.tournamentFinished) {
      return reply.send({
        tournamentFinished: true,
        winnerId: out.winnerId,
        byes: out.byes || [],
      });
    }

    return reply.send({
      sessionId: out.sessionId,
      player1Id: out.player1Id,
      player2Id: out.player2Id,
      byes: out.byes || [],
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

    // IMPORTANT: winnerIndex can be 1 or 2 (and 1 is truthy, 2 is truthy, but let's validate properly)
    if (!sessionId || (winnerIndex !== 1 && winnerIndex !== 2)) {
      return reply
        .code(400)
        .send({ error: 'sessionId and winnerIndex (1 or 2) are required' });
    }

    const session = await dbGet(
      'SELECT player1_id, player2_id FROM game_sessions WHERE id = ?',
      [sessionId]
    );
    if (!session) return reply.code(400).send({ error: 'Invalid sessionId' });

    const winnerId = winnerIndex === 1 ? session.player1_id : session.player2_id;
    activeTournament.winners.push(winnerId);

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

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Tournament service running at ${address}`);
});
