import { initMenu } from './menu.js';

let game = null;
let pointerLocked = false;
let gameModule = null;
let buyMenuModule = null;
let audioModule = null;

// Menu binds immediately — no Three.js dependency
window.__startGame = startGame;
initMenu(startGame);

document.addEventListener('keydown', (e) => {
  if (game?.running) {
    if (e.code === 'Tab') e.preventDefault();
    game.onKeyDown(e.code);
  }
});

document.addEventListener('keyup', (e) => {
  if (game?.running) game.onKeyUp?.(e.code);
});

document.addEventListener('pointerlockchange', () => {
  const canvas = document.getElementById('game-canvas');
  pointerLocked = document.pointerLockElement === canvas;
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || !game?.running || !game.player?.alive) return;
  if (buyMenuModule?.isBuyMenuOpen()) return;
  if (gameModule?.isScoreboardOpen?.()) return;
  game.player.onMouseMove(e.movementX, e.movementY);
});

async function loadGameModules() {
  if (!gameModule) {
    [gameModule, buyMenuModule, audioModule] = await Promise.all([
      import('./game.js'),
      import('./buyMenu.js'),
      import('./audio.js'),
    ]);
  }
  return { gameModule, buyMenuModule, audioModule };
}

async function startGame() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('hud')?.classList.remove('hidden');

  try {
    const { gameModule: gm, audioModule: am } = await loadGameModules();
    const canvas = document.getElementById('game-canvas');

    if (!game) {
      game = new gm.Game(canvas);
      canvas.addEventListener('click', () => {
        if (game?.running && !buyMenuModule?.isBuyMenuOpen() && !gm.isScoreboardOpen?.()) {
          am.audio.unlock();
          game.requestPointerLock();
        }
      });
    }

    game.start();
    gm.setCanvasInteractive(true);
  } catch (err) {
    console.error('Failed to start game:', err);
    alert('Could not start game: ' + err.message);
    const gm = gameModule;
    if (gm) gm.setCanvasInteractive(false);
  }
}
