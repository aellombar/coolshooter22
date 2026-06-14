import { initMenu } from './menu.js';
import { Game, showHUD } from './game.js';
import { isBuyMenuOpen, closeBuyMenu } from './buyMenu.js';
import { audio } from './audio.js';

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
    if (game?.running) game.onKeyDown(e.code);
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener('mousemove', (e) => {
    if (pointerLocked && game?.running && game.player?.alive && !isBuyMenuOpen()) {
      game.player.onMouseMove(e.movementX, e.movementY);
    }
  });
}

function onCanvasClick() {
  if (game?.running && !isBuyMenuOpen()) {
    audio.unlock();
    game.requestPointerLock();
  }
}

init();
