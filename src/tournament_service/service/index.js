const Fastify = require('fastify');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/app/data/database.db');

let activeTournament = null;

const https = require('https');
const fs = require('fs');

const fastify = Fastify({
  logger: true,
  https: {
    key: fs.readFileSync('/service/service.key'),
    cert: fs.readFileSync('/service/service.crt'),
  },
});

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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function insertRoundMatches(tournamentId, round, pairs) {
  // pairs: Array<[p1, p2|null]>
  for (let i = 0; i < pairs.length; i++) {
    const [p1, p2] = pairs[i];
    await dbRun(
      `INSERT INTO tournament_matches (tournament_id, round, match_index, player1_id, player2_id)
       VALUES (?, ?, ?, ?, ?)`,
      [tournamentId, round, i, p1, p2],
    );
  }
}

async function buildPairsFromPlayers(players) {
  // shuffle
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  const pairs = [];
  for (let i = 0; i < players.length; i += 2) {
    if (players[i + 1]) pairs.push([players[i], players[i + 1]]);
    else pairs.push([players[i], null]);
  }
  return pairs;
}

async function maybeAdvanceRound() {
  if (!activeTournament) return null;

  // if matches remain in current round, do nothing
  if (activeTournament.currentMatchIndex < activeTournament.matchQueue.length) {
    return null;
  }

  // round finished: if one winner remains, tournament done
  if (activeTournament.winners.length === 1) {
    const winnerId = activeTournament.winners[0];
    await dbRun('UPDATE tournaments SET winner_id = ? WHERE id = ?', [
      winnerId,
      activeTournament.id,
    ]);
    activeTournament = null;
    return { tournamentFinished: true, winnerId };
  }

  // prepare next round from winners
  const players = [...activeTournament.winners];
  activeTournament.winners = [];
  activeTournament.currentMatchIndex = 0;
  activeTournament.matchQueue = [];

  const nextPairs = await buildPairsFromPlayers(players);

  activeTournament.round += 1;
  activeTournament.matchQueue = nextPairs;

  // persist round matches
  await insertRoundMatches(
    activeTournament.id,
    activeTournament.round,
    nextPairs,
  );

  return { nextRoundReady: true, remaining: players.length };
}

async function getNextPlayableMatch() {
  const byes = [];

  for (let guard = 0; guard < 200; guard++) {
    if (!activeTournament) return { tournamentFinished: true, byes };

    // end of round? advance
    if (
      activeTournament.currentMatchIndex >= activeTournament.matchQueue.length
    ) {
      const adv = await maybeAdvanceRound();
      if (adv && adv.tournamentFinished) {
        return { tournamentFinished: true, winnerId: adv.winnerId, byes };
      }
      continue;
    }

    const match =
      activeTournament.matchQueue[activeTournament.currentMatchIndex];
    if (!match) {
      activeTournament.currentMatchIndex = activeTournament.matchQueue.length;
      continue;
    }

    const [player1, player2] = match;

    // bye => winner directly advances, and write winner_id into tournament_matches row
    if (!player2) {
      byes.push(player1);
      activeTournament.winners.push(player1);

      await dbRun(
        `UPDATE tournament_matches
         SET winner_id = ?
         WHERE tournament_id = ? AND round = ? AND match_index = ?`,
        [
          player1,
          activeTournament.id,
          activeTournament.round,
          activeTournament.currentMatchIndex,
        ],
      );

      activeTournament.currentMatchIndex++;
      continue;
    }

    // create session
    const result = await dbRun(
      `INSERT INTO game_sessions (player1_id, player2_id, tournament_id)
       VALUES (?, ?, ?)`,
      [player1, player2, activeTournament.id],
    );

    // link session_id into tournament_matches row
    await dbRun(
      `UPDATE tournament_matches
       SET session_id = ?
       WHERE tournament_id = ? AND round = ? AND match_index = ?`,
      [
        result.lastID,
        activeTournament.id,
        activeTournament.round,
        activeTournament.currentMatchIndex,
      ],
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

    playerIds = [
      ...new Set(
        playerIds.map(Number).filter((n) => Number.isFinite(n) && n > 0),
      ),
    ];

    if (playerIds.length < 3) {
      return reply
        .code(400)
        .send({ error: 'At least 3 distinct players required' });
    }

    const cleanName =
      name && String(name).trim() ? String(name).trim() : 'Tournament';

    const result = await dbRun('INSERT INTO tournaments (name) VALUES (?)', [
      cleanName,
    ]);
    const tournamentId = result.lastID;

    const players = [...playerIds];
    const pairs = await buildPairsFromPlayers(players);

    // persist round 1 matches
    await insertRoundMatches(tournamentId, 1, pairs);

    activeTournament = {
      id: tournamentId,
      name: cleanName,
      round: 1,
      matchQueue: pairs,
      currentMatchIndex: 0,
      winners: [],
    };

    return reply.send({ tournamentId, name: cleanName });
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

    if (!sessionId || (winnerIndex !== 1 && winnerIndex !== 2)) {
      return reply
        .code(400)
        .send({ error: 'sessionId and winnerIndex (1 or 2) are required' });
    }

    const session = await dbGet(
      'SELECT id, player1_id, player2_id, tournament_id FROM game_sessions WHERE id = ?',
      [sessionId],
    );
    if (!session) return reply.code(400).send({ error: 'Invalid sessionId' });

    const winnerId =
      winnerIndex === 1 ? session.player1_id : session.player2_id;
    activeTournament.winners.push(winnerId);

    // persist winner into tournament_matches by session_id
    await dbRun(
      `UPDATE tournament_matches SET winner_id = ?
       WHERE tournament_id = ? AND session_id = ?`,
      [winnerId, activeTournament.id, sessionId],
    );

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

// ✅ Bracket endpoint WITH emails
fastify.get('/tournament/:id/bracket', async (request, reply) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid tournament id' });
    }

    const tournament = await dbGet(
      'SELECT id, name, created_at, winner_id FROM tournaments WHERE id = ?',
      [id],
    );
    if (!tournament) {
      return reply.code(404).send({ error: 'Tournament not found' });
    }

    const matches = await dbAll(
      `
      SELECT
        tm.round,
        tm.match_index,
        tm.player1_id,
        u1.email AS player1_email,
        tm.player2_id,
        u2.email AS player2_email,
        tm.session_id,
        tm.winner_id,
        uw.email AS winner_email,
        tm.created_at
      FROM tournament_matches tm
      JOIN users u1 ON tm.player1_id = u1.id
      LEFT JOIN users u2 ON tm.player2_id = u2.id
      LEFT JOIN users uw ON tm.winner_id = uw.id
      WHERE tm.tournament_id = ?
      ORDER BY tm.round ASC, tm.match_index ASC
      `,
      [id],
    );

    return reply.send({ tournament, matches });
  } catch (err) {
    console.error('Bracket fetch failed', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.get('/tournament/:id/players', async (request, reply) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid tournament id' });
    }

    // Get distinct players from tournament_matches
    const rows = await dbAll(
      `
      SELECT DISTINCT u.id, u.email
      FROM tournament_matches tm
      JOIN users u ON u.id = tm.player1_id
      WHERE tm.tournament_id = ?
      UNION
      SELECT DISTINCT u.id, u.email
      FROM tournament_matches tm
      JOIN users u ON u.id = tm.player2_id
      WHERE tm.tournament_id = ? AND tm.player2_id IS NOT NULL
      `,
      [id, id],
    );

    return reply.send({ players: rows });
  } catch (err) {
    console.error('Tournament players fetch failed', err);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

fastify.post('/tournament/delete', async (request, reply) => {
  try {
    const { tournamentId } = request.body || {};
    const id = Number(tournamentId);
    if (!Number.isFinite(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid tournamentId' });
    }

    // Delete in the right order (FK safety)
    await dbRun('DELETE FROM tournament_matches WHERE tournament_id = ?', [id]);
    await dbRun('DELETE FROM tournaments WHERE id = ?', [id]);

    // Optional cleanup: detach sessions from this tournament (so history still exists)
    await dbRun(
      'UPDATE game_sessions SET tournament_id = NULL WHERE tournament_id = ?',
      [id],
    );

    // If you deleted the currently active tournament, also clear in-memory state
    if (activeTournament && Number(activeTournament.id) === id) {
      activeTournament = null;
    }

    return reply.send({ ok: true });
  } catch (err) {
    console.error('Tournament delete failed', err);
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
