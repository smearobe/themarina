// ── Helpers ──────────────────────────────────────────────────────────────────

function posLabel(p) {
  const map = { leftWing: 'LW', rightWing: 'RW', center: 'C', defenseMen: 'D', goalie: 'G' };
  return map[p] || p;
}

function posCls(p) {
  const map = { leftWing: 'pos-lw', rightWing: 'pos-rw', center: 'pos-c', defenseMen: 'pos-d', goalie: 'pos-g' };
  return map[p] || '';
}

function n(v, dec = 0) {
  const num = parseFloat(v);
  if (isNaN(num)) return v;
  return dec ? num.toFixed(dec) : Math.round(num).toLocaleString();
}

function pct(v) { return parseFloat(v).toFixed(1) + '%'; }

function plusMinus(v) {
  const num = parseInt(v);
  return num > 0 ? '+' + num : '' + num;
}

function minSec(totalSec) {
  const s = parseInt(totalSec);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function computeTimeAgo(timestamp) {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 3600)   return Math.round(diff / 60) + 'm ago';
  if (diff < 86400)  return Math.round(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.round(diff / 86400) + 'd ago';
  if (diff < 2592000) return Math.round(diff / 604800) + 'w ago';
  return Math.round(diff / 2592000) + 'mo ago';
}

// ── Data ─────────────────────────────────────────────────────────────────────

let members = [];
let clubInfo = null;
let matchHistory = [];
let sortCol = null;
let sortDir = 1; // 1 = desc, -1 = asc
let currentGroup = 'scoring';

async function loadData() {
  // Fetch member stats first — this drives all the main content
  try {
    const membersRes = await fetch('/api/members/stats');
    if (!membersRes.ok) throw new Error(`HTTP ${membersRes.status}`);
    const membersData = await membersRes.json();
    members = membersData.members || [];
  } catch (err) {
    document.getElementById('error-banner').classList.remove('hidden');
    document.getElementById('error-text').textContent =
      'Could not load stats from EA servers: ' + err.message;
    ['teamRecord','teamOffense','teamDefense','leadersGrid','statsTableBody','cardsGrid']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p style="color:var(--muted);padding:10px 0">No data available.</p>';
      });
    return;
  }

  // Render everything we have immediately
  renderAll();

  // Fetch club seasonal data and match history in parallel — neither blocks the main render
  await Promise.allSettled([
    fetch('/api/club/seasonal').then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return;
      clubInfo = Array.isArray(data) ? data[0] : (data['80678'] || Object.values(data)[0] || null);
      renderClubInfo();
    }),
    fetch('/api/club/matches').then(r => r.ok ? r.json() : null).then(data => {
      if (Array.isArray(data)) matchHistory = data;
      renderRecentForm();
    }),
  ]);
}

function renderAll() {
  renderHeader();
  renderClubInfo();
  renderOverview();
  renderLeaders();
  renderTable();
  renderCards();
}

// ── Header Record ─────────────────────────────────────────────────────────────

function renderHeader() {
  const totW  = members.reduce((a, m) => a + parseInt(m.wins || 0), 0);
  const totL  = members.reduce((a, m) => a + parseInt(m.losses || 0), 0);
  const totOT = members.reduce((a, m) => a + parseInt(m.otl || 0), 0);
  const totGP = Math.max(...members.map(m => parseInt(m.gp || 0)));
  // Use the player with the most GP as team GP reference
  const teamPlayer = members.find(m => parseInt(m.gp) === totGP) || members[0];
  const w = parseInt(teamPlayer?.wins || 0);
  const l = parseInt(teamPlayer?.losses || 0);
  const o = parseInt(teamPlayer?.otl || 0);
  const gp = w + l + o;
  const winPct = gp > 0 ? ((w / gp) * 100).toFixed(1) : '0.0';

  document.getElementById('headerRecord').innerHTML = `
    <div class="record-stat"><div class="val">${w}</div><div class="lbl">Wins</div></div>
    <div class="record-divider"></div>
    <div class="record-stat"><div class="val">${l}</div><div class="lbl">Losses</div></div>
    <div class="record-divider"></div>
    <div class="record-stat"><div class="val">${o}</div><div class="lbl">OTL</div></div>
    <div class="record-divider"></div>
    <div class="record-stat"><div class="val">${winPct}%</div><div class="lbl">Win%</div></div>
    <div class="record-divider"></div>
    <div class="record-stat"><div class="val">${gp}</div><div class="lbl">GP</div></div>
  `;
}

// ── Club Info Bar ─────────────────────────────────────────────────────────────

function renderClubInfo() {
  const el = document.getElementById('clubInfoBar');
  if (!clubInfo) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="cib-item"><span class="cib-lbl">Current Division</span><span class="cib-val">${clubInfo.currentDivision}</span></div>
    <div class="cib-divider"></div>
    <div class="cib-item"><span class="cib-lbl">Seasons</span><span class="cib-val">${clubInfo.seasons}</span></div>
    <div class="cib-divider"></div>
    <div class="cib-item"><span class="cib-lbl">Titles</span><span class="cib-val">${clubInfo.titlesWon}</span></div>
    <div class="cib-divider"></div>
    <div class="cib-item"><span class="cib-lbl">Promotions</span><span class="cib-val">${clubInfo.promotions}</span></div>
    <div class="cib-divider"></div>
    <div class="cib-item"><span class="cib-lbl">Relegations</span><span class="cib-val">${clubInfo.relegations}</span></div>
    <div class="cib-divider"></div>
    <div class="cib-item"><span class="cib-lbl">Best Division</span><span class="cib-val">${clubInfo.bestDivision}</span></div>
    <div class="cib-divider"></div>
    <div class="cib-item"><span class="cib-lbl">Star Level</span><span class="cib-val gold">${clubInfo.starLevel} ★</span></div>
  `;
}

// ── Recent Form ───────────────────────────────────────────────────────────────

const RECENT_GAMES_INITIAL = 5;

function renderRecentForm(showAll = false) {
  const el = document.getElementById('recentForm');
  if (!matchHistory.length) { el.innerHTML = '<p style="color:var(--muted)">No recent games available.</p>'; return; }

  const CLUB_ID = '80678';
  const visible = showAll ? matchHistory : matchHistory.slice(0, RECENT_GAMES_INITIAL);
  const hasMore = !showAll && matchHistory.length > RECENT_GAMES_INITIAL;

  const tiles = visible.map(match => {
    const us = match.clubs[CLUB_ID];
    if (!us) return '';
    const opponentId = us.opponentClubId;
    const them = match.clubs[opponentId];
    const opponentName = them?.details?.name || 'Opponent';
    const ourName = us.details?.name || 'Kuxin Deep';
    const ourScore = parseInt(us.score);
    const theirScore = parseInt(them?.score ?? 0);
    const isWin = ourScore > theirScore;
    const timeAgo = match.timestamp ? computeTimeAgo(match.timestamp) : '';

    return `
      <div class="game-tile ${isWin ? 'game-tile-win' : 'game-tile-loss'}" data-matchid="${match.matchId}" style="cursor:pointer">
        <div class="gt-time">${timeAgo}</div>
        <div class="gt-matchup">
          <div class="gt-team">
            <span class="gt-name">${ourName}</span>
            <span class="gt-score">${ourScore}</span>
          </div>
          <div class="gt-team gt-opponent">
            <span class="gt-name">${opponentName}</span>
            <span class="gt-score">${theirScore}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="games-ticker">${tiles}</div>
    ${hasMore ? `<button class="games-more-btn" id="gamesMoreBtn">More (${matchHistory.length - RECENT_GAMES_INITIAL} more games)</button>` : ''}
  `;

  el.querySelectorAll('.game-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const match = matchHistory.find(m => m.matchId === tile.dataset.matchid);
      if (match) openRecapModal(match);
    });
  });

  document.getElementById('gamesMoreBtn')?.addEventListener('click', () => renderRecentForm(true));
}

// ── Overview ──────────────────────────────────────────────────────────────────

function renderOverview() {
  // Use the player with most GP as the "team" record reference
  const anchor = members.reduce((a, b) => parseInt(a.gp) > parseInt(b.gp) ? a : b);
  const w = parseInt(anchor.wins);
  const l = parseInt(anchor.losses);
  const o = parseInt(anchor.otl);
  const gp = w + l + o;
  const winPct = ((w / gp) * 100).toFixed(1);
  const pts = (w * 2 + o).toString();

  document.getElementById('teamRecord').innerHTML = `
    <div class="card-title">Team Record</div>
    <div class="record-display">
      <div class="rec-block"><div class="big wins">${w}</div><div class="tiny">Wins</div></div>
      <div class="rec-block"><div class="big losses">${l}</div><div class="tiny">Losses</div></div>
      <div class="rec-block"><div class="big otl">${o}</div><div class="tiny">OTL</div></div>
    </div>
    <div class="win-bar-wrap">
      <div class="win-bar-label"><span>Win ${winPct}%</span><span>${gp} GP · ${pts} Pts</span></div>
      <div class="win-bar-track">
        <div class="win-bar-fill w" style="width:${(w/gp*100).toFixed(1)}%"></div>
        <div class="win-bar-fill o" style="width:${(o/gp*100).toFixed(1)}%"></div>
        <div class="win-bar-fill l" style="width:${(l/gp*100).toFixed(1)}%"></div>
      </div>
    </div>
  `;

  const totG  = members.reduce((a, m) => a + parseInt(m.goals || 0), 0);
  const totA  = members.reduce((a, m) => a + parseInt(m.assists || 0), 0);
  const totPP = members.reduce((a, m) => a + parseInt(m.ppg || 0), 0);
  const totSH = members.reduce((a, m) => a + parseInt(m.shg || 0), 0);
  const totGWG = members.reduce((a, m) => a + parseInt(m.gwg || 0), 0);
  const totHT = members.reduce((a, m) => a + parseInt(m.hattricks || 0), 0);
  const avgShot = (members.reduce((a, m) => a + parseFloat(m.shotpct || 0), 0) / members.length).toFixed(1);

  document.getElementById('teamOffense').innerHTML = `
    <div class="card-title">Offensive Output</div>
    <div class="summary-rows">
      <div class="summary-row"><span class="label">Total Goals</span><span class="value">${totG}</span></div>
      <div class="summary-row"><span class="label">Total Assists</span><span class="value">${totA}</span></div>
      <div class="summary-row"><span class="label">Total Points</span><span class="value">${totG + totA}</span></div>
      <div class="summary-row"><span class="label">Power Play Goals</span><span class="value">${totPP}</span></div>
      <div class="summary-row"><span class="label">Short-Handed Goals</span><span class="value">${totSH}</span></div>
      <div class="summary-row"><span class="label">Game-Winning Goals</span><span class="value">${totGWG}</span></div>
      <div class="summary-row"><span class="label">Hat Tricks</span><span class="value">${totHT}</span></div>
      <div class="summary-row"><span class="label">Avg Shot%</span><span class="value">${avgShot}%</span></div>
    </div>
  `;

  const totHits = members.reduce((a, m) => a + parseInt(m.hits || 0), 0);
  const totBS   = members.reduce((a, m) => a + parseInt(m.bs || 0), 0);
  const totTA   = members.reduce((a, m) => a + parseInt(m.takeaways || 0), 0);
  const totGA   = members.reduce((a, m) => a + parseInt(m.giveaways || 0), 0);
  const totInt  = members.reduce((a, m) => a + parseInt(m.interceptions || 0), 0);
  const totPIM  = members.reduce((a, m) => a + parseInt(m.pim || 0), 0);
  const totFights = members.reduce((a, m) => a + parseInt(m.fights || 0), 0);
  const avgPass = (members.reduce((a, m) => a + parseFloat(m.passpct || 0), 0) / members.length).toFixed(1);

  document.getElementById('teamDefense').innerHTML = `
    <div class="card-title">Defence & Discipline</div>
    <div class="summary-rows">
      <div class="summary-row"><span class="label">Total Hits</span><span class="value">${totHits.toLocaleString()}</span></div>
      <div class="summary-row"><span class="label">Blocked Shots</span><span class="value">${totBS}</span></div>
      <div class="summary-row"><span class="label">Takeaways</span><span class="value">${totTA}</span></div>
      <div class="summary-row"><span class="label">Giveaways</span><span class="value">${totGA.toLocaleString()}</span></div>
      <div class="summary-row"><span class="label">Interceptions</span><span class="value">${totInt}</span></div>
      <div class="summary-row"><span class="label">Avg Pass%</span><span class="value">${avgPass}%</span></div>
      <div class="summary-row"><span class="label">Total PIM</span><span class="value">${totPIM}</span></div>
      <div class="summary-row"><span class="label">Total Fights</span><span class="value">${totFights}</span></div>
    </div>
  `;
}

// ── Leaders ───────────────────────────────────────────────────────────────────

function renderLeaders() {
  const categories = [
    { label: 'Points', key: 'points', fmt: n },
    { label: 'Goals', key: 'goals', fmt: n },
    { label: 'Assists', key: 'assists', fmt: n },
    { label: 'Pts / Game', key: 'pointspg', fmt: v => parseFloat(v).toFixed(1) },
    { label: 'Hits', key: 'hits', fmt: n },
    { label: 'Blocked Shots', key: 'bs', fmt: n },
    { label: 'Takeaways', key: 'takeaways', fmt: n },
    { label: 'Hat Tricks', key: 'hattricks', fmt: n },
    { label: 'Game Winners', key: 'gwg', fmt: n },
    { label: 'Shot %', key: 'shotpct', fmt: v => parseFloat(v).toFixed(1) + '%' },
    { label: 'Pass %', key: 'passpct', fmt: v => parseFloat(v).toFixed(1) + '%' },
    { label: 'PP Goals', key: 'ppg', fmt: n },
  ];

  const html = categories.map(cat => {
    const leader = members.reduce((a, b) =>
      parseFloat(b[cat.key] || 0) > parseFloat(a[cat.key] || 0) ? b : a
    );
    return `
      <div class="leader-card" data-name="${leader.name}">
        <div class="leader-category">${cat.label}</div>
        <div class="leader-name">${leader.name}</div>
        <div class="leader-value">${cat.fmt(leader[cat.key])}</div>
      </div>
    `;
  }).join('');

  document.getElementById('leadersGrid').innerHTML = html;

  document.querySelectorAll('.leader-card').forEach(card => {
    card.addEventListener('click', () => {
      const m = members.find(p => p.name === card.dataset.name);
      if (m) openModal(m);
    });
  });
}

// ── Stats Table ───────────────────────────────────────────────────────────────

const STAT_GROUPS = {
  scoring: {
    label: 'Scoring',
    cols: [
      { label: 'Player', key: 'name', fmt: v => v, left: true },
      { label: 'Pos', key: 'favoritePosition', fmt: posLabel, left: true },
      { label: 'GP', key: 'gp', fmt: n },
      { label: 'G', key: 'goals', fmt: n },
      { label: 'A', key: 'assists', fmt: n },
      { label: 'PTS', key: 'points', fmt: n },
      { label: 'PTS/GP', key: 'pointspg', fmt: v => parseFloat(v).toFixed(1) },
      { label: '+/-', key: 'plusmin', fmt: plusMinus },
      { label: 'GWG', key: 'gwg', fmt: n },
      { label: 'PPG', key: 'ppg', fmt: n },
      { label: 'SHG', key: 'shg', fmt: n },
      { label: 'HAT', key: 'hattricks', fmt: n },
      { label: 'TOI', key: 'toi', fmt: minSec },
    ]
  },
  shooting: {
    label: 'Shooting',
    cols: [
      { label: 'Player', key: 'name', fmt: v => v, left: true },
      { label: 'Pos', key: 'favoritePosition', fmt: posLabel, left: true },
      { label: 'GP', key: 'gp', fmt: n },
      { label: 'G', key: 'goals', fmt: n },
      { label: 'SOG', key: 'shots', fmt: n },
      { label: 'SOG/GP', key: 'shotspg', fmt: v => parseFloat(v).toFixed(1) },
      { label: 'ATT', key: 'shotattempts', fmt: n },
      { label: 'Shot%', key: 'shotpct', fmt: v => parseFloat(v).toFixed(1) + '%' },
      { label: 'OnNet%', key: 'shotonnetpct', fmt: v => parseFloat(v).toFixed(1) + '%' },
      { label: 'Brkwy', key: 'breakaways', fmt: n },
      { label: 'Brk%', key: 'breakawaypct', fmt: v => parseFloat(v).toFixed(1) + '%' },
      { label: 'PenShot', key: 'penaltyshotgoals', fmt: n },
    ]
  },
  defense: {
    label: 'Defence',
    cols: [
      { label: 'Player', key: 'name', fmt: v => v, left: true },
      { label: 'Pos', key: 'favoritePosition', fmt: posLabel, left: true },
      { label: 'GP', key: 'gp', fmt: n },
      { label: '+/-', key: 'plusmin', fmt: plusMinus },
      { label: 'Hits', key: 'hits', fmt: n },
      { label: 'Hits/GP', key: 'hitspg', fmt: v => parseFloat(v).toFixed(1) },
      { label: 'BS', key: 'bs', fmt: n },
      { label: 'Tkwy', key: 'takeaways', fmt: n },
      { label: 'Gvwy', key: 'giveaways', fmt: n },
      { label: 'Int', key: 'interceptions', fmt: n },
      { label: 'Defl', key: 'deflections', fmt: n },
      { label: 'Pass%', key: 'passpct', fmt: v => parseFloat(v).toFixed(1) + '%' },
    ]
  },
  special: {
    label: 'Special Teams',
    cols: [
      { label: 'Player', key: 'name', fmt: v => v, left: true },
      { label: 'Pos', key: 'favoritePosition', fmt: posLabel, left: true },
      { label: 'GP', key: 'gp', fmt: n },
      { label: 'PPG', key: 'ppg', fmt: n },
      { label: 'SHG', key: 'shg', fmt: n },
      { label: 'PenDrwn', key: 'penaltiesdrawn', fmt: n },
      { label: 'PK Clear', key: 'pkclearzone', fmt: n },
      { label: 'FO%', key: 'fop', fmt: v => parseFloat(v).toFixed(1) + '%' },
      { label: 'FOW', key: 'fow', fmt: n },
      { label: 'FOL', key: 'fol', fmt: n },
      { label: 'Scr Ch', key: 'scrnchances', fmt: n },
    ]
  },
  discipline: {
    label: 'Discipline',
    cols: [
      { label: 'Player', key: 'name', fmt: v => v, left: true },
      { label: 'Pos', key: 'favoritePosition', fmt: posLabel, left: true },
      { label: 'GP', key: 'gp', fmt: n },
      { label: 'PIM', key: 'pim', fmt: n },
      { label: 'Offside', key: 'offsides', fmt: n },
      { label: 'Off/GP', key: 'offsidespg', fmt: v => parseFloat(v).toFixed(1) },
      { label: 'Fights', key: 'fights', fmt: n },
      { label: 'Fight W', key: 'fightswon', fmt: n },
      { label: 'DNF', key: 'DNF', fmt: n },
      { label: 'Disc', key: 'playerQuitDisc', fmt: n },
      { label: 'Win%', key: 'winpct', fmt: v => v + '%' },
    ]
  }
};

function renderTable() {
  const group = STAT_GROUPS[currentGroup];
  const cols = group.cols;

  // Header
  document.getElementById('statsTableHead').innerHTML = `<tr>
    ${cols.map((c, i) => `<th data-colidx="${i}" class="${sortCol === i ? (sortDir > 0 ? 'sort-desc' : 'sort-asc') : ''}">${c.label}</th>`).join('')}
  </tr>`;

  // Sort members
  let sorted = [...members];
  if (sortCol !== null) {
    const col = cols[sortCol];
    sorted.sort((a, b) => {
      const av = a[col.key];
      const bv = b[col.key];
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn)) return (bn - an) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
  }

  document.getElementById('statsTableBody').innerHTML = sorted.map(m => `
    <tr data-name="${m.name}">
      ${cols.map((c, i) => {
        if (i === 0) {
          return `<td>${m.name} <span class="pos-badge ${posCls(m.favoritePosition)}">${posLabel(m.favoritePosition)}</span></td>`;
        }
        if (c.key === 'favoritePosition') return `<td style="text-align:left"></td>`;
        const raw = m[c.key];
        const val = c.fmt(raw);
        const num = parseFloat(raw);
        let cls = '';
        if (c.key === 'plusmin') cls = num > 0 ? ' style="color:var(--green)"' : num < 0 ? ' style="color:var(--red)"' : '';
        return `<td${cls}>${val ?? '—'}</td>`;
      }).join('')}
    </tr>
  `).join('');

  // Sort click
  document.querySelectorAll('#statsTableHead th').forEach(th => {
    th.addEventListener('click', () => {
      const idx = parseInt(th.dataset.colidx);
      if (sortCol === idx) sortDir *= -1;
      else { sortCol = idx; sortDir = 1; }
      renderTable();
    });
  });

  // Row click → modal
  document.querySelectorAll('#statsTableBody tr').forEach(row => {
    row.addEventListener('click', () => {
      const m = members.find(p => p.name === row.dataset.name);
      if (m) openModal(m);
    });
  });
}

// ── Player Cards ──────────────────────────────────────────────────────────────

function renderCards() {
  document.getElementById('cardsGrid').innerHTML = members.map(m => {
    const w = parseInt(m.wins);
    const l = parseInt(m.losses);
    const o = parseInt(m.otl);
    const gp = w + l + o;
    const winPct = gp > 0 ? ((w / gp) * 100).toFixed(0) : 0;
    return `
      <div class="player-card" data-name="${m.name}">
        <div class="pc-header">
          <div>
            <div class="pc-name">${m.name}</div>
            <div class="pc-pos">${posLabel(m.favoritePosition)}</div>
          </div>
          <div class="pc-gp"><span>${m.gp}</span>GP</div>
        </div>
        <div class="pc-stats">
          <div class="pc-stat"><div class="val">${m.goals}</div><div class="lbl">G</div></div>
          <div class="pc-stat"><div class="val">${m.assists}</div><div class="lbl">A</div></div>
          <div class="pc-stat"><div class="val">${m.points}</div><div class="lbl">PTS</div></div>
          <div class="pc-stat"><div class="val">${parseFloat(m.pointspg).toFixed(1)}</div><div class="lbl">Pts/GP</div></div>
          <div class="pc-stat"><div class="val ${parseInt(m.plusmin) < 0 ? '' : ''}">${plusMinus(m.plusmin)}</div><div class="lbl">+/-</div></div>
          <div class="pc-stat"><div class="val gold">${m.hattricks}</div><div class="lbl">HAT</div></div>
        </div>
        <div class="pc-record">
          <span class="rec">${w}-${l}-${o}</span>
          <span class="pct">Win% ${winPct}%</span>
        </div>
        <div class="pc-bar"><div class="pc-bar-fill" style="width:${winPct}%"></div></div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => {
      const m = members.find(p => p.name === card.dataset.name);
      if (m) openModal(m);
    });
  });
}

// ── Game Recap Modal ──────────────────────────────────────────────────────────

const RECAP_CLUB_ID = '80678';

function openRecapModal(match) {
  const modal = document.getElementById('recapModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderGameRecap(match);
}

function closeRecapModal() {
  document.getElementById('recapModal').classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('recapModalClose').addEventListener('click', closeRecapModal);
document.getElementById('recapModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeRecapModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRecapModal(); });

function renderGameRecap(match) {
  const us = match.clubs[RECAP_CLUB_ID];
  const opponentId = us.opponentClubId;
  const them = match.clubs[opponentId];
  const ourPlayers = Object.values(match.players?.[RECAP_CLUB_ID] || {});
  const theirPlayers = Object.values(match.players?.[opponentId] || {});
  const ourName = us.details?.name || 'Kuxin Deep';
  const theirName = them?.details?.name || 'Opponent';
  const isWin = parseInt(us.score) > parseInt(them?.score ?? 0);

  const date = new Date(match.timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // ── Stat bar helper ──
  function statBar(label, ourVal, theirVal, displayOur, displayThem) {
    const total = ourVal + theirVal || 1;
    const ourPct = Math.round(ourVal / total * 100);
    return `
      <div class="rgc-stat-item">
        <div class="rgc-stat-header">
          <span class="rgc-stat-team-val">${displayOur ?? ourVal}</span>
          <span class="rgc-stat-name">${label}</span>
          <span class="rgc-stat-team-val">${displayThem ?? theirVal}</span>
        </div>
        <div class="rgc-bar-track">
          <div class="rgc-bar-us" style="width:${ourPct}%"></div>
          <div class="rgc-bar-them" style="width:${100 - ourPct}%"></div>
        </div>
      </div>`;
  }

  // ── Aggregate stats ──
  const sum = (players, key) => players.reduce((a, p) => a + parseInt(p[key] || 0), 0);

  const ourShots  = parseInt(us.shots || 0);
  const themShots = parseInt(them?.shots || 0);

  const ourFOW  = sum(ourPlayers, 'skfow'),  ourFOL  = sum(ourPlayers, 'skfol');
  const themFOW = sum(theirPlayers, 'skfow'), themFOL = sum(theirPlayers, 'skfol');
  const ourFOPct  = ourFOW  + ourFOL  > 0 ? (ourFOW  / (ourFOW  + ourFOL)  * 100).toFixed(1) : '0.0';
  const themFOPct = themFOW + themFOL > 0 ? (themFOW / (themFOW + themFOL) * 100).toFixed(1) : '0.0';

  const ourPPG = parseInt(us.ppg || 0),   ourPPO  = parseInt(us.ppo || 0);
  const themPPG = parseInt(them?.ppg || 0), themPPO = parseInt(them?.ppo || 0);
  const ourPPPct  = ourPPO  > 0 ? (ourPPG  / ourPPO  * 100).toFixed(1) : '0.0';
  const themPPPct = themPPO > 0 ? (themPPG / themPPO * 100).toFixed(1) : '0.0';

  const ourPIM  = sum(ourPlayers, 'skpim'),      themPIM  = sum(theirPlayers, 'skpim');
  const ourHits = sum(ourPlayers, 'skhits'),     themHits = sum(theirPlayers, 'skhits');
  const ourBS   = sum(ourPlayers, 'skbs'),       themBS   = sum(theirPlayers, 'skbs');
  const ourGive = sum(ourPlayers, 'skgiveaways'), themGive = sum(theirPlayers, 'skgiveaways');
  const ourTake = sum(ourPlayers, 'sktakeaways'), themTake = sum(theirPlayers, 'sktakeaways');

  // ── Scoring summary — goal log (best approximation without event data) ──
  const scorers = ourPlayers
    .filter(p => p.position !== 'goalie' && parseInt(p.skgoals) > 0)
    .sort((a, b) => parseInt(b.skgoals) - parseInt(a.skgoals));

  const assisters = ourPlayers
    .filter(p => parseInt(p.skassists) > 0)
    .map(p => p.playername);

  const goalRows = scorers.flatMap(p => {
    const goals = parseInt(p.skgoals);
    const isPP = parseInt(p.skppg) > 0;
    return Array.from({ length: goals }, (_, i) => {
      const tag = isPP && i < parseInt(p.skppg) ? ' <span class="rgc-goal-tag">PP</span>' : '';
      const assisterList = assisters.filter(n => n !== p.playername);
      const assistLine = assisterList.length
        ? `<div class="rgc-goal-assist">Assisted by: ${assisterList.join(', ')}</div>`
        : '<div class="rgc-goal-assist">Unassisted</div>';
      return `
        <div class="rgc-goal-entry">
          <div class="rgc-goal-dot"></div>
          <div>
            <div class="rgc-goal-scorer">${p.playername}${tag}</div>
            ${assistLine}
          </div>
        </div>`;
    });
  });

  const goalie = ourPlayers.find(p => p.position === 'goalie');
  const goalieHtml = goalie ? `
    <div class="rgc-section-title" style="margin-top:20px">In Goal</div>
    <div class="rgc-goal-entry">
      <div class="rgc-goal-dot rgc-dot-g"></div>
      <div>
        <div class="rgc-goal-scorer">${goalie.playername}</div>
        <div class="rgc-goal-assist">${goalie.glsaves} SV · ${(parseFloat(goalie.glsavepct) * 100).toFixed(1)}% SV% · ${goalie.glga} GA</div>
      </div>
    </div>` : '';

  const scoringHtml = goalRows.length
    ? goalRows.join('') + goalieHtml
    : '<p class="rgc-empty">No goals recorded</p>' + goalieHtml;

  // ── Box score ──
  function buildBoxScoreTable(players, tableId) {
    const skaters = players
      .filter(p => p.position !== 'goalie')
      .sort((a, b) => (parseInt(b.skgoals) + parseInt(b.skassists)) - (parseInt(a.skgoals) + parseInt(a.skassists)));
    const gl = players.find(p => p.position === 'goalie');

    const rows = skaters.map(p => {
      const g  = parseInt(p.skgoals || 0);
      const a  = parseInt(p.skassists || 0);
      const pm = parseInt(p.skplusmin || 0);
      const fo = parseFloat(p.skfopct || 0);
      return `<tr>
        <td class="bs-name">${p.playername}</td>
        <td data-val="${g}">${g}</td>
        <td data-val="${a}">${a}</td>
        <td data-val="${g + a}">${g + a}</td>
        <td data-val="${pm}" class="${pm > 0 ? 'bs-pos' : pm < 0 ? 'bs-neg' : ''}">${pm > 0 ? '+' + pm : pm}</td>
        <td data-val="${parseInt(p.skpim || 0)}">${p.skpim || 0}</td>
        <td data-val="${parseInt(p.skshots || 0)}">${p.skshots || 0}</td>
        <td data-val="${parseInt(p.skbs || 0)}">${p.skbs || 0}</td>
        <td data-val="${parseInt(p.skhits || 0)}">${p.skhits || 0}</td>
        <td data-val="${parseInt(p.skgiveaways || 0)}">${p.skgiveaways || 0}</td>
        <td data-val="${parseInt(p.sktakeaways || 0)}">${p.sktakeaways || 0}</td>
        <td data-val="${fo}">${fo > 0 ? fo.toFixed(1) + '%' : '—'}</td>
      </tr>`;
    }).join('');

    const goalieRow = gl ? `<tr class="bs-goalie-row">
      <td class="bs-name">${gl.playername} <span class="bs-pos-tag">G</span></td>
      <td colspan="5" style="color:var(--muted);font-size:0.78rem">${gl.glsaves} SV · ${(parseFloat(gl.glsavepct) * 100).toFixed(1)}% · ${gl.glga} GA</td>
      <td colspan="6"></td>
    </tr>` : '';

    return `<div class="bs-wrap">
      <table id="${tableId}" class="bs-table">
        <thead><tr>
          <th class="bs-name">Player</th>
          <th data-sort>G</th><th data-sort>A</th><th data-sort>PTS</th><th data-sort>+/-</th>
          <th data-sort>PIM</th><th data-sort>SOG</th><th data-sort>BLK</th><th data-sort>HIT</th>
          <th data-sort>GV</th><th data-sort>TK</th><th data-sort>FO%</th>
        </tr></thead>
        <tbody>${rows}${goalieRow}</tbody>
      </table>
    </div>`;
  }

  const boxScoreHtml = `
    <div class="bs-team-label">${ourName}</div>
    ${buildBoxScoreTable(ourPlayers, 'bs-us')}
    <div class="bs-team-label bs-team-label-opp">${theirName}</div>
    ${buildBoxScoreTable(theirPlayers, 'bs-them')}`;

  document.getElementById('recapModalContent').innerHTML = `
    <div class="rgc-hero">
      <div class="rgc-matchup">
        <div class="rgc-team-us">
          <span class="rgc-team-name">${ourName.toUpperCase()}</span>
          <span class="rgc-team-score ${isWin ? 'rgc-score-win' : 'rgc-score-loss'}">${us.score}</span>
        </div>
        <div class="rgc-dash">–</div>
        <div class="rgc-team-them">
          <span class="rgc-team-score ${!isWin ? 'rgc-score-win' : 'rgc-score-neutral'}">${them?.score}</span>
          <span class="rgc-team-name">${theirName.toUpperCase()}</span>
        </div>
      </div>
      <div class="rgc-date">${date}</div>
    </div>

    <div class="rgc-body">
      <div class="rgc-article-col">
        <div id="recapArticle" class="rgc-article">
          <div class="loading-pulse">Generating recap…</div>
        </div>
      </div>
      <div class="rgc-side-col">
        <div class="rgc-section-title">Scoring Summary</div>
        ${scoringHtml}
      </div>
    </div>

    <div id="recentFormSection" class="rgc-form-section">
      <div class="loading-pulse" style="padding:14px 0">Loading recent form…</div>
    </div>

    <div class="rgc-lower">
      <div class="rgc-stats-col">
        <div class="rgc-section-title">Game Stats</div>
        ${statBar('Shots on Goal', ourShots, themShots)}
        ${statBar('Faceoff %', parseFloat(ourFOPct), parseFloat(themFOPct), ourFOPct + '%', themFOPct + '%')}
        ${statBar('Power Play %', parseFloat(ourPPPct), parseFloat(themPPPct), ourPPPct + '% (' + ourPPG + '/' + ourPPO + ')', themPPPct + '% (' + themPPG + '/' + themPPO + ')')}
        ${statBar('Penalty Minutes', ourPIM, themPIM)}
        ${statBar('Hits', ourHits, themHits)}
        ${statBar('Blocked Shots', ourBS, themBS)}
        ${statBar('Giveaways', ourGive, themGive)}
        ${statBar('Takeaways', ourTake, themTake)}
      </div>
      <div class="rgc-boxscore-col">
        <div class="rgc-section-title">Box Score</div>
        ${boxScoreHtml}
      </div>
    </div>
  `;

  makeBoxScoreSortable('bs-us');
  makeBoxScoreSortable('bs-them');

  const currentPlayerNames = ourPlayers.map(p => p.playername).filter(Boolean);
  loadRecapArticle(match.matchId);
  loadRecentForm(match.matchId, currentPlayerNames);
}

function makeBoxScoreSortable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  let sortCol = null, sortDir = 1;

  table.querySelectorAll('thead th[data-sort]').forEach((th, rawIdx) => {
    // rawIdx is among sortable headers only; find real cell index
    const colIdx = Array.from(th.parentElement.children).indexOf(th);
    th.addEventListener('click', () => {
      if (sortCol === colIdx) sortDir *= -1;
      else { sortCol = colIdx; sortDir = 1; }

      table.querySelectorAll('thead th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(sortDir > 0 ? 'sort-desc' : 'sort-asc');

      const tbody = table.querySelector('tbody');
      const goalieRow = tbody.querySelector('.bs-goalie-row');
      const rows = Array.from(tbody.querySelectorAll('tr:not(.bs-goalie-row)'));

      rows.sort((a, b) => {
        const aVal = parseFloat(a.cells[colIdx]?.dataset.val) || 0;
        const bVal = parseFloat(b.cells[colIdx]?.dataset.val) || 0;
        return (bVal - aVal) * sortDir;
      });

      rows.forEach(r => tbody.appendChild(r));
      if (goalieRow) tbody.appendChild(goalieRow);
    });
  });
}

async function loadRecapArticle(matchId) {
  const el = document.getElementById('recapArticle');
  if (!el) return;
  try {
    const res = await fetch(`/api/recap?matchId=${matchId}`);
    const data = await res.json();
    if (!data.recap) throw new Error('No recap');

    const paras = data.recap.split('\n').filter(Boolean);
    const first = paras.slice(0, 4);
    const rest  = paras.slice(4);

    const toHtml = lines => lines.map(l =>
      l === l.toUpperCase() && l.length < 60
        ? `<h3 class="rgc-article-heading">${l}</h3>`
        : `<p>${l}</p>`
    ).join('');

    el.innerHTML = `
      <div class="rgc-article-preview">${toHtml(first)}</div>
      ${rest.length ? `
        <div class="rgc-article-rest hidden">${toHtml(rest)}</div>
        <button class="rgc-read-more" id="recapReadMore">Read More →</button>
      ` : ''}
    `;

    document.getElementById('recapReadMore')?.addEventListener('click', function () {
      document.querySelector('.rgc-article-rest').classList.remove('hidden');
      this.remove();
    });
  } catch {
    if (el) el.innerHTML = '<p class="rgc-empty">Recap unavailable.</p>';
  }
}

async function loadRecentForm(matchId, currentPlayerNames) {
  const el = document.getElementById('recentFormSection');
  if (!el) return;

  try {
    const res = await fetch(`/api/recent-form?matchId=${matchId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data || data.team.gamesAvailable === 0) {
      el.innerHTML = '';
      return;
    }

    const { team, players } = data;

    // ── Team form strip ──
    const bubbles = team.form5.map(r =>
      `<span class="rfb rfb-${r}">${r}</span>`
    ).join('');

    const r5  = team.record5;
    const r10 = team.record10;

    const streakLetter = team.streak ? team.streak[0] : '';
    const streakHtml = team.streak
      ? `<span class="rf-streak-inline rf-streak-${streakLetter}">${team.streak}</span>`
      : '';

    const teamHtml = `
      <div class="rgc-form-team-panel">
        <div class="rgc-section-title">Recent Team Form</div>
        <div class="rgc-form-bubbles">${bubbles}</div>
        <div class="rgc-form-summary">
          ${r5.w}-${r5.l}-${r5.otl} last ${team.form5.length}
          · ${streakHtml} streak
          · GF&nbsp;${team.gf5}&nbsp;GA&nbsp;${team.ga5}
        </div>
        ${team.form10.length > 5
          ? `<div class="rgc-form-trend">Last 10: ${r10.w}-${r10.l}-${r10.otl} · GF ${team.gf10} GA ${team.ga10}</div>`
          : ''}
      </div>`;

    // ── Per-player form table ──
    const relevantPlayers = currentPlayerNames
      .map(name => ({ name, pd: players[name] }))
      .filter(p => p.pd && p.pd.totals5.gp > 0);

    let playersHtml = '';
    if (relevantPlayers.length > 0) {
      const rows = relevantPlayers.map(({ name, pd }) => {
        const t = pd.totals5;

        // Per-game dots for last 5 (newest → oldest left → right)
        const dots = pd.last5.map(g =>
          `<span class="rf-dot ${g.pts > 0 ? 'rf-dot-on' : 'rf-dot-off'}" title="${g.g}G ${g.a}A"></span>`
        ).join('');

        let badge = '';
        if (pd.scoringStreak >= 2)
          badge = `<span class="rf-badge rf-badge-hot">${pd.scoringStreak}-game pt streak</span>`;
        else if (pd.goalStreak >= 2)
          badge = `<span class="rf-badge rf-badge-hot">${pd.goalStreak}-game goal streak</span>`;
        else if (pd.scoringStreak === 0 && t.gp >= 3)
          badge = `<span class="rf-badge rf-badge-cold">Scoreless run</span>`;

        return `<tr>
          <td class="bs-name">${name}</td>
          <td>${t.gp}</td>
          <td>${t.g}</td>
          <td>${t.a}</td>
          <td><strong>${t.pts}</strong></td>
          <td class="rf-dots-cell">${dots}</td>
          <td>${badge}</td>
        </tr>`;
      }).join('');

      playersHtml = `
        <div class="rgc-form-players-panel">
          <div class="rgc-section-title">Player Form — Last 5 Appearances</div>
          <div class="bs-wrap">
            <table class="rgc-form-table">
              <thead><tr>
                <th class="bs-name">Player</th>
                <th>GP</th><th>G</th><th>A</th><th>PTS</th>
                <th>Last 5</th><th></th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }

    el.innerHTML = `<div class="rgc-form-inner">${teamHtml}${playersHtml}</div>`;

  } catch (err) {
    console.error('Recent form error:', err);
    el.innerHTML = ''; // silently hide on failure
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(m) {
  const pm = parseInt(m.plusmin);
  const pmCls = pm > 0 ? 'pos' : pm < 0 ? 'neg' : '';
  const w = parseInt(m.wins), l = parseInt(m.losses), o = parseInt(m.otl);
  const gp = w + l + o;
  const foPct = parseFloat(m.fop) > 0 ? `${parseFloat(m.fop).toFixed(1)}% (${m.fow}W/${m.fol}L)` : 'N/A';

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header">
      <div class="modal-player-name">${m.name}</div>
      <div class="modal-meta">
        <span class="pos-badge ${posCls(m.favoritePosition)}" style="font-size:0.8rem;padding:3px 8px">${posLabel(m.favoritePosition)}</span>
        <span>GP: ${m.gp}</span>
        <span>Record: ${w}-${l}-${o}</span>
        <span>Win%: ${m.winpct}%</span>
      </div>
    </div>

    <div class="modal-big-stats">
      <div class="modal-big-stat"><div class="val">${m.goals}</div><div class="lbl">Goals</div></div>
      <div class="modal-big-stat"><div class="val">${m.assists}</div><div class="lbl">Assists</div></div>
      <div class="modal-big-stat"><div class="val">${m.points}</div><div class="lbl">Points</div></div>
      <div class="modal-big-stat"><div class="val gold">${parseFloat(m.pointspg).toFixed(1)}</div><div class="lbl">Pts / GP</div></div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Scoring</div>
      <div class="modal-stat-grid">
        ${statRow('+/-', plusMinus(m.plusmin), pmCls)}
        ${statRow('GWG', m.gwg)}
        ${statRow('PPG', m.ppg)}
        ${statRow('SHG', m.shg)}
        ${statRow('Hat Tricks', m.hattricks)}
        ${statRow('Pen. Shot G', m.penaltyshotgoals)}
        ${statRow('Pen. Shot%', m.penaltyshotpct + '%')}
        ${statRow('TOI', minSec(m.toi))}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Shooting</div>
      <div class="modal-stat-grid">
        ${statRow('Shots on Goal', m.shots)}
        ${statRow('Shot Attempts', m.shotattempts)}
        ${statRow('Shot%', parseFloat(m.shotpct).toFixed(1) + '%')}
        ${statRow('On Net%', parseFloat(m.shotonnetpct).toFixed(1) + '%')}
        ${statRow('SOG / GP', parseFloat(m.shotspg).toFixed(1))}
        ${statRow('Breakaways', m.breakaways)}
        ${statRow('Brk Goals', m.brkgoals)}
        ${statRow('Brk%', parseFloat(m.breakawaypct).toFixed(1) + '%')}
        ${statRow('Deflections', m.deflections)}
        ${statRow('Screen Ch.', m.scrnchances)}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Passing & Puck Control</div>
      <div class="modal-stat-grid">
        ${statRow('Passes', n(m.passes))}
        ${statRow('Pass Attempts', n(m.passattempts))}
        ${statRow('Pass%', parseFloat(m.passpct).toFixed(1) + '%')}
        ${statRow('Saucer Passes', m.saucerpasses)}
        ${statRow('Dekes', m.dekes)}
        ${statRow('Dekes Made', m.dekesmade)}
        ${statRow('Giveaways', n(m.giveaways))}
        ${statRow('Takeaways', m.takeaways)}
        ${statRow('Possession', n(m.possession) + 's')}
        ${statRow('Interceptions', m.interceptions)}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Defence</div>
      <div class="modal-stat-grid">
        ${statRow('Hits', n(m.hits))}
        ${statRow('Hits / GP', parseFloat(m.hitspg).toFixed(1))}
        ${statRow('Blocked Shots', m.bs)}
        ${statRow('PK Clears', m.pkclearzone)}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Special Teams & Faceoffs</div>
      <div class="modal-stat-grid">
        ${statRow('Faceoff%', foPct)}
        ${statRow('Pen. Drawn', m.penaltiesdrawn)}
        ${statRow('PP Goals', m.ppg)}
        ${statRow('SH Goals', m.shg)}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Discipline</div>
      <div class="modal-stat-grid">
        ${statRow('PIM', m.pim)}
        ${statRow('Offsides', m.offsides)}
        ${statRow('Off. / GP', parseFloat(m.offsidespg).toFixed(1))}
        ${statRow('Fights', m.fights)}
        ${statRow('Fights Won', m.fightswon)}
        ${statRow('DNF', m.DNF)}
        ${statRow('Disconnects', m.playerQuitDisc)}
      </div>
    </div>
  `;

  document.getElementById('playerModal').classList.remove('hidden');
}

function statRow(label, value, cls = '') {
  return `<div class="modal-stat-row"><span class="sl">${label}</span><span class="sv ${cls}">${value ?? '—'}</span></div>`;
}

function closeModal() {
  document.getElementById('playerModal').classList.add('hidden');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

document.querySelectorAll('.group-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.group-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentGroup = btn.dataset.group;
    sortCol = null;
    renderTable();
  });
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('playerModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Init ──────────────────────────────────────────────────────────────────────
loadData();
