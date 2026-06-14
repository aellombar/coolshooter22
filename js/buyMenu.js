import { WEAPONS, ARMOR, BUY_CATEGORIES, getWeapon } from './weapons.js';

let buyMenuOpen = false;
let activeCategory = 'sidearms';
let onBuyCallback = null;

export function initBuyMenu(onBuy) {
  onBuyCallback = onBuy;

  document.querySelectorAll('.buy-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.buy-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.cat;
      renderBuyGrid();
    });
  });

  renderBuyGrid();
}

export function toggleBuyMenu(player) {
  buyMenuOpen = !buyMenuOpen;
  const menu = document.getElementById('buy-menu');
  if (buyMenuOpen) {
    menu.classList.remove('hidden');
    document.exitPointerLock?.();
    renderBuyGrid(player);
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

function renderBuyGrid(player) {
  const grid = document.getElementById('buy-grid');
  grid.innerHTML = '';
  const credits = player?.credits ?? 800;
  document.getElementById('buy-credits').textContent = credits;

  const items = BUY_CATEGORIES[activeCategory] || [];

  for (const itemId of items) {
    let name, price, desc;

    if (activeCategory === 'armor') {
      const armor = ARMOR[itemId];
      name = armor.name;
      price = armor.price;
      desc = `+${armor.hp} HP shield`;
    } else {
      const w = getWeapon(itemId);
      name = w.name;
      price = w.price;
      desc = `${w.damage.body}/${w.damage.head} dmg · ${w.magSize} mag`;
    }

    const el = document.createElement('div');
    el.className = 'buy-item' + (credits < price ? ' disabled' : '');
    el.innerHTML = `<div class="name">${name}</div><div class="price">₵${price}</div><div class="desc">${desc}</div>`;
    el.addEventListener('click', () => {
      if (credits < price) return;
      if (activeCategory === 'armor') {
        onBuyCallback?.({ type: 'armor', id: itemId, price });
      } else {
        onBuyCallback?.({ type: 'weapon', id: itemId, price });
      }
      renderBuyGrid(player);
    });
    grid.appendChild(el);
  }
}

export function updateBuyCredits(credits) {
  const el = document.getElementById('buy-credits');
  if (el) el.textContent = credits;
}
