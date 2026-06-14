import { loadSettings, getSettings, setSensitivity, setFov, setInvertY, degreesPerPixel } from './settings.js';
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
  sensSlider.addEventListener('input', () => {
    setSensitivity(parseFloat(sensSlider.value));
    syncSettingsUI();
  });

  const fovSlider = document.getElementById('fov-slider');
  fovSlider.addEventListener('input', () => {
    setFov(parseInt(fovSlider.value));
    syncSettingsUI();
  });

  document.getElementById('invert-y').addEventListener('change', (e) => {
    setInvertY(e.target.checked);
  });
}

function syncSettingsUI() {
  const s = getSettings();
  document.getElementById('sens-slider').value = s.sensitivity;
  document.getElementById('sens-value').textContent = s.sensitivity.toFixed(2);
  document.getElementById('fov-slider').value = s.fov;
  document.getElementById('fov-value').textContent = s.fov;
  document.getElementById('invert-y').checked = s.invertY;
}

export function getSelectedMap() {
  const card = document.querySelector('.map-card.selected');
  return card?.dataset.map || 'haven-lite';
}
