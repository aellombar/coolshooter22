import * as THREE from 'three';
import { buildMap } from './map.js';
import { Player, raycastHit, raycastPlayer, createBulletTracer, createHitMarker } from './player.js';
import { createBotTeam, addKillFeed } from './bots.js';
import { applyValorantFov, horizontalToVerticalFov, VALORANT_H_FOV } from './settings.js';
import { toggleBuyMenu, isBuyMenuOpen, closeBuyMenu, openBuyMenu, initBuyMenu, updateBuyCredits, setBuyAllowed } from './buyMenu.js';
import { getWeaponDamage } from './weapons.js';
import { audio } from './audio.js';
import { BulletDecalManager, raycastWallHit } from './bulletDecals.js';
import { MatchStats } from './stats.js';
import { initScoreboard, showScoreboard, updateScoreboard, updateTimerHUD, isScoreboardOpen } from './scoreboard.js';

const BUY_TIME = 30;
const ROUND_TIME = 100;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.round = 1;
    this.attackScore = 0;
    this.defendScore = 0;
    this.roundPhase = 'buy';
    this.buyTimer = BUY_TIME;
    this.roundTimer = ROUND_TIME;
    this.spikePlanted = false;
    this.stats = new MatchStats();
    this._roundTransitionTimer = null;

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

    this.clock = new THREE.Clock();
    initScoreboard();
    this._bindResize();
  }

  _clearRoundTransitionTimer() {
    if (this._roundTransitionTimer != null) {
      clearTimeout(this._roundTransitionTimer);
      this._roundTransitionTimer = null;
    }
  }

  start() {
    this.running = false;
    this._clearRoundTransitionTimer();

    if (this.player?.viewModel?.group) {
      this.camera.remove(this.player.viewModel.group);
    }

    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);

    const mapData = buildMap(this.scene);
    this.colliders = mapData.colliders;
    this.wallMeshes = mapData.wallMeshes;
    this.plantSites = mapData.plantSites;
    this.spawnPoint = mapData.spawnPoint;
    this.defenderSpawns = mapData.defenderSpawns;
    this.buyBarrierMesh = mapData.buyBarrierMesh;
    this.buyBarrierCollider = mapData.buyBarrierCollider;
    this.spawnBounds = mapData.spawnBounds;

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

    this.scene.add(this.camera);

    this.bots = createBotTeam(this.scene, this.colliders, this.defenderSpawns);
    this.decalManager = new BulletDecalManager(this.scene);

    this.stats.reset();
    this.stats.initBots(this.bots);

    initBuyMenu((purchase) => this._handlePurchase(purchase));

    this.round = 1;
    this.attackScore = 0;
    this.defendScore = 0;
    this._startBuyPhase();

    audio.unlock();

    this._updateHUD();
    this.running = true;
    if (!this._loopBound) this._loopBound = this._loop.bind(this);
    requestAnimationFrame(this._loopBound);

    this.camera.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
  }

  _startBuyPhase() {
    this.roundPhase = 'buy';
    this.buyTimer = BUY_TIME;
    this.spikePlanted = false;
    if (this.buyBarrierMesh) this.buyBarrierMesh.visible = true;
    setBuyAllowed(true);
    openBuyMenu(this.player);
    this._showOverlay(`ROUND ${this.round} — BUY PHASE (${BUY_TIME}s) · Stay in spawn`, 3500);
  }

  _endBuyPhase() {
    if (this.roundPhase !== 'buy') return;
    this.roundPhase = 'combat';
    this.roundTimer = ROUND_TIME;
    if (this.buyBarrierMesh) this.buyBarrierMesh.visible = false;
    setBuyAllowed(false);
    closeBuyMenu();
    this._showOverlay('FIGHT!', 1500);
  }

  canBuy() {
    return this.roundPhase === 'buy' && this._isInBuyZone();
  }

  _isInBuyZone() {
    if (!this.player || !this.spawnBounds) return false;
    const p = this.player.position;
    const b = this.spawnBounds;
    return p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
  }

  _getActiveColliders() {
    const c = [...this.colliders];
    if (this.roundPhase === 'buy' && this.buyBarrierCollider) {
      c.push(this.buyBarrierCollider);
    }
    return c;
  }

  _clampToSpawn() {
    if (this.roundPhase !== 'buy' || !this.spawnBounds) return;
    const b = this.spawnBounds;
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, b.minX, b.maxX);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, b.minZ, b.maxZ);
  }

  stop() {
    this.running = false;
    this._clearRoundTransitionTimer();
    document.exitPointerLock?.();
    showScoreboard(false);
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(this._loopBound);

    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.roundPhase === 'buy') {
      this.buyTimer -= dt;
      if (this.buyTimer <= 0) this._endBuyPhase();
    } else if (this.roundPhase === 'combat') {
      this.roundTimer -= dt;
      const allBotsDead = this.bots?.every(b => !b.alive);
      if (allBotsDead) {
        this._endRound('attackers');
      } else if (this.roundTimer <= 0) {
        this._endRound('defenders');
      }
    }

    if (this.player) {
      this.player.update(dt, this.plantSites, {
        colliders: this._getActiveColliders(),
        movementLocked: false,
        canShoot: this.roundPhase === 'combat',
      });
      this._clampToSpawn();
      setBuyAllowed(this.canBuy());
    }

    const livingBots = (this.bots ?? []).filter(b => b.alive);
    livingBots.sort((a, b) =>
      a.position.distanceTo(this.player.position) - b.position.distanceTo(this.player.position)
    );
    const closestId = livingBots[0]?.id;

    for (const bot of this.bots ?? []) {
      if (this.roundPhase !== 'combat') continue;
      const priority = bot.id === closestId ? 0 : 1;
      const shot = bot.update(dt, this.player, this.colliders, priority);
      if (shot) this._handleBotShot(shot);
    }

    if (this.player && !this.player.alive && this.roundPhase === 'combat') {
      this._endRound('defenders');
    }

    this._updateHUD();
    updateTimerHUD(this);
    updateScoreboard(this);
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
    if (this.roundPhase !== 'combat') return;

    const maxDist = Math.max(120, (weaponDef.range ?? 50) * 4);
    const hit = raycastHit(hitOrigin, direction, this.bots, maxDist, this.wallMeshes ?? []);
    const wallHit = raycastWallHit(hitOrigin, direction, this.wallMeshes ?? [], maxDist);
    const hitPoint = hit ? hit.hit.point : (wallHit ? wallHit.point : null);
    createBulletTracer(this.scene, muzzle, direction, maxDist, hitPoint);

    if (wallHit && (!hit || wallHit.distance <= hit.distance)) {
      this.decalManager?.add(wallHit.point, wallHit.normal);
    }

    if (hit) {
      const dmg = getWeaponDamage(weaponDef, hit.hitZone);
      this.stats.recordPlayerHit(dmg, hit.hitZone);
      hit.target.takeDamage(dmg, hit.hitZone);
      createHitMarker();

      if (!hit.target.alive) {
        this.player.credits += 200;
        this.stats.recordPlayerKill(hit.target.id, hit.target.name);
        addKillFeed('You', hit.target.name, weaponDef.name);
      }
    }
  }

  _handleBotShot(shot) {
    if (!this.player.alive || this.roundPhase !== 'combat') return;

    const hit = raycastPlayer(shot.origin, shot.direction, this.player, 50);
    if (!hit) return;

    const dmg = getWeaponDamage(shot.weaponDef, hit.hitZone);
    this.stats.recordPlayerDamageTaken(dmg);
    this.player.takeDamage(dmg, hit.hitZone);

    if (!this.player.alive) {
      this.stats.recordPlayerDeath(shot.shooter.name);
      addKillFeed(shot.shooter.name, 'You', shot.weaponDef.name);
    }
  }

  _handlePlant(site) {
    this.spikePlanted = true;
    this.player.roundSpikePlanted = true;
    this._showOverlay(`SPIKE PLANTED AT ${site.label}`, 2000);
    this.roundTimer = Math.min(this.roundTimer, 45);
  }

  _handlePurchase(purchase) {
    if (!this.canBuy()) {
      this._showOverlay('Buy only in spawn during buy phase', 2000);
      return;
    }
    if (purchase.type === 'weapon') {
      if (this.player.buyWeapon(purchase.id)) updateBuyCredits(this.player.credits);
    } else if (purchase.type === 'armor') {
      if (this.player.buyArmor(purchase.id)) updateBuyCredits(this.player.credits);
    } else if (purchase.type === 'sell') {
      if (this.player.sellWeapon(purchase.slot)) {
        updateBuyCredits(this.player.credits);
        this._showOverlay('Weapon sold', 1200);
      }
    }
  }

  _endRound(winner) {
    if (this.roundPhase === 'ended') return;
    this.roundPhase = 'ended';

    if (winner === 'attackers') {
      this.attackScore++;
      this.stats.recordRoundWin();
      this.player.credits += 3000;
      this._showOverlay('ROUND WON', 3000);
    } else {
      this.defendScore++;
      this.stats.recordRoundLoss();
      this.player.credits += 1900;
      this._showOverlay('ROUND LOST', 3000);
    }

    this._clearRoundTransitionTimer();
    this._roundTransitionTimer = setTimeout(() => {
      this._roundTransitionTimer = null;
      this._newRound();
    }, 3500);
  }

  _newRound() {
    if (!this.running) return;
    this.round++;
    this.spikePlanted = false;

    this.player.spawn(this.spawnPoint);
    this.player.credits = Math.min(this.player.credits, 9000);
    this.player.hasSpike = true;
    this.player.roundSpikePlanted = false;

    for (let i = 0; i < this.bots.length; i++) {
      this.bots[i].spawn(this.defenderSpawns[i]);
      this.stats.bots[i].alive = true;
    }

    this._startBuyPhase();
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

  toggleScoreboard(show) {
    showScoreboard(show);
    if (show) {
      document.exitPointerLock?.();
      updateScoreboard(this);
    }
  }

  onKeyDown(code) {
    if (code === 'Tab') {
      this.toggleScoreboard(true);
      return;
    }
    if (code === 'KeyB') {
      if (!this.canBuy()) {
        this._showOverlay('Buy only in spawn during buy phase', 2000);
        return;
      }
      toggleBuyMenu(this.player);
    }
    if (code === 'Escape') {
      if (isBuyMenuOpen()) closeBuyMenu();
      else showScoreboard(false);
    }
  }

  onKeyUp(code) {
    if (code === 'Tab') showScoreboard(false);
  }

  requestPointerLock() {
    if (!isBuyMenuOpen() && !isScoreboardOpen()) {
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

export { isScoreboardOpen } from './scoreboard.js';
