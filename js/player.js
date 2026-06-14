import * as THREE from 'three';
import { mouseDeltaToYaw, mouseDeltaToPitch } from './settings.js';
import {
  createWeaponState, canFire, fireWeapon, getRecoilOffset,
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

    // Valorant-style slots: primary (rifle/smg/sniper) + secondary (sidearm only)
    this.primaryWeapon = null;
    this.secondaryWeapon = createWeaponState('classic');
    this.activeSlot = 'secondary';

    this.viewModel = new ViewModel(camera, scene);

    this.keys = {};
    this.mouseDown = false;
    this.isMoving = false;
    this.isGrounded = true;
    this.isCrouching = false;

    this.planting = false;
    this.plantProgress = 0;
    this.plantDuration = 4.0;

    this._setupInput();
  }

  /** Currently equipped weapon. */
  get weapon() {
    if (this.activeSlot === 'primary' && this.primaryWeapon) {
      return this.primaryWeapon;
    }
    return this.secondaryWeapon;
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
    this.viewModel.setWeapon('classic');
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
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
        this.weapon.shotsFired = 0;
      }
    });
  }

  onMouseMove(deltaX, deltaY) {
    this.yaw -= mouseDeltaToYaw(deltaX);
    this.pitch -= mouseDeltaToPitch(deltaY);
    const maxPitch = 89 * (Math.PI / 180);
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  buyWeapon(weaponId) {
    const def = getWeapon(weaponId);
    if (this.credits < def.price) return false;
    this.credits -= def.price;

    if (def.category === 'sidearms') {
      // Sidearms always go to secondary slot — never duplicate in primary
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
    this.viewModel.setWeapon(this.primaryWeapon.def.id);
  }

  equipSecondary() {
    this.activeSlot = 'secondary';
    this.secondaryWeapon.shotsFired = 0;
    this.viewModel.setWeapon(this.secondaryWeapon.def.id);
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
    let dmg = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.66);
      this.armor -= absorbed;
      dmg -= absorbed * 0.66;
    }
    this.health -= dmg;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  update(dt, plantSites) {
    if (!this.alive) return;

    const w = this.weapon;
    const recovery = w.def.recoilRecovery * dt;
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, recovery);
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, recovery);

    const speed = this.isCrouching ? CROUCH_SPEED : (w.def.runSpeed || WALK_SPEED);
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

    if (this.keys['Space'] && this.isGrounded) {
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
    this.viewModel.update(dt, this.isMoving);

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

    const airborne = !this.isGrounded;
    const recoil = getRecoilOffset(w, this.isMoving, airborne);

    this.recoilPitch += recoil.viewKickPitch;
    this.recoilYaw += recoil.viewKickYaw;

    const totalPitch = this.pitch + this.recoilPitch + recoil.pitch;
    const totalYaw = this.yaw + this.recoilYaw + recoil.yaw;

    const dir = new THREE.Vector3(
      -Math.sin(totalYaw) * Math.cos(totalPitch),
      Math.sin(totalPitch),
      -Math.cos(totalYaw) * Math.cos(totalPitch)
    );

    const origin = this.camera.position.clone();
    this.onShoot(origin, dir, w.def);
  }

  _updatePlanting(dt, plantSites) {
    let nearSite = null;
    for (const key of ['A', 'B']) {
      const site = plantSites[key];
      if (this.position.distanceTo(site.center) < site.radius) {
        nearSite = site;
        break;
      }
    }

    const plantPrompt = document.getElementById('plant-prompt');
    if (nearSite && this.keys['Digit4']) {
      this.planting = true;
      this.plantProgress += dt;
      plantPrompt.classList.remove('hidden');
      document.getElementById('site-label').textContent = nearSite.label;
      if (this.plantProgress >= this.plantDuration) {
        this.planting = false;
        this.plantProgress = 0;
        if (this.onPlant) this.onPlant(nearSite);
      }
    } else {
      this.planting = false;
      this.plantProgress = 0;
      plantPrompt.classList.add('hidden');
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

export function raycastHit(origin, direction, targets, maxDist = 100) {
  const raycaster = new THREE.Raycaster(origin, direction, 0, maxDist);
  const meshes = targets.filter(t => t.alive && t.mesh).map(t => t.mesh);
  const hits = raycaster.intersectObjects(meshes, true);
  if (hits.length === 0) return null;

  const hit = hits[0];
  let obj = hit.object;
  while (obj && !targets.find(t => t.mesh === obj)) {
    obj = obj.parent;
  }
  const target = targets.find(t => t.mesh === obj);
  if (!target) return null;

  const headHeight = target.mesh.position.y + 1.4;
  const hitZone = hit.point.y > headHeight ? 'head' : (hit.point.y < target.mesh.position.y + 0.8 ? 'leg' : 'body');

  return { target, hit, hitZone, distance: hit.distance };
}

export function createBulletTracer(scene, origin, end) {
  const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.6 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  setTimeout(() => { scene.remove(line); geo.dispose(); mat.dispose(); }, 50);
}

export function createHitMarker() {
  const ch = document.getElementById('crosshair');
  ch.style.transform = 'translate(-50%, -50%) scale(1.3)';
  setTimeout(() => { ch.style.transform = 'translate(-50%, -50%) scale(1)'; }, 80);
}
