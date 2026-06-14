import { WEAPONS, ARMOR, BUY_CATEGORIES, getWeapon, getReloadTime } from './weapons.js';

let buyMenuOpen = false;
let onBuyCallback = null;
let currentPlayer = null;
let buyAllowed = true;

const CATEGORY_LABELS = {
  sidearms: 'SIDEARMS',
  smgs: 'SMGs',
  rifles: 'RIFLES',
  snipers: 'SNIPERS',
  armor: 'SHIELDS',
};

const CATEGORY_HINTS = {
  sidearms: 'Slot [2] · Secondary only',
  smgs: 'Slot [1] · Primary',
  rifles: 'Slot [1] · Primary',
  snipers: 'Slot [1] · Primary',
  armor: 'Replaces current shields',
};

export function initBuyMenu(onBuy) {
  onBuyCallback = onBuy;
  renderBuyMenu(null);
  _bindSellButtons();
}

function _bindSellButtons() {
  document.getElementById('btn-sell-primary')?.addEventListener('click', () => {
    if (!buyAllowed) return;
    onBuyCallback?.({ type: 'sell', slot: 'primary' });
    renderBuyMenu(currentPlayer);
  });
  document.getElementById('btn-sell-secondary')?.addEventListener('click', () => {
    if (!buyAllowed) return;
    onBuyCallback?.({ type: 'sell', slot: 'secondary' });
    renderBuyMenu(currentPlayer);
  });
}

export function setBuyAllowed(allowed) {
  buyAllowed = allowed;
  const notice = document.getElementById('buy-zone-notice');
  if (notice) notice.classList.toggle('hidden', allowed);
  if (buyMenuOpen) renderBuyMenu(currentPlayer);
}

export function openBuyMenu(player) {
  buyMenuOpen = true;
  currentPlayer = player;
  document.getElementById('buy-menu')?.classList.remove('hidden');
  renderBuyMenu(player);
}

export function toggleBuyMenu(player) {
  if (buyMenuOpen) {
    closeBuyMenu();
    return false;
  }
  openBuyMenu(player);
  return true;
}

export function isBuyMenuOpen() {
  return buyMenuOpen;
}

export function closeBuyMenu() {
  buyMenuOpen = false;
  document.getElementById('buy-menu')?.classList.add('hidden');
}

export function updateBuyCredits(credits) {
  const el = document.getElementById('buy-credits');
  if (el) el.textContent = credits;
  if (buyMenuOpen) renderBuyMenu(currentPlayer);
}

function fireModeLabel(w) {
  if (w.boltAction) return 'Bolt';
  if (w.burstCount) return `${w.burstCount}-Burst`;
  if (w.automatic) return 'Auto';
  return 'Semi';
}

function renderBuyMenu(player) {
  const credits = player?.credits ?? 800;
  const loadout = player?.getLoadout?.() ?? { primary: null, secondary: 'classic', active: 'secondary' };
  const armor = player?.armor ?? 0;

  document.getElementById('buy-credits').textContent = credits;

  const primaryEl = document.getElementById('slot-primary');
  const secondaryEl = document.getElementById('slot-secondary');
  const armorEl = document.getElementById('slot-armor');
  if (primaryEl) {
    primaryEl.textContent = loadout.primary ? getWeapon(loadout.primary).name : '—';
    primaryEl.classList.toggle('active-slot', loadout.active === 'primary');
  }
  if (secondaryEl) {
    secondaryEl.textContent = getWeapon(loadout.secondary).name;
    secondaryEl.classList.toggle('active-slot', loadout.active === 'secondary');
  }
  if (armorEl) armorEl.textContent = armor > 0 ? `${Math.ceil(armor)} HP` : 'None';

  const sellPri = document.getElementById('btn-sell-primary');
  const sellSec = document.getElementById('btn-sell-secondary');
  if (sellPri) {
    sellPri.disabled = !loadout.primary || !buyAllowed;
    sellPri.textContent = loadout.primary
      ? `Sell ${getWeapon(loadout.primary).name} (+₵${getWeapon(loadout.primary).price})`
      : 'Sell Primary';
  }
  if (sellSec) {
    const canSellSec = loadout.secondary !== 'classic';
    sellSec.disabled = !canSellSec || !buyAllowed;
    sellSec.textContent = canSellSec
      ? `Sell ${getWeapon(loadout.secondary).name} (+₵${getWeapon(loadout.secondary).price})`
      : 'Sell Secondary';
  }

  const container = document.getElementById('buy-sections');
  if (!container) return;
  container.innerHTML = '';

  if (!buyAllowed) return;

  for (const [cat, items] of Object.entries(BUY_CATEGORIES)) {
    const section = document.createElement('div');
    section.className = 'buy-section';
    section.innerHTML = `
      <div class="buy-section-head">
        <h3>${CATEGORY_LABELS[cat] || cat.toUpperCase()}</h3>
        <span class="buy-section-hint">${CATEGORY_HINTS[cat] || ''}</span>
      </div>
    `;
    const grid = document.createElement('div');
    grid.className = 'buy-section-grid';
    for (const itemId of items) {
      grid.appendChild(createBuyItem(itemId, cat, credits, loadout, armor));
    }
    section.appendChild(grid);
    container.appendChild(section);
  }
}

function createBuyItem(itemId, cat, credits, loadout, playerArmor) {
  const el = document.createElement('button');
  el.type = 'button';

  if (cat === 'armor') {
    const a = ARMOR[itemId];
    const owned = (itemId === 'heavy' && playerArmor >= 50) ||
      (itemId === 'light' && playerArmor >= 25 && playerArmor < 50);
    el.className = 'buy-item' + (credits < a.price ? ' disabled' : '') + (owned ? ' owned' : '');
    el.innerHTML = `
      <div class="buy-item-header">
        <span class="buy-item-name">${a.name}</span>
        <span class="buy-item-price">₵ ${a.price}</span>
      </div>
      <div class="buy-item-damage armor-stats">
        <span class="dmg-stat"><b>+${a.hp}</b> shield HP</span>
      </div>
      ${owned ? '<span class="buy-item-badge">ACTIVE</span>' : ''}
    `;
    el.addEventListener('click', () => {
      if (credits < a.price) return;
      onBuyCallback?.({ type: 'armor', id: itemId });
      renderBuyMenu(currentPlayer);
    });
  } else {
    const w = getWeapon(itemId);
    const isSidearm = w.category === 'sidearms';
    const owned = isSidearm ? loadout.secondary === itemId : loadout.primary === itemId;
    el.className = 'buy-item' + (credits < w.price ? ' disabled' : '') + (owned ? ' owned' : '');
    el.innerHTML = `
      <div class="buy-item-header">
        <span class="buy-item-name">${w.name}</span>
        <span class="buy-item-price">₵ ${w.price}</span>
      </div>
      <div class="buy-item-damage">
        <span class="dmg-stat dmg-body"><b>${w.damage.body}</b> body</span>
        <span class="dmg-stat dmg-head"><b>${w.damage.head}</b> head</span>
        <span class="dmg-stat dmg-leg"><b>${w.damage.leg}</b> leg</span>
      </div>
      <div class="buy-item-details">
        <span>${fireModeLabel(w)} · ${w.fireRate.toFixed(1)} r/s</span>
        <span>${w.magSize}/${w.reserve} · ${getReloadTime(itemId).toFixed(1)}s reload</span>
      </div>
      ${owned ? '<span class="buy-item-badge">EQUIPPED</span>' : ''}
    `;
    el.addEventListener('click', () => {
      if (credits < w.price || owned) return;
      onBuyCallback?.({ type: 'weapon', id: itemId });
      renderBuyMenu(currentPlayer);
    });
  }
  return el;
}
