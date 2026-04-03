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

// ── Data ─────────────────────────────────────────────────────────────────────

let members = [];
let sortCol = null;
let sortDir = 1; // 1 = desc, -1 = asc
let currentGroup = 'scoring';

async function loadData() {
  try {
    const res = await fetch('/api/members/stats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    members = data.members || [];
    renderAll();
  } catch (err) {
    document.getElementById('error-banner').classList.remove('hidden');
    document.getElementById('error-text').textContent =
      'Could not load stats from EA servers: ' + err.message;
    // Clear loading states
    ['teamRecord','teamOffense','teamDefense','leadersGrid','statsTableBody','cardsGrid']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p style="color:var(--muted);padding:10px 0">No data available.</p>';
      });
  }
}

function renderAll() {
  renderHeader();
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
      <div class="summary-row"><span class="label">Total Goals</span><span class="value accent">${totG}</span></div>
      <div class="summary-row"><span class="label">Total Assists</span><span class="value">${totA}</span></div>
      <div class="summary-row"><span class="label">Total Points</span><span class="value accent">${totG + totA}</span></div>
      <div class="summary-row"><span class="label">Power Play Goals</span><span class="value">${totPP}</span></div>
      <div class="summary-row"><span class="label">Short-Handed Goals</span><span class="value gold">${totSH}</span></div>
      <div class="summary-row"><span class="label">Game-Winning Goals</span><span class="value">${totGWG}</span></div>
      <div class="summary-row"><span class="label">Hat Tricks</span><span class="value gold">${totHT}</span></div>
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
      <div class="summary-row"><span class="label">Total Hits</span><span class="value accent">${totHits.toLocaleString()}</span></div>
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
        <div class="leader-pos-badge ${posCls(leader.favoritePosition)}">${posLabel(leader.favoritePosition)}</div>
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
            <div class="pc-pos">${posLabel(m.favoritePosition)} · PS5</div>
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
        <span>Platform: PS5</span>
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
