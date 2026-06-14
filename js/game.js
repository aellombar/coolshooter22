import * as THREE from 'three';
import { buildMap, checkLineOfSight } from './map.js';
import { Player, raycastHit, createBulletTracer, createHitMarker } from './player.js';
import { createBotTeam, addKillFeed } from './bots.js';
import { getSettings } from './settings.js';
import { toggleBuyMenu, isBuyMenuOpen, closeBuyMenu, initBuyMenu, updateBuyCredits } from './buyMenu.js';
import { getWeapon } from './weapons.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.round = 1;
    this.attackScore = 0;
    this.defendScore = 0;
    this.roundPhase = 'buy'; // buy, combat, ended
    this.roundTimer = 100;
    this.spikePlanted = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2535);
    this.scene.fog = new THREE.Fog(0x1a2535, 40, 90);

    const settings = getSettings();
    this.camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 200);

    this.clock = new THREE.Clock();
    this._bindResize();
  }

  start() {
    // Clean previous
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);

    const mapData = buildMap(this.scene);
    this.colliders = mapData.colliders;
    this.plantSites = mapData.plantSites;
    this.spawnPoint = mapData.spawnPoint;
    this.defenderSpawns = mapData.defenderSpawns;

    this.player = new Player(
      this.camera,
      this.colliders,
      (origin, dir, weaponDef) => this._handlePlayerShot(origin, dir, weaponDef),
      () => {}
    );
    this.player.onPlant = (site) => this._handlePlant(site);
    this.player.spawn(this.spawnPoint);
    this.player.credits = 800;

    this.bots = createBotTeam(this.scene, this.colliders, this.defenderSpawns);

    initBuyMenu((purchase) => this._handlePurchase(purchase));

    this.running = true;
    this.roundPhase = 'buy';
    this.roundTimer = 100;
    this.spikePlanted = false;
    this.round = 1;

    this._updateHUD();
    this._showOverlay('ROUND 1 — BUY PHASE', 2500);
    setTimeout(() => { this.roundPhase = 'combat'; }, 3000);

    if (!this._loopBound) {
      this._loopBound = this._loop.bind(this);
      requestAnimationFrame(this._loopBound);
    }
  }

  stop() {
    this.running = false;
    document.exitPointerLock?.();
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(this._loopBound);

    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.roundPhase === 'combat') {
      this.roundTimer -= dt;
      if (this.roundTimer <= 0) this._endRound('defenders');
    }

    this.player.update(dt, this.plantSites);

    // Bot updates
    for (const bot of this.bots) {
      const shot = bot.update(dt, this.player, this.colliders);
      if (shot) this._handleBotShot(shot);
    }

    // Check round end — all bots dead
    if (this.bots.every(b => !b.alive) && this.roundPhase === 'combat') {
      this._endRound('attackers');
    }

    // Check player death
    if (!this.player.alive && this.roundPhase === 'combat') {
      this._endRound('defenders');
    }

    this._updateHUD();
    this.renderer.render(this.scene, this.camera);
  }

  _handlePlayerShot(origin, direction, weaponDef) {
    const end = origin.clone().add(direction.clone().multiplyScalar(100));
    createBulletTracer(this.scene, origin, end);

    const hit = raycastHit(origin, direction, this.bots);
    if (hit) {
      const dmg = weaponDef.damage[hit.hitZone] || weaponDef.damage.body;
      hit.target.takeDamage(dmg, hit.hitZone);
      createHitMarker();

      if (!hit.target.alive) {
        this.player.credits += 200;
        addKillFeed('You', hit.target.name, weaponDef.name);
      }
    }
  }

  _handleBotShot(shot) {
    if (!this.player.alive) return;
    const dist = shot.origin.distanceTo(this.player.position);
    if (dist > 40) return;

    const hitChance = Math.max(0.1, 1 - dist / 40);
    if (Math.random() > hitChance) return;

    const hitZone = Math.random() < 0.15 ? 'head' : 'body';
    const dmg = shot.damage[hitZone] || shot.damage.body;
    this.player.takeDamage(dmg * 0.35, hitZone);

    if (!this.player.alive) {
      addKillFeed(shot.shooter.name, 'You', 'Vandal');
    }
  }

  _handlePlant(site) {
    this.spikePlanted = true;
    this._showOverlay(`SPIKE PLANTED AT ${site.label}`, 2000);
    this.roundTimer = Math.min(this.roundTimer, 45);
  }

  _handlePurchase(purchase) {
    if (purchase.type === 'weapon') {
      if (this.player.buyWeapon(purchase.id)) {
        updateBuyCredits(this.player.credits);
      }
    } else if (purchase.type === 'armor') {
      if (this.player.buyArmor(purchase.id)) {
        updateBuyCredits(this.player.credits);
      }
    }
  }

  _endRound(winner) {
    if (this.roundPhase === 'ended') return;
    this.roundPhase = 'ended';

    if (winner === 'attackers') {
      this.attackScore++;
      this.player.credits += 3000;
      this._showOverlay('ROUND WON', 3000);
    } else {
      this.defendScore++;
      this.player.credits += 1900;
      this._showOverlay('ROUND LOST', 3000);
    }

    setTimeout(() => this._newRound(), 3500);
  }

  _newRound() {
    this.round++;
    this.roundPhase = 'buy';
    this.roundTimer = 100;
    this.spikePlanted = false;

    this.player.spawn(this.spawnPoint);
    this.player.credits = Math.min(this.player.credits + 3000, 9000);

    for (let i = 0; i < this.bots.length; i++) {
      this.bots[i].spawn(this.defenderSpawns[i]);
    }

    this._showOverlay(`ROUND ${this.round} — BUY PHASE`, 2500);
    setTimeout(() => { this.roundPhase = 'combat'; }, 3000);
  }

  _updateHUD() {
    document.getElementById('round-num').textContent = this.round;
    document.getElementById('credits').textContent = this.player.credits;
    document.getElementById('weapon-name').textContent = this.player.weapon.def.name;
    document.getElementById('ammo-count').textContent =
      `${this.player.weapon.ammo} / ${this.player.weapon.reserve}`;
    document.getElementById('health-fill').style.width = `${this.player.health}%`;
    document.getElementById('health-text').textContent = Math.ceil(this.player.health);

    document.querySelector('.team-score.attack').textContent = this.attackScore;
    document.querySelector('.team-score.defend').textContent = this.defendScore;
  }

  _showOverlay(text, duration) {
    const overlay = document.getElementById('overlay-msg');
    document.getElementById('overlay-text').textContent = text;
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('hidden'), duration);
  }

  onKeyDown(code) {
    if (code === 'KeyB') {
      if (this.roundPhase === 'buy' || this.roundPhase === 'combat') {
        toggleBuyMenu(this.player);
      }
    }
    if (code === 'Escape') {
      if (isBuyMenuOpen()) {
        closeBuyMenu();
      }
    }
  }

  requestPointerLock() {
    if (!isBuyMenuOpen()) {
      this.canvas.requestPointerLock();
    }
  }

  onPointerLockChange(locked) {
    // handled in main
  }

  updateFov(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
}

export function showHUD(show) {
  document.getElementById('hud').classList.toggle('hidden', !show);
}

export function hideAllMenus() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
