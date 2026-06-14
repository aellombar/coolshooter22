import * as THREE from 'three';
import { createWeaponState, canFire, fireWeapon, applyArmorDamage } from './weapons.js';
import { resolveCollision, checkLineOfSight, getPatrolPoints } from './map.js';

const BOT_NAMES = ['Jett', 'Reyna', 'Phoenix', 'Raze', 'Sage'];
const PATROL_POINTS = getPatrolPoints();

const AGENT_STYLES = {
  Jett: { suit: 0x9ee8e0, accent: 0x00c8b4, skin: 0xf0c8a0, hair: 0xf5f5f5 },
  Reyna: { suit: 0x6a3080, accent: 0xc040ff, skin: 0xc89070, hair: 0x1a0820 },
  Phoenix: { suit: 0xe07030, accent: 0xffcc00, skin: 0x8d5524, hair: 0x2a1408 },
  Raze: { suit: 0xd0a030, accent: 0xff6600, skin: 0xc08050, hair: 0x3a2010 },
  Sage: { suit: 0x50a890, accent: 0x00ffcc, skin: 0xf0d0b0, hair: 0x1a3040 },
};

function makeMat(color, emissive = 0x000000, emInt = 0) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.55, metalness: 0.15,
    emissive, emissiveIntensity: emInt,
  });
}

function createNameLabel(name) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name.toUpperCase(), 128, 42);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.y = 2.15;
  sprite.renderOrder = 998;
  return sprite;
}

export class Bot {
  constructor(id, scene, colliders, spawnPos) {
    this.id = id;
    this.name = BOT_NAMES[id % BOT_NAMES.length];
    this.colliders = colliders;
    this.alive = true;
    this.health = 100;
    this.armor = 50;
    this.team = 'defender';

    this.position = spawnPos.clone();
    this.yaw = Math.PI;
    this.aimPitch = 0;
    this.target = null;
    this.state = 'patrol';
    this.patrolTarget = new THREE.Vector3();
    this.pickPatrolTarget();

    this.weapon = createWeaponState('vandal');
    this.weapon.ammo = 25;

    // Human-like timing
    this.reactionTime = 0.55 + Math.random() * 0.55;
    this.spottedAt = 0;
    this.burstSize = 2 + Math.floor(Math.random() * 2);
    this.burstShotsLeft = 0;
    this.burstPauseUntil = 0;
    this.baseAccuracy = 0.08 + Math.random() * 0.07;
    this.seeRange = 38;
    this.shootRange = 28;
    this.canShootThisFrame = false;
    this.isAimingAtPlayer = false;

    this._buildModel(scene);
  }

  _buildModel(scene) {
    const style = AGENT_STYLES[this.name] || AGENT_STYLES.Phoenix;
    const suit = makeMat(style.suit);
    const accent = makeMat(style.accent);
    const skin = makeMat(style.skin);
    const dark = makeMat(0x222222);
    const hair = makeMat(style.hair);

    this.mesh = new THREE.Group();
    this.mesh.userData.bot = this;

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.55, 0.22);
    this.legL = new THREE.Mesh(legGeo, dark);
    this.legL.position.set(-0.14, -0.28, 0);
    this.legL.userData = { bot: this, hitZone: 'leg' };
    this.legR = new THREE.Mesh(legGeo, dark);
    this.legR.position.set(0.14, -0.28, 0);
    this.legR.userData = { bot: this, hitZone: 'leg' };
    this.mesh.add(this.legL, this.legR);

    // Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), suit);
    this.torso.position.y = 0.38;
    this.torso.userData = { bot: this, hitZone: 'body' };
    this.mesh.add(this.torso);

    // Shoulder pads
    const padGeo = new THREE.BoxGeometry(0.18, 0.12, 0.22);
    const padL = new THREE.Mesh(padGeo, accent);
    padL.position.set(-0.38, 0.62, 0);
    const padR = new THREE.Mesh(padGeo, accent);
    padR.position.set(0.38, 0.62, 0);
    this.mesh.add(padL, padR);

    // Head
    this.headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
    this.headMesh.position.y = 0.98;
    this.headMesh.userData = { bot: this, hitZone: 'head' };
    this.mesh.add(this.headMesh);

    // Hair / hood
    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), hair);
    hairMesh.position.y = 1.18;
    this.mesh.add(hairMesh);

    // Eyes — glow red when targeting player
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.05, 0.04);
    this.eyeMat = makeMat(0x222222);
    this.eyeMatTarget = makeMat(0xff3344, 0xff0000, 1.2);
    this.eyeL = new THREE.Mesh(eyeGeo, this.eyeMat.clone());
    this.eyeL.position.set(-0.09, 1.0, -0.2);
    this.eyeR = new THREE.Mesh(eyeGeo, this.eyeMat.clone());
    this.eyeR.position.set(0.09, 1.0, -0.2);
    this.mesh.add(this.eyeL, this.eyeR);

    // Weapon group — rotates toward aim
    this.gunGroup = new THREE.Group();
    this.gunGroup.position.set(0.28, 0.48, -0.08);
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.55), dark);
    gunBody.position.z = -0.28;
    const gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.35), makeMat(0x444444));
    gunBarrel.position.set(0, 0.04, -0.58);
    this.gunGroup.add(gunBody, gunBarrel);
    this.mesh.add(this.gunGroup);

    // Aim laser — visible when locking onto player
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1.5),
    ]);
    this.aimLaser = new THREE.Line(
      laserGeo,
      new THREE.LineBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.55 }),
    );
    this.aimLaser.visible = false;
    this.aimLaser.position.set(0, 0.04, -0.62);
    this.gunGroup.add(this.aimLaser);

    // Name tag
    this.nameTag = createNameLabel(this.name);
    this.mesh.add(this.nameTag);

    this.mesh.position.copy(this.position);
    this.mesh.position.y = 0.9;
    scene.add(this.mesh);
  }

  pickPatrolTarget() {
    this.patrolTarget.copy(PATROL_POINTS[Math.floor(Math.random() * PATROL_POINTS.length)]);
  }

  spawn(pos) {
    this.position.copy(pos);
    this.alive = true;
    this.health = 100;
    this.armor = 50;
    this.weapon = createWeaponState('vandal');
    this.mesh.position.copy(this.position);
    this.mesh.position.y = 0.9;
    this.mesh.visible = true;
    this.state = 'patrol';
    this.spottedAt = 0;
    this.burstShotsLeft = 0;
    this.burstPauseUntil = 0;
    this.isAimingAtPlayer = false;
  }

  takeDamage(amount, hitZone = 'body') {
    if (!this.alive) return;
    const { healthDmg } = applyArmorDamage(amount, this);
    this.health -= healthDmg;
    this._flashHit();
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.mesh.visible = false;
    }
  }

  _flashHit() {
    const parts = [this.torso, this.headMesh, this.legL, this.legR];
    for (const m of parts) {
      const prev = m.material.color.getHex();
      m.material.color.setHex(0xffffff);
      setTimeout(() => m.material.color.setHex(prev), 80);
    }
  }

  _setTargeting(on) {
    this.isAimingAtPlayer = on;
    const mat = on ? this.eyeMatTarget : this.eyeMat;
    for (const eye of [this.eyeL, this.eyeR]) {
      eye.material.color.copy(mat.color);
      eye.material.emissive.copy(mat.emissive);
      eye.material.emissiveIntensity = on ? 1.2 : 0;
    }
    this.aimLaser.visible = on;
    this.torso.material.emissive.setHex(on ? 0x330808 : 0x000000);
    this.torso.material.emissiveIntensity = on ? 0.25 : 0;
  }

  update(dt, player, colliders, shootPriority = 0) {
    if (!this.alive) return null;

    const now = performance.now() / 1000;
    const distToPlayer = this.position.distanceTo(player.position);
    const canSee = distToPlayer < this.seeRange &&
      checkLineOfSight(
        this.position.clone().setY(1.4),
        player.position.clone(),
        colliders,
      );

    // State machine with reaction delay
    if (canSee) {
      if (this.state === 'patrol') {
        this.state = 'alert';
        this.spottedAt = now;
        this.target = player.position.clone();
      } else {
        this.target = player.position.clone();
      }
    } else if (this.state !== 'patrol') {
      this.state = 'patrol';
      this.target = null;
      this._setTargeting(false);
    }

    const reacted = this.state !== 'alert' || (now - this.spottedAt >= this.reactionTime);
    if (canSee && reacted) {
      this.state = distToPlayer < this.shootRange ? 'engage' : 'chase';
    }

    // Smooth aim toward player
    if (this.target && canSee) {
      const dx = this.target.x - this.position.x;
      const dy = (this.target.y + 0.1) - 1.4;
      const dz = this.target.z - this.position.z;
      const horiz = Math.hypot(dx, dz) || 1;
      const targetYaw = Math.atan2(-dx, -dz);
      const targetPitch = Math.atan2(dy, horiz);
      this.yaw = THREE.MathUtils.lerp(this.yaw, targetYaw, dt * 6);
      this.aimPitch = THREE.MathUtils.lerp(this.aimPitch, targetPitch, dt * 5);
    } else if (this.target) {
      const dx = this.target.x - this.position.x;
      const dz = this.target.z - this.position.z;
      const targetYaw = Math.atan2(-dx, -dz);
      this.yaw = THREE.MathUtils.lerp(this.yaw, targetYaw, dt * 4);
      this.aimPitch = THREE.MathUtils.lerp(this.aimPitch, 0, dt * 4);
    }

    const speed = 3.2;
    if (this.state === 'chase' && this.target) {
      const dir = this.target.clone().sub(this.position).setY(0);
      if (dir.length() > 5) {
        dir.normalize().multiplyScalar(speed * dt);
        this.position.add(dir);
        this.position = resolveCollision(this.position, this.colliders);
      }
    } else if (this.state === 'patrol') {
      const dir = this.patrolTarget.clone().sub(this.position).setY(0);
      if (dir.length() < 2) {
        this.pickPatrolTarget();
      } else {
        dir.normalize().multiplyScalar(speed * 0.55 * dt);
        this.position.add(dir);
        this.position = resolveCollision(this.position, this.colliders);
      }
      const dx = this.patrolTarget.x - this.position.x;
      const dz = this.patrolTarget.z - this.position.z;
      this.yaw = Math.atan2(-dx, -dz);
    }

    // Only closest 2 bots fire; all bots show "looking at you" when they see you
    const lockingOn = canSee && reacted &&
      (this.state === 'engage' || this.state === 'chase') &&
      distToPlayer < this.seeRange;
    this.canShootThisFrame = lockingOn && this.state === 'engage' &&
      distToPlayer < this.shootRange && shootPriority < 2;
    this._setTargeting(lockingOn);

    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
    this.mesh.rotation.y = this.yaw;
    this.headMesh.rotation.x = -this.aimPitch * 0.55;
    this.gunGroup.rotation.x = -this.aimPitch;
    this.gunGroup.rotation.y = 0.08;

    // Burst fire — tap-like, not full spray
    let shot = null;
    if (this.canShootThisFrame && now >= this.burstPauseUntil) {
      if (this.burstShotsLeft <= 0) {
        this.burstShotsLeft = this.burstSize;
      }
      if (canFire(this.weapon, now) && this.burstShotsLeft > 0) {
        fireWeapon(this.weapon, now);
        this.burstShotsLeft--;
        if (this.burstShotsLeft === 0) {
          this.burstPauseUntil = now + 0.65 + Math.random() * 0.75;
        }

        const aimOrigin = this.position.clone().setY(1.45);
        const dir = new THREE.Vector3(
          -Math.sin(this.yaw) * Math.cos(this.aimPitch),
          Math.sin(this.aimPitch),
          -Math.cos(this.yaw) * Math.cos(this.aimPitch),
        ).normalize();

        // Human-like inaccuracy — worse at range and while moving
        const moving = this.state === 'chase';
        const distAcc = this.baseAccuracy + distToPlayer * 0.004;
        const spread = distAcc + (moving ? 0.06 : 0);
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread * 0.7;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();

        shot = {
          origin: aimOrigin,
          direction: dir,
          weaponDef: this.weapon.def,
          shooter: this,
        };
      }
    }

    return shot;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose?.();
    });
  }
}

export function createBotTeam(scene, colliders, spawnPoints) {
  return spawnPoints.map((pos, i) => new Bot(i, scene, colliders, pos));
}

export function addKillFeed(killerName, victimName, weaponName) {
  const feed = document.getElementById('kill-feed');
  const entry = document.createElement('div');
  entry.className = 'kill-entry';
  entry.textContent = `${killerName} [${weaponName}] ${victimName}`;
  feed.prepend(entry);
  setTimeout(() => entry.remove(), 4000);
}
