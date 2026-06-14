import { loadSettings, getSettings, setSensitivity, setInvertY } from './settings.js';
import { showScreen, hideAllMenus, showHUD } from './game.js';

let onStartGame = null;

export function initMenu(startGameCallback) {
  onStartGame = startGameCallback;
  loadSettings();
  bindMenuEvents();
  syncSettingsUI();
}

function bindMenuEvents() {
  document.getElementById('btn-play').addEventListener('click', () => showScreen('map-select'));
  document.getElementById('btn-settings').addEventListener('click', () => showScreen('settings-menu'));
  document.getElementById('btn-back-main').addEventListener('click', () => showScreen('main-menu'));
  document.getElementById('btn-back-settings').addEventListener('click', () => showScreen('main-menu'));
  document.getElementById('btn-start-game').addEventListener('click', () => {
    hideAllMenus();
    showHUD(true);
    onStartGame?.();
  });

  const sensSlider = document.getElementById('sens-slider');
  const sensInput = document.getElementById('sens-input');

  sensSlider.addEventListener('input', () => {
    setSensitivity(parseFloat(sensSlider.value));
    syncSettingsUI();
  });

  sensInput.addEventListener('change', () => {
    setSensitivity(parseFloat(sensInput.value));
    syncSettingsUI();
  });

  sensInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      setSensitivity(parseFloat(sensInput.value));
      syncSettingsUI();
      sensInput.blur();
    }
  });

  document.getElementById('invert-y').addEventListener('change', (e) => {
    setInvertY(e.target.checked);
  });
}

function syncSettingsUI() {
  const s = getSettings();
  document.getElementById('sens-slider').value = s.sensitivity;
  document.getElementById('sens-input').value = s.sensitivity.toFixed(2);
  document.getElementById('invert-y').checked = s.invertY;
}

export function getSelectedMap() {
  const card = document.querySelector('.map-card.selected');
  return card?.dataset.map || 'haven-lite';
}
