import * as THREE from 'three';
import { buildMap } from './map.js';
import { Player, raycastHit, createBulletTracer, createHitMarker } from './player.js';
import { createBotTeam, addKillFeed } from './bots.js';
import { applyValorantFov, horizontalToVerticalFov, VALORANT_H_FOV } from './settings.js';
import { toggleBuyMenu, isBuyMenuOpen, closeBuyMenu, initBuyMenu, updateBuyCredits } from './buyMenu.js';
import { audio } from './audio.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.round = 1;
    this.attackScore = 0;
    this.defendScore = 0;
    this.roundPhase = 'buy';
    this.roundTimer = 100;
    this.spikePlanted = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x8aa8c8, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8aa8c8);
    this.scene.fog = new THREE.Fog(0xa8c0d8, 80, 140);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 200);
    applyValorantFov(this.camera);
    this._targetVFov = this.camera.fov;
    this._scopeFovBlend = 0;

    this.clock = new THREE.Clock();
    this._bindResize();
  }

  start() {
    this.running = false;

    // Remove old player view-model from camera
    if (this.player?.viewModel?.group) {
      this.camera.remove(this.player.viewModel.group);
    }

    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);

    const mapData = buildMap(this.scene);
    this.colliders = mapData.colliders;
    this.plantSites = mapData.plantSites;
    this.spawnPoint = mapData.spawnPoint;
    this.defenderSpawns = mapData.defenderSpawns;

    this.player = new Player(
      this.camera,
      this.scene,
      this.colliders,
      (shot) => this._handlePlayerShot(shot),
    );
    this.player.onPlant = (site) => this._handlePlant(site);
    this.player.onScopeChange = (scoped, weaponDef) => this._onScopeChange(scoped, weaponDef);
    this.player.spawn(this.spawnPoint);
    this.player.credits = 800;

    // Camera must be in scene graph for rendering
    this.scene.add(this.camera);

    this.bots = createBotTeam(this.scene, this.colliders, this.defenderSpawns);

    initBuyMenu((purchase) => this._handlePurchase(purchase));

    this.roundPhase = 'buy';
    this.roundTimer = 100;
    this.spikePlanted = false;
    this.round = 1;
    this._targetVFov = horizontalToVerticalFov(VALORANT_H_FOV, this.camera.aspect);
    applyValorantFov(this.camera, this.camera.aspect);

    audio.unlock();

    this._updateHUD();
    this._showOverlay('ROUND 1 — BUY PHASE', 2500);
    setTimeout(() => { this.roundPhase = 'combat'; }, 3000);

    this.running = true;
    if (!this._loopBound) this._loopBound = this._loop.bind(this);
    requestAnimationFrame(this._loopBound);

    // Draw first frame immediately
    this.camera.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
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

    if (this.player) {
      this.player.update(dt, this.plantSites);
    }

    for (const bot of this.bots ?? []) {
      const shot = bot.update(dt, this.player, this.colliders);
      if (shot) this._handleBotShot(shot);
    }

    if (this.bots?.every(b => !b.alive) && this.roundPhase === 'combat') {
      this._endRound('attackers');
    }

    if (this.player && !this.player.alive && this.roundPhase === 'combat') {
      this._endRound('defenders');
    }

    this._updateHUD();
    this._updateScopedFov(dt);

    this.camera.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
  }

  _onScopeChange(scoped, weaponDef) {
    if (scoped && weaponDef.scopeHFov) {
      this._targetVFov = horizontalToVerticalFov(weaponDef.scopeHFov, this.camera.aspect);
    } else {
      this._targetVFov = horizontalToVerticalFov(VALORANT_H_FOV, this.camera.aspect);
    }
  }

  _updateScopedFov(dt) {
    const target = this._targetVFov ?? this.camera.fov;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, target, dt * 14);
    this.camera.updateProjectionMatrix();
  }

  _handlePlayerShot({ hitOrigin, muzzle, direction, weaponDef }) {
    const hit = raycastHit(hitOrigin, direction, this.bots);
    const hitPoint = hit ? hit.hit.point : null;
    createBulletTracer(this.scene, muzzle, direction, 100, hitPoint);

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
    if (!this.player) return;
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
      if (isBuyMenuOpen()) closeBuyMenu();
    }
  }

  requestPointerLock() {
    if (!isBuyMenuOpen()) {
      audio.unlock();
      this.canvas.requestPointerLock();
    }
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      this.camera.aspect = aspect;
      applyValorantFov(this.camera, aspect);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
}

export function showHUD(show) {
  document.getElementById('hud').classList.toggle('hidden', !show);
}

export function setCanvasInteractive(on) {
  document.getElementById('game-canvas')?.classList.toggle('interactive', on);
}

export function hideAllMenus() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}
