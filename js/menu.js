import { loadSettings, getSettings, setSensitivity, setInvertY } from './settings.js';

let onStartGame = null;

export function initMenu(startGameCallback) {
  onStartGame = startGameCallback;
  loadSettings();
  bindMenuEvents();
  syncSettingsUI();
}

function bindMenuEvents() {
  // Navigation — also wired in index.html inline script as fallback
  document.getElementById('btn-play')?.addEventListener('click', () => showScreen('map-select'));
  document.getElementById('btn-settings')?.addEventListener('click', () => showScreen('settings-menu'));
  document.getElementById('btn-back-main')?.addEventListener('click', () => showScreen('main-menu'));
  document.getElementById('btn-back-settings')?.addEventListener('click', () => showScreen('main-menu'));
  document.getElementById('btn-start-game')?.addEventListener('click', () => onStartGame?.());

  const sensSlider = document.getElementById('sens-slider');
  const sensInput = document.getElementById('sens-input');

  sensSlider?.addEventListener('input', () => {
    setSensitivity(parseFloat(sensSlider.value));
    syncSettingsUI();
  });

  sensInput?.addEventListener('input', () => {
    setSensitivity(parseFloat(sensInput.value));
    syncSettingsUI();
  });

  sensInput?.addEventListener('change', () => {
    setSensitivity(parseFloat(sensInput.value));
    syncSettingsUI();
  });

  sensInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      setSensitivity(parseFloat(sensInput.value));
      syncSettingsUI();
      sensInput.blur();
    }
  });

  document.getElementById('invert-y')?.addEventListener('change', (e) => {
    setInvertY(e.target.checked);
  });
}

function syncSettingsUI() {
  const s = getSettings();
  const slider = document.getElementById('sens-slider');
  const input = document.getElementById('sens-input');
  if (slider) slider.value = s.sensitivity;
  if (input) input.value = s.sensitivity.toFixed(3);
  const invert = document.getElementById('invert-y');
  if (invert) invert.checked = s.invertY;
}

export function showScreen(id) {
  if (window.__showScreen) window.__showScreen(id);
  else {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  }
}

export function getSelectedMap() {
  const card = document.querySelector('.map-card.selected');
  return card?.dataset.map || 'haven-lite';
}
