import { formatTime } from './stats.js';

let visible = false;

export function initScoreboard() {
  const el = document.getElementById('scoreboard');
  if (el) el.classList.add('hidden');
}

export function showScoreboard(show) {
  visible = show;
  const el = document.getElementById('scoreboard');
  if (el) el.classList.toggle('hidden', !show);
}

export function isScoreboardOpen() {
  return visible;
}

export function updateScoreboard(game) {
  if (!visible || !game?.stats) return;

  const rows = game.stats.getScoreboardRows();
  document.getElementById('sb-attack-score').textContent = game.attackScore ?? 0;
  document.getElementById('sb-defend-score').textContent = game.defendScore ?? 0;
  document.getElementById('sb-round').textContent = game.round ?? 1;

  const tbody = document.getElementById('sb-rows');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.className = row.team === 'attack' ? 'team-attack' : 'team-defend';
    if (row.alive === false) tr.classList.add('dead');
    tr.innerHTML = `
      <td class="sb-name">${row.name}</td>
      <td>${row.kills}</td>
      <td>${row.deaths}</td>
      <td>${row.assists ?? 0}</td>
      <td>${row.kda}</td>
      <td>${row.damageDealt ?? 0}</td>
      <td>${row.acs ?? 0}</td>
    `;
    tbody.appendChild(tr);
  }

  const p = game.stats.player;
  document.getElementById('sb-player-k').textContent = p.kills;
  document.getElementById('sb-player-d').textContent = p.deaths;
  document.getElementById('sb-player-hs').textContent = p.headshots;
  document.getElementById('sb-player-dmg').textContent = p.damageDealt;
  document.getElementById('sb-wins').textContent = game.stats.roundsWon;
  document.getElementById('sb-losses').textContent = game.stats.roundsLost;
}

export function updateTimerHUD(game) {
  const phaseEl = document.getElementById('phase-label');
  const timerEl = document.getElementById('round-timer');
  if (!phaseEl || !timerEl || !game) return;

  if (game.roundPhase === 'buy') {
    phaseEl.textContent = 'BUY PHASE';
    phaseEl.className = 'phase-label buy';
    timerEl.textContent = formatTime(game.buyTimer);
  } else if (game.roundPhase === 'combat') {
    phaseEl.textContent = game.spikePlanted ? 'SPIKE PLANTED' : 'ROUND';
    phaseEl.className = 'phase-label combat' + (game.spikePlanted ? ' planted' : '');
    timerEl.textContent = formatTime(game.roundTimer);
  } else {
    phaseEl.textContent = 'ROUND END';
    phaseEl.className = 'phase-label ended';
    timerEl.textContent = '—';
  }
}
