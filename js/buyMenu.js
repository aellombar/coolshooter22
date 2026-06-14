import { WEAPONS, ARMOR, BUY_CATEGORIES, getWeapon } from './weapons.js';

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

function renderBuyMenu(player) {
  const credits = player?.credits ?? 800;
  const loadout = player?.getLoadout?.() ?? { primary: null, secondary: 'classic', active: 'secondary' };

  document.getElementById('buy-credits').textContent = credits;

  const primaryEl = document.getElementById('slot-primary');
  const secondaryEl = document.getElementById('slot-secondary');
  if (primaryEl) {
    primaryEl.textContent = loadout.primary ? getWeapon(loadout.primary).name : '—';
    primaryEl.classList.toggle('active-slot', loadout.active === 'primary');
  }
  if (secondaryEl) {
    secondaryEl.textContent = getWeapon(loadout.secondary).name;
    secondaryEl.classList.toggle('active-slot', loadout.active === 'secondary');
  }

  const container = document.getElementById('buy-sections');
  if (!container) return;
  container.innerHTML = '';

  for (const [cat, items] of Object.entries(BUY_CATEGORIES)) {
    const section = document.createElement('div');
    section.className = 'buy-section';

    const title = document.createElement('h3');
    title.textContent = CATEGORY_LABELS[cat] || cat.toUpperCase();
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'buy-section-grid';

    for (const itemId of items) {
      grid.appendChild(createBuyItem(itemId, cat, credits, loadout));
    }

    section.appendChild(grid);
    container.appendChild(section);
  }
}

function createBuyItem(itemId, cat, credits, loadout) {
  let name, price, tag;

  if (cat === 'armor') {
    const armor = ARMOR[itemId];
    name = armor.name;
    price = armor.price;
    tag = `+${armor.hp} HP`;
  } else {
    const w = getWeapon(itemId);
    name = w.name;
    price = w.price;
    tag = `${w.damage.body} body · ${w.magSize} rnds`;

    const isSidearm = w.category === 'sidearms';
    const owned = isSidearm
      ? loadout.secondary === itemId
      : loadout.primary === itemId;
    if (owned) tag = 'EQUIPPED · ' + tag;
  }

  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'buy-item' + (credits < price ? ' disabled' : '');
  el.innerHTML = `
    <span class="buy-item-name">${name}</span>
    <span class="buy-item-price">₵${price}</span>
    <span class="buy-item-tag">${tag}</span>
  `;

  el.addEventListener('click', () => {
    if (credits < price) return;
    if (cat === 'armor') {
      onBuyCallback?.({ type: 'armor', id: itemId, price });
    } else {
      onBuyCallback?.({ type: 'weapon', id: itemId, price });
    }
    renderBuyMenu(currentPlayer);
  });

  return el;
}
