import * as THREE from 'three';
import { mouseDeltaToYaw, mouseDeltaToPitch, getScopedSensMultiplier } from './settings.js';
import {
  createWeaponState, canFire, fireWeapon, getViewKick, getBulletSpread,
  getCurrentInaccuracy, applyArmorDamage,
  reloadWeapon, getReloadTime, getWeapon,
} from './weapons.js';
import { resolveCollision } from './map.js';
import { ViewModel } from './viewModel.js';
import { audio } from './audio.js';

const GRAVITY = 20;
const JUMP_FORCE = 7;
const WALK_SPEED = 5.4;
const CROUCH_SPEED = 2.74;
const PLAYER_HEIGHT = 1.6;
const PLAYER_CROUCH_HEIGHT = 1.0;

export class Player {
  constructor(camera, scene, colliders, onShoot) {
    this.camera = camera;
    this.scene = scene;
    this.colliders = colliders;
    this.onShoot = onShoot;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;

    this.health = 100;
    this.armor = 0;
    this.alive = true;
    this.credits = 800;

    this.primaryWeapon = null;
    this.secondaryWeapon = createWeaponState('classic');
    this.activeSlot = 'secondary';

    this.viewModel = new ViewModel(camera);

    this.keys = {};
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.isScoped = false;
    this.isMoving = false;
    this.isGrounded = true;
    this.isCrouching = false;

    this.planting = false;
    this.plantProgress = 0;
    this.plantDuration = 4.0;
    this.hasSpike = true;
    this.roundSpikePlanted = false;

    this._setupInput();
  }

  get weapon() {
    if (this.activeSlot === 'primary' && this.primaryWeapon) {
      return this.primaryWeapon;
    }
    return this.secondaryWeapon;
  }

  canScope() {
    return !!this.weapon.def.scope;
  }

  spawn(pos) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.alive = true;
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.primaryWeapon = null;
    this.secondaryWeapon = createWeaponState('classic');
    this.activeSlot = 'secondary';
    this.armor = 0;
    this.hasSpike = true;
    this.roundSpikePlanted = false;
    this.planting = false;
    this.plantProgress = 0;
    this.isScoped = false;
    this.viewModel.setWeapon('classic');
    this._updateScopeUI();
    this._updateCamera();
  }

  _setupInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'Digit1') this.equipPrimary();
      if (e.code === 'Digit2') this.equipSecondary();
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) {
        this.rightMouseDown = true;
        this._updateScope(true);
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
        this.weapon.shotsFired = 0;
      }
      if (e.button === 2) {
        this.rightMouseDown = false;
        this._updateScope(false);
      }
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _updateScope(wantsScope) {
    if (wantsScope && this.canScope()) {
      this.isScoped = true;
    } else {
      this.isScoped = false;
    }
    this._updateScopeUI();
    if (this.onScopeChange) this.onScopeChange(this.isScoped, this.weapon.def);
  }

  _updateScopeUI() {
    const scopeEl = document.getElementById('scope-overlay');
    const crosshair = document.getElementById('crosshair');
    const def = this.weapon.def;
    const showScope = this.isScoped && def.scope;

    if (scopeEl) {
      scopeEl.classList.toggle('hidden', !showScope);
      scopeEl.classList.toggle('sniper', def.id === 'operator' || def.id === 'marshal');
      scopeEl.classList.toggle('ads', def.id === 'guardian');
    }
    if (crosshair) {
      crosshair.classList.toggle('hidden', showScope);
    }
  }

  /** Crosshair aim direction — bullets go where the crosshair points (Valorant). */
  getCrosshairDirection() {
    const totalPitch = this.pitch + this.recoilPitch;
    const totalYaw = this.yaw + this.recoilYaw;
    return new THREE.Vector3(
      -Math.sin(totalYaw) * Math.cos(totalPitch),
      Math.sin(totalPitch),
      -Math.cos(totalYaw) * Math.cos(totalPitch)
    ).normalize();
  }

  /** Apply spread as small angular offset from crosshair aim. */
  _applySpread(baseDir, spread) {
    const right = new THREE.Vector3().crossVectors(baseDir, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, baseDir).normalize();
    const dir = baseDir.clone();
    dir.addScaledVector(right, Math.tan(spread.yaw));
    dir.addScaledVector(up, Math.tan(spread.pitch));
    return dir.normalize();
  }

  onMouseMove(deltaX, deltaY) {
    const scoped = this.isScoped && this.weapon.def.scope;
    const mul = getScopedSensMultiplier(scoped, this.weapon.def.id);
    this.yaw -= mouseDeltaToYaw(deltaX, mul);
    this.pitch -= mouseDeltaToPitch(deltaY, mul);
    const maxPitch = 89 * (Math.PI / 180);
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  buyWeapon(weaponId) {
    const def = getWeapon(weaponId);
    if (this.credits < def.price) return false;
    this.credits -= def.price;

    if (def.category === 'sidearms') {
      this.secondaryWeapon = createWeaponState(weaponId);
      this.equipSecondary();
    } else {
      this.primaryWeapon = createWeaponState(weaponId);
      this.equipPrimary();
    }
    return true;
  }

  buyArmor(type) {
    const prices = { light: 400, heavy: 1000 };
    const hp = { light: 25, heavy: 50 };
    if (this.credits < prices[type]) return false;
    this.credits -= prices[type];
    this.armor = hp[type];
    return true;
  }

  equipPrimary() {
    if (!this.primaryWeapon) return;
    this.activeSlot = 'primary';
    this.primaryWeapon.shotsFired = 0;
    this.isScoped = false;
    this.viewModel.setWeapon(this.primaryWeapon.def.id);
    this._updateScopeUI();
    if (this.onScopeChange) this.onScopeChange(false, this.weapon.def);
  }

  equipSecondary() {
    this.activeSlot = 'secondary';
    this.secondaryWeapon.shotsFired = 0;
    this.isScoped = false;
    this.viewModel.setWeapon(this.secondaryWeapon.def.id);
    this._updateScopeUI();
    if (this.onScopeChange) this.onScopeChange(false, this.weapon.def);
  }

  getLoadout() {
    return {
      primary: this.primaryWeapon?.def.id ?? null,
      secondary: this.secondaryWeapon?.def.id ?? 'classic',
      active: this.activeSlot,
    };
  }

  startReload() {
    const w = this.weapon;
    if (w.isReloading || w.ammo === w.def.magSize) return;
    if (w.reserve <= 0) return;
    w.isReloading = true;
    const reloadTime = getReloadTime(w.def.id);
    setTimeout(() => {
      if (this.alive) reloadWeapon(w);
    }, reloadTime * 1000);
  }

  takeDamage(amount, hitZone = 'body') {
    if (!this.alive) return;
    const { healthDmg } = applyArmorDamage(amount, this);
    this.health -= healthDmg;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.isScoped = false;
      this._updateScopeUI();
    }
  }

  update(dt, plantSites) {
    if (!this.alive) return;

    const w = this.weapon;

    // Hold scope while RMB held
    if (this.rightMouseDown && this.canScope()) {
      if (!this.isScoped) this._updateScope(true);
    } else if (this.isScoped) {
      this._updateScope(false);
    }

    const recovery = w.def.recoilRecovery * dt;
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, recovery);
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, recovery);

    let speed = this.isCrouching ? CROUCH_SPEED : (w.def.runSpeed || WALK_SPEED);
    if (this.isScoped) speed *= 0.45;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const moveDir = new THREE.Vector3();

    if (this.keys['KeyW']) moveDir.add(forward);
    if (this.keys['KeyS']) moveDir.sub(forward);
    if (this.keys['KeyA']) moveDir.sub(right);
    if (this.keys['KeyD']) moveDir.add(right);

    this.isCrouching = this.keys['ControlLeft'] || this.keys['ControlRight'];
    this.isMoving = moveDir.lengthSq() > 0;

    if (this.isMoving) {
      moveDir.normalize().multiplyScalar(speed * dt);
      this.position.add(moveDir);
    }

    if (this.keys['Space'] && this.isGrounded && !this.isScoped) {
      this.velocity.y = JUMP_FORCE;
      this.isGrounded = false;
    }

    this.velocity.y -= GRAVITY * dt;
    this.position.y += this.velocity.y * dt;
    if (this.position.y <= PLAYER_HEIGHT) {
      this.position.y = this.isCrouching ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    this.position = resolveCollision(this.position, this.colliders);
    this._updateCamera();
    this.viewModel.update(dt, this.isMoving, this.isScoped, this.weapon.def.id);
    this._updateCrosshairBloom();

    const now = performance.now() / 1000;
    const justPressed = this.mouseDown && !this._wasMouseDown;
    this._wasMouseDown = this.mouseDown;

    const wantsFire = w.def.automatic ? this.mouseDown : justPressed;

    if (wantsFire && canFire(w, now)) {
      this._fire(now);
    }

    if (!this.mouseDown && w.def.automatic) {
      if (now - w.lastShotTime > 0.3) w.shotsFired = 0;
    }

    this._updatePlanting(dt, plantSites);
  }

  _fire(now) {
    const w = this.weapon;
    fireWeapon(w, now);
    audio.playGunshot(w.def.id);
    this.viewModel.onFire();

    this.camera.updateMatrixWorld(true);

    const airborne = !this.isGrounded;
    const scoped = this.isScoped && w.def.scope;

    const aimDir = this.getCrosshairDirection();
    const spread = getBulletSpread(w, this.isMoving, airborne, scoped, this.isCrouching);
    const bulletDir = this._applySpread(aimDir, spread);

    // Hitscan from eye position (crosshair aligned)
    const hitOrigin = this.position.clone();
    const muzzle = this.viewModel.getMuzzleWorldPosition();

    this.onShoot({ hitOrigin, muzzle, direction: bulletDir, weaponDef: w.def });

    const kick = getViewKick(w);
    this.recoilPitch += kick.pitch;
    this.recoilYaw += kick.yaw;
  }

  _updateCrosshairBloom() {
    const w = this.weapon;
    if (!w) return;
    const scoped = this.isScoped && w.def.scope;
    const spread = getCurrentInaccuracy(w, this.isMoving, !this.isGrounded, scoped, this.isCrouching);
    const ch = document.getElementById('crosshair');
    if (!ch || ch.classList.contains('hidden')) return;
    // Valorant-style crosshair expansion (pixels per degree of inaccuracy)
    const gap = 4 + spread * 2.2;
    const length = 6 + spread * 0.4;
    ch.style.setProperty('--ch-gap', `${gap}px`);
    ch.style.setProperty('--ch-len', `${length}px`);
  }

  _updatePlanting(dt, plantSites) {
    const plantPrompt = document.getElementById('plant-prompt');
    const plantFill = document.getElementById('plant-fill');
    const spikeHud = document.getElementById('spike-hud');

    if (spikeHud) {
      spikeHud.classList.toggle('hidden', !this.hasSpike || this.roundSpikePlanted);
      spikeHud.classList.toggle('planted', this.roundSpikePlanted);
    }

    if (!this.hasSpike || this.roundSpikePlanted) {
      this.planting = false;
      this.plantProgress = 0;
      plantPrompt?.classList.add('hidden');
      if (plantFill) plantFill.style.width = '0%';
      return;
    }

    let nearSite = null;
    for (const key of ['A', 'B']) {
      const site = plantSites[key];
      if (this.position.distanceTo(site.center) < site.radius) {
        nearSite = site;
        break;
      }
    }

    if (nearSite) {
      plantPrompt?.classList.remove('hidden');
      document.getElementById('site-label').textContent = nearSite.label;
      if (this.keys['Digit4']) {
        this.planting = true;
        this.plantProgress += dt;
      } else {
        this.planting = false;
        this.plantProgress = Math.max(0, this.plantProgress - dt * 2);
      }
      const pct = Math.min(100, (this.plantProgress / this.plantDuration) * 100);
      if (plantFill) plantFill.style.width = `${pct}%`;
      if (this.plantProgress >= this.plantDuration) {
        this.planting = false;
        this.plantProgress = 0;
        this.hasSpike = false;
        this.roundSpikePlanted = true;
        if (plantFill) plantFill.style.width = '0%';
        if (this.onPlant) this.onPlant(nearSite);
      }
    } else {
      this.planting = false;
      this.plantProgress = 0;
      plantPrompt?.classList.add('hidden');
      if (plantFill) plantFill.style.width = '0%';
    }
  }

  _updateCamera() {
    const height = this.isCrouching ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;
    this.position.y = Math.max(height, this.position.y);
    this.camera.position.copy(this.position);

    const totalPitch = this.pitch + this.recoilPitch;
    const totalYaw = this.yaw + this.recoilYaw;

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = totalYaw;
    this.camera.rotation.x = totalPitch;
  }
}

export function raycastHit(origin, direction, targets, maxDist = 150, blockers = []) {
  const dir = direction.clone().normalize();
  const raycaster = new THREE.Raycaster(origin, dir, 0.05, maxDist);
  raycaster.camera = null;

  for (const t of targets) {
    if (t.alive && t.mesh) t.mesh.updateMatrixWorld(true);
  }
  for (const mesh of blockers) {
    mesh.updateMatrixWorld?.(true);
  }

  const botMeshes = targets.filter(t => t.alive && t.mesh).map(t => t.mesh);
  const allMeshes = blockers.length ? [...blockers, ...botMeshes] : botMeshes;
  if (allMeshes.length === 0) return null;

  const hits = raycaster.intersectObjects(allMeshes, true);
  if (hits.length === 0) return null;

  for (const hit of hits) {
    let obj = hit.object;
    while (obj) {
      const bot = obj.userData?.bot;
      if (bot?.alive) {
        let hitZone = hit.object.userData?.hitZone ?? 'body';
        if (!hit.object.userData?.hitZone) {
          const bodyY = bot.mesh.position.y;
          if (hit.point.y >= bodyY + 1.45) hitZone = 'head';
          else if (hit.point.y <= bodyY + 0.25) hitZone = 'leg';
        }
        return { target: bot, hit, hitZone, distance: hit.distance };
      }
      obj = obj.parent;
    }
  }
  return null;
}

export function createBulletTracer(scene, origin, direction, maxDist = 100, hitPoint = null) {
  const end = hitPoint
    ? hitPoint.clone()
    : origin.clone().add(direction.clone().multiplyScalar(maxDist));
  const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  setTimeout(() => { scene.remove(line); geo.dispose(); mat.dispose(); }, 60);
}

export function createHitMarker() {
  const ch = document.getElementById('crosshair');
  const scopeHit = document.getElementById('scope-hit');
  if (ch && !ch.classList.contains('hidden')) {
    ch.style.transform = 'translate(-50%, -50%) scale(1.3)';
    setTimeout(() => { ch.style.transform = 'translate(-50%, -50%) scale(1)'; }, 80);
  }
  if (scopeHit) {
    scopeHit.classList.add('flash');
    setTimeout(() => scopeHit.classList.remove('flash'), 80);
  }
}

/** Ray vs sphere — returns distance along ray or null. */
function raySphereDist(origin, dir, center, radius) {
  const oc = origin.clone().sub(center);
  const b = oc.dot(dir);
  const c = oc.lengthSq() - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0.01 ? t : (-b + Math.sqrt(disc) > 0.01 ? -b + Math.sqrt(disc) : null);
}

/** Hitscan against player capsule (head/body/leg zones). */
export function raycastPlayer(origin, direction, player, maxDist = 60) {
  if (!player?.alive) return null;
  const dir = direction.clone().normalize();
  const eye = player.position;
  const headCenter = new THREE.Vector3(eye.x, eye.y + 0.06, eye.z);
  const bodyCenter = new THREE.Vector3(eye.x, eye.y - 0.42, eye.z);
  const legCenter = new THREE.Vector3(eye.x, eye.y - 0.78, eye.z);

  const candidates = [
    { zone: 'head', dist: raySphereDist(origin, dir, headCenter, 0.17) },
    { zone: 'body', dist: raySphereDist(origin, dir, bodyCenter, 0.36) },
    { zone: 'leg', dist: raySphereDist(origin, dir, legCenter, 0.28) },
  ].filter(c => c.dist !== null && c.dist < maxDist);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  const best = candidates[0];
  const hitPoint = origin.clone().addScaledVector(dir, best.dist);
  return { hitZone: best.zone, distance: best.dist, point: hitPoint };
}
