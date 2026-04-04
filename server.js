const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
