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

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a hockey writer covering Kuxin Deep, a PS5 NHL ProClubs team whose fan site is called The Marina. Write game recaps in the style of Jonas Siegel, Chris Johnston and James Mirtle of The Athletic. Open with a specific moment or image from the game before pulling back to the result. Use short, standalone paragraphs for emphasis — one sentence when something needs to land. Weave stats in as evidence, never as a list. Be direct about player accountability without editorialising. Dry and understated when things go wrong; let the facts do the work. Use section headers for longer pieces. End with a line or image that captures the feeling of the game. Write in plain text with no markdown formatting.

Include at least one fabricated post-game quote from a Kuxin Deep player, attributed to one of the players by name. Quotes should sound exactly like real NHL post-game locker room interviews: heavy on clichés ("we just tried to get pucks in deep", "take it one game at a time", "play a full 60"), team-first mentality, brief and a little awkward, delivered with the rawness of someone who just finished a game. Occasionally a quote can show personality or dry humour. Quotes from players who had a rough night should be self-deprecating and accountable rather than deflecting. Integrate the quote naturally into the article as you would in a real game story.`,
      messages: [{
        role: 'user',
        content: `Write a game recap for The Marina based on the following match data:\n\n${JSON.stringify(gameData, null, 2)}`,
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
