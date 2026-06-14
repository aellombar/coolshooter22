import { initMenu } from './menu.js';
import { Game, showHUD } from './game.js';
import { getSettings } from './settings.js';
import { isBuyMenuOpen, closeBuyMenu } from './buyMenu.js';

let game = null;
let pointerLocked = false;

function init() {
  const canvas = document.getElementById('game-canvas');
  game = new Game(canvas);

  initMenu(() => {
    game.start();
    canvas.addEventListener('click', onCanvasClick);
  });

  document.addEventListener('keydown', (e) => {
    if (game?.running) {
      game.onKeyDown(e.code);
    }
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener('mousemove', (e) => {
    if (pointerLocked && game?.running && game.player?.alive && !isBuyMenuOpen()) {
      game.player.onMouseMove(e.movementX, e.movementY);
    }
  });

  // Apply saved FOV
  const settings = getSettings();
  game.updateFov(settings.fov);
}

function onCanvasClick() {
  if (game?.running && !isBuyMenuOpen()) {
    game.requestPointerLock();
  }
}

init();
