require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = 3000;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RECAPS_FILE  = path.join(__dirname, 'recaps.json');
const MATCHES_FILE = path.join(__dirname, 'matches.json');

function loadRecaps() {
  try { return JSON.parse(fs.readFileSync(RECAPS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveRecap(matchId, recap) {
  const recaps = loadRecaps();
  recaps[matchId] = recap;
  fs.writeFileSync(RECAPS_FILE, JSON.stringify(recaps, null, 2));
}

function loadMatches() {
  try { return JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8')); }
  catch { return {}; }
}

function mergeAndSaveMatches(incoming) {
  const stored = loadMatches();
  let added = 0;
  for (const match of incoming) {
    if (!stored[match.matchId]) {
      stored[match.matchId] = match;
      added++;
    }
  }
  if (added > 0) fs.writeFileSync(MATCHES_FILE, JSON.stringify(stored, null, 2));
  return stored;
}

// Compute recent form for a given match (excludes the match itself so it reads
// as "entering this game with…" context).
function computeRecentForm(currentMatchId) {
  const stored = loadMatches();

  // All matches except the current one, newest first
  const history = Object.values(stored)
    .filter(m => m.matchId !== currentMatchId)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (history.length === 0) return null;

  // ── Team form ────────────────────────────────────────────────────────────
  const teamGames = history.slice(0, 10).map(m => {
    const us  = m.clubs[CLUB_ID];
    const opp = us ? m.clubs[us.opponentClubId] : null;
    if (!us || !opp) return null;
    const gf = parseInt(us.score);
    const ga = parseInt(opp.score);
    // EA stores 'otl' in the result field for overtime losses
    const result = us.result === 'otl' ? 'OTL' : gf > ga ? 'W' : 'L';
    return { result, gf, ga };
  }).filter(Boolean);

  const sumRecord = games => games.reduce(
    (acc, g) => { acc[g.result === 'W' ? 'w' : g.result === 'L' ? 'l' : 'otl']++; return acc; },
    { w: 0, l: 0, otl: 0 }
  );

  // Current streak (e.g. "L3", "W2")
  let streak = '';
  if (teamGames.length) {
    const r = teamGames[0].result;
    let n = 0;
    for (const g of teamGames) { if (g.result === r) n++; else break; }
    streak = `${r}${n}`;
  }

  const form5  = teamGames.slice(0, 5);
  const form10 = teamGames.slice(0, 10);

  // ── Player form ──────────────────────────────────────────────────────────
  const rawPlayerData = {};

  for (const m of history.slice(0, 10)) {
    const players = Object.values(m.players?.[CLUB_ID] || {});
    for (const p of players) {
      if (!p.playername) continue;
      const name = p.playername;
      if (!rawPlayerData[name]) rawPlayerData[name] = [];
      rawPlayerData[name].push({
        g:        parseInt(p.skgoals   || 0),
        a:        parseInt(p.skassists || 0),
        pts:      parseInt(p.skgoals   || 0) + parseInt(p.skassists || 0),
        shots:    parseInt(p.skshots   || 0),
        pm:       parseInt(p.skplusmin || 0),
        isGoalie: p.position === 'goalie',
        timestamp: m.timestamp,
      });
    }
  }

  const players = {};
  for (const [name, apps] of Object.entries(rawPlayerData)) {
    // apps are newest-first (history is sorted)
    const last5  = apps.slice(0, 5);
    const last10 = apps.slice(0, 10);

    const totals = gs => gs.reduce(
      (acc, g) => ({ g: acc.g + g.g, a: acc.a + g.a, pts: acc.pts + g.pts }),
      { g: 0, a: 0, pts: 0 }
    );

    // Consecutive games with at least one point
    let scoringStreak = 0;
    for (const g of last5) { if (g.pts > 0) scoringStreak++; else break; }

    // Consecutive games with at least one goal (skaters only)
    let goalStreak = 0;
    if (!apps[0]?.isGoalie) {
      for (const g of last5) { if (g.g > 0) goalStreak++; else break; }
    }

    players[name] = {
      last5,
      last10,
      totals5:  { ...totals(last5),  gp: last5.length  },
      totals10: { ...totals(last10), gp: last10.length },
      scoringStreak,
      goalStreak,
      isGoalie: apps[0]?.isGoalie ?? false,
    };
  }

  return {
    team: {
      form5:    form5.map(g => g.result),
      record5:  sumRecord(form5),
      form10:   form10.map(g => g.result),
      record10: sumRecord(form10),
      streak,
      gf5:  form5.reduce((a, g)  => a + g.gf, 0),
      ga5:  form5.reduce((a, g)  => a + g.ga, 0),
      gf10: form10.reduce((a, g) => a + g.gf, 0),
      ga10: form10.reduce((a, g) => a + g.ga, 0),
      gamesAvailable: history.length,
    },
    players,
  };
}

// Build a plain-text block for the Claude prompt.
function buildRecentFormPromptText(recentForm, currentPlayerNames) {
  if (!recentForm || recentForm.team.gamesAvailable === 0) return '';

  const { team, players } = recentForm;
  const lines = ['--- RECENT CONTEXT (weave naturally into the recap where relevant) ---'];

  if (team.form5.length > 0) {
    const r5 = team.record5;
    lines.push(
      `Team form last ${team.form5.length} games: ${team.form5.join(' ')} ` +
      `(${r5.w}W-${r5.l}L-${r5.otl}OTL, currently on a ${team.streak} streak, ` +
      `GF ${team.gf5} GA ${team.ga5})`
    );
  }
  if (team.form10.length > 5) {
    const r10 = team.record10;
    lines.push(
      `Last 10 games: ${r10.w}W-${r10.l}L-${r10.otl}OTL (GF ${team.gf10} GA ${team.ga10})`
    );
  }

  const relevantPlayers = Object.entries(players)
    .filter(([name]) => currentPlayerNames.includes(name));

  if (relevantPlayers.length > 0) {
    lines.push('');
    lines.push('Player form entering this game:');
    for (const [name, data] of relevantPlayers) {
      const t = data.totals5;
      if (t.gp === 0) continue;
      let line = `  ${name}: ${t.g}G ${t.a}A (${t.pts} pts) in last ${t.gp} games`;
      if (data.scoringStreak >= 3)                  line += ` — ${data.scoringStreak}-game point streak`;
      else if (data.goalStreak >= 2)                line += ` — goal in ${data.goalStreak} straight games`;
      else if (data.scoringStreak === 0 && t.gp >= 3) line += ` — scoreless in last ${t.gp} games`;
      lines.push(line);
    }
  }

  lines.push('--- END RECENT CONTEXT ---');
  return '\n\n' + lines.join('\n');
}

const EA_BASE = 'https://proclubs.ea.com/api/nhl';
const PLATFORM = 'common-gen5';
const CLUB_ID = '80678';

const EA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://www.ea.com',
  'Referer': 'https://www.ea.com/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/members/stats', async (req, res) => {
  try {
    const url = `${EA_BASE}/members/stats?platform=${PLATFORM}&clubId=${CLUB_ID}`;
    const response = await fetch(url, { headers: EA_HEADERS });
    if (!response.ok) throw new Error(`EA API responded with ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error fetching member stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/club/info', async (req, res) => {
  try {
    const url = `${EA_BASE}/clubs/info?platform=${PLATFORM}&clubIds=${CLUB_ID}`;
    const response = await fetch(url, { headers: EA_HEADERS });
    if (!response.ok) throw new Error(`EA API responded with ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error fetching club info:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/club/stats', async (req, res) => {
  try {
    const url = `${EA_BASE}/clubs/stats?platform=${PLATFORM}&clubIds=${CLUB_ID}`;
    const response = await fetch(url, { headers: EA_HEADERS });
    if (!response.ok) throw new Error(`EA API responded with ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error fetching club stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/club/seasonal', async (req, res) => {
  try {
    const url = `${EA_BASE}/clubs/seasonalStats?platform=${PLATFORM}&clubIds=${CLUB_ID}`;
    const response = await fetch(url, { headers: EA_HEADERS });
    if (!response.ok) throw new Error(`EA API responded with ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error fetching club seasonal stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/club/matches', async (req, res) => {
  try {
    const matchType = req.query.matchType || 'gameType5';
    const url = `${EA_BASE}/clubs/matches?matchType=${matchType}&platform=${PLATFORM}&clubIds=${CLUB_ID}`;
    const response = await fetch(url, { headers: EA_HEADERS });
    if (!response.ok) throw new Error(`EA API responded with ${response.status}`);
    const fresh = await response.json();

    // Merge new matches into permanent store, then return full history
    const all = mergeAndSaveMatches(fresh);
    const sorted = Object.values(all).sort((a, b) => b.timestamp - a.timestamp);
    res.json(sorted);
  } catch (err) {
    // If EA is unavailable, serve whatever we have stored
    console.error('Error fetching club matches:', err.message);
    const stored = Object.values(loadMatches()).sort((a, b) => b.timestamp - a.timestamp);
    if (stored.length) return res.json(stored);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/recap', async (req, res) => {
  try {
    let match;

    if (req.query.matchId) {
      const stored = loadMatches();
      match = stored[req.query.matchId];
      if (!match) throw new Error('Match not found');
    } else {
      const matchUrl = `${EA_BASE}/clubs/matches?matchType=gameType5&platform=${PLATFORM}&clubIds=${CLUB_ID}`;
      const matchResponse = await fetch(matchUrl, { headers: EA_HEADERS });
      if (!matchResponse.ok) throw new Error(`EA API responded with ${matchResponse.status}`);
      const matches = await matchResponse.json();
      match = matches[0];
    }

    if (!match) throw new Error('No matches found');

    // Return cached recap if we already have one for this match
    const recaps = loadRecaps();
    if (recaps[match.matchId]) {
      return res.json({ recap: recaps[match.matchId], cached: true });
    }

    const ourClub = match.clubs[CLUB_ID];
    const opponentId = ourClub.opponentClubId;
    const opponentClub = match.clubs[opponentId];
    const ourPlayers = match.players[CLUB_ID];
    const ourScore = parseInt(ourClub.score);
    const theirScore = parseInt(opponentClub.score);
    const result = ourScore > theirScore ? 'win' : ourScore < theirScore ? 'loss' : 'draw';

    // Summarise player stats for the prompt
    const playerSummaries = Object.values(ourPlayers).map(p => ({
      name: p.playername,
      position: p.position,
      goals: p.skgoals,
      assists: p.skassists,
      shots: p.skshots,
      hits: p.skhits,
      blockedShots: p.skbs,
      plusMinus: p.skplusmin,
      pim: p.skpim,
      toi: p.toi,
      savePercentage: p.position === 'goalie' ? p.glsavepct : null,
      saves: p.position === 'goalie' ? p.glsaves : null,
      goalsAgainst: p.position === 'goalie' ? p.glga : null,
      faceoffPct: p.skfopct !== '0.00' ? p.skfopct : null,
      passPct: p.skpasspct,
      takeaways: p.sktakeaways,
      giveaways: p.skgiveaways,
      powerPlayGoals: p.skppg,
      ratingOffense: p.ratingOffense,
      ratingDefense: p.ratingDefense,
      ratingTeamplay: p.ratingTeamplay,
    }));

    const gameData = {
      result,
      score: `${ourClub.score} - ${opponentClub.score}`,
      opponent: opponentClub.details?.name || 'Unknown',
      ourShots: ourClub.shots,
      opponentShots: opponentClub.shots,
      ourPassPct: ((parseInt(ourClub.passc) / parseInt(ourClub.passa)) * 100).toFixed(1),
      opponentPassPct: ((parseInt(opponentClub.passc) / parseInt(opponentClub.passa)) * 100).toFixed(1),
      ourTOA: ourClub.toa,
      opponentTOA: opponentClub.toa,
      ourPPG: ourClub.ppg,
      ourPPO: ourClub.ppo,
      opponentPPG: opponentClub.ppg,
      opponentPPO: opponentClub.ppo,
      players: playerSummaries,
    };

    const recentForm = computeRecentForm(match.matchId);
    const rfContext  = buildRecentFormPromptText(recentForm, playerSummaries.map(p => p.name));

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a hockey writer covering Kuxin Deep, a PS5 NHL ProClubs team whose fan site is called The Marina. Write short, punchy game recaps — three or four paragraphs max. Keep the tone light and fun; this is a group of friends playing video game hockey, not the Stanley Cup Finals. Don't be dramatic or overly critical when things go wrong — a bad game is just a bad game, not a referendum on anyone's character. Celebrate the good stuff, give a quick shrug to the bad, and move on. Weave in a couple of key stats naturally. Write in plain text with no markdown formatting.

If recent performance context is provided, weave in a natural reference or two — things like a player being on a hot streak, the team looking to snap a skid, or a player bouncing back. Keep it light; it's colour, not analysis.

Include one short fabricated post-game quote from a Kuxin Deep player. Keep it casual and a bit tongue-in-cheek — these are guys playing games with their mates, not professional athletes. The quote can be self-deprecating, have a bit of dry humour, or just be cheerfully clichéd. Integrate it naturally into the piece.`,
      messages: [{
        role: 'user',
        content: `Write a game recap for The Marina based on the following match data:\n\n${JSON.stringify(gameData, null, 2)}${rfContext}`,
      }],
    });

    const recap = message.content[0].text;
    saveRecap(match.matchId, recap);
    res.json({ recap, cached: false });
  } catch (err) {
    console.error('Error generating recap:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/recent-form', (req, res) => {
  const { matchId } = req.query;
  if (!matchId) return res.status(400).json({ error: 'matchId required' });
  const form = computeRecentForm(matchId);
  res.json(form || { team: { gamesAvailable: 0 }, players: {} });
});

app.get('/api/debug/results', (req, res) => {
  const stored = loadMatches();
  const rows = Object.values(stored)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(match => {
      const us = match.clubs[CLUB_ID];
      const opponentId = us?.opponentClubId;
      const them = match.clubs[opponentId];
      return {
        matchId: match.matchId,
        date: new Date(match.timestamp * 1000).toISOString().split('T')[0],
        us: us?.details?.name || 'Kuxin Deep',
        ourScore: us?.score,
        ourResult: us?.result,
        them: them?.details?.name || 'Opponent',
        theirScore: them?.score,
        theirResult: them?.result,
      };
    });
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
