import { WEAPONS, ARMOR, BUY_CATEGORIES, getWeapon, getReloadTime } from './weapons.js';

let buyMenuOpen = false;
let onBuyCallback = null;
let currentPlayer = null;

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
}

export function toggleBuyMenu(player) {
  buyMenuOpen = !buyMenuOpen;
  currentPlayer = player;
  const menu = document.getElementById('buy-menu');
  if (buyMenuOpen) {
    menu.classList.remove('hidden');
    document.exitPointerLock?.();
    renderBuyMenu(player);
  } else {
    menu.classList.add('hidden');
  }
  return buyMenuOpen;
}

export function isBuyMenuOpen() {
  return buyMenuOpen;
}

export function closeBuyMenu() {
  buyMenuOpen = false;
  document.getElementById('buy-menu').classList.add('hidden');
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
  if (armorEl) {
    armorEl.textContent = armor > 0 ? `${Math.ceil(armor)} HP` : 'None';
  }

  const container = document.getElementById('buy-sections');
  if (!container) return;
  container.innerHTML = '';

  for (const [cat, items] of Object.entries(BUY_CATEGORIES)) {
    const section = document.createElement('div');
    section.className = 'buy-section';

    const head = document.createElement('div');
    head.className = 'buy-section-head';
    head.innerHTML = `
      <h3>${CATEGORY_LABELS[cat] || cat.toUpperCase()}</h3>
      <span class="buy-section-hint">${CATEGORY_HINTS[cat] || ''}</span>
    `;
    section.appendChild(head);

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
    const cantAfford = credits < a.price;

    el.className = 'buy-item' + (cantAfford ? ' disabled' : '') + (owned ? ' owned' : '');
    el.innerHTML = `
      <div class="buy-item-header">
        <span class="buy-item-name">${a.name}</span>
        <span class="buy-item-price">₵ ${a.price}</span>
      </div>
      <div class="buy-item-damage armor-stats">
        <span class="dmg-stat"><b>+${a.hp}</b> shield HP</span>
        <span class="dmg-stat">66% damage absorbed</span>
      </div>
      <div class="buy-item-details">
        <span>${itemId === 'heavy' ? 'Full protection' : 'Light protection'}</span>
        <span>Does not regenerate</span>
      </div>
      ${owned ? '<span class="buy-item-badge">ACTIVE</span>' : ''}
    `;
  } else {
    const w = getWeapon(itemId);
    const isSidearm = w.category === 'sidearms';
    const owned = isSidearm ? loadout.secondary === itemId : loadout.primary === itemId;
    const cantAfford = credits < w.price;
    const reload = getReloadTime(itemId);

    el.className = 'buy-item' + (cantAfford ? ' disabled' : '') + (owned ? ' owned' : '');
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
        <span>${w.magSize} / ${w.reserve} ammo</span>
        <span>${reload.toFixed(1)}s reload</span>
        <span>${w.runSpeed?.toFixed(2) ?? '5.40'} m/s run</span>
      </div>
      <div class="buy-item-tags">
        ${w.scope ? '<span class="wtag">Scoped</span>' : ''}
        ${w.silenced ? '<span class="wtag">Silenced</span>' : ''}
        ${w.range ? `<span class="wtag">${w.range}m range</span>` : ''}
        <span class="wtag">${isSidearm ? 'Slot 2' : 'Slot 1'}</span>
      </div>
      ${owned ? '<span class="buy-item-badge">EQUIPPED</span>' : ''}
    `;
  }

  el.addEventListener('click', () => {
    if (el.classList.contains('disabled')) return;
    if (cat === 'armor') {
      onBuyCallback?.({ type: 'armor', id: itemId, price: ARMOR[itemId].price });
    } else {
      onBuyCallback?.({ type: 'weapon', id: itemId, price: getWeapon(itemId).price });
    }
    renderBuyMenu(currentPlayer);
  });

  return el;
}
