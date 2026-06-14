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

function makeMat(color) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.6, metalness: 0.12,
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
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.y = 2.15;
  sprite.visible = false;
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

    this.reactionTime = 0.65 + Math.random() * 0.75;
    this.spottedAt = 0;
    this.burstSize = 2 + Math.floor(Math.random() * 2);
    this.burstShotsLeft = 0;
    this.burstPauseUntil = 0;
    this.baseAccuracy = 0.1 + Math.random() * 0.08;
    this.seeRange = 36;
    this.fightRange = 22;
    this.holdRange = 11;
    this.canSeePlayer = false;

    this.holdUntil = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeSwapAt = 0;
    this.lookSweep = 0;
    this.gunRecoil = 0;
    this.moveSpeed = 0;

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

    const legGeo = new THREE.BoxGeometry(0.22, 0.55, 0.22);
    this.legL = new THREE.Mesh(legGeo, dark);
    this.legL.position.set(-0.14, -0.28, 0);
    this.legL.userData = { bot: this, hitZone: 'leg' };
    this.legR = new THREE.Mesh(legGeo, dark);
    this.legR.position.set(0.14, -0.28, 0);
    this.legR.userData = { bot: this, hitZone: 'leg' };
    this.mesh.add(this.legL, this.legR);

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), suit);
    this.torso.position.y = 0.38;
    this.torso.userData = { bot: this, hitZone: 'body' };
    this.mesh.add(this.torso);

    const padGeo = new THREE.BoxGeometry(0.18, 0.12, 0.22);
    const padL = new THREE.Mesh(padGeo, accent);
    padL.position.set(-0.38, 0.62, 0);
    padL.userData = { bot: this, hitZone: 'body' };
    const padR = new THREE.Mesh(padGeo, accent);
    padR.position.set(0.38, 0.62, 0);
    padR.userData = { bot: this, hitZone: 'body' };
    this.mesh.add(padL, padR);

    this.headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
    this.headMesh.position.y = 0.98;
    this.headMesh.userData = { bot: this, hitZone: 'head' };
    this.mesh.add(this.headMesh);

    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), hair);
    hairMesh.position.y = 1.18;
    hairMesh.userData = { bot: this, hitZone: 'head' };
    this.mesh.add(hairMesh);

    this.gunGroup = new THREE.Group();
    this.gunGroup.position.set(0.28, 0.48, -0.08);
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.55), dark);
    gunBody.position.z = -0.28;
    const gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.35), makeMat(0x444444));
    gunBarrel.position.set(0, 0.04, -0.58);
    this.gunGroup.add(gunBody, gunBarrel);
    this.mesh.add(this.gunGroup);

    this.nameTag = createNameLabel(this.name);
    this.mesh.add(this.nameTag);

    // Reliable invisible hitbox for raycasts
    const hitMat = new THREE.MeshBasicMaterial({ visible: false, depthWrite: false });
    this.bodyHitbox = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.72, 0.72), hitMat);
    this.bodyHitbox.position.y = 0.1;
    this.bodyHitbox.userData = { bot: this, hitZone: 'body' };
    this.mesh.add(this.bodyHitbox);

    this.mesh.position.copy(this.position);
    this.mesh.position.y = 0.9;
    scene.add(this.mesh);
  }

  pickPatrolTarget() {
    this.patrolTarget.copy(PATROL_POINTS[Math.floor(Math.random() * PATROL_POINTS.length)]);
    this.holdUntil = 0;
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
    this.canSeePlayer = false;
    this.holdUntil = 0;
  }

  takeDamage(amount) {
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
    for (const m of [this.torso, this.headMesh, this.legL, this.legR]) {
      const prev = m.material.color.getHex();
      m.material.color.setHex(0xffffff);
      setTimeout(() => m.material.color.setHex(prev), 80);
    }
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
    this.canSeePlayer = canSee;

    if (this.nameTag) {
      this.nameTag.visible = canSee && distToPlayer < this.seeRange;
    }

    // ── State machine ──
    if (canSee) {
      if (this.state === 'patrol' || this.state === 'hold') {
        this.state = 'alert';
        this.spottedAt = now;
        this.target = player.position.clone();
      } else {
        this.target = player.position.clone();
      }
    } else if (this.state === 'alert' || this.state === 'fight' || this.state === 'push') {
      this.state = 'patrol';
      this.target = null;
    }

    const reacted = this.state !== 'alert' || (now - this.spottedAt >= this.reactionTime);
    if (canSee && reacted) {
      if (distToPlayer > this.fightRange) this.state = 'push';
      else if (distToPlayer > this.holdRange) this.state = 'fight';
      else this.state = 'fight';
    }

    // ── Aim (smooth, not snap) ──
    const aimSpeed = this.state === 'alert' ? 2.5 : 4.5;
    if (this.target && (canSee || this.state === 'push')) {
      const dx = this.target.x - this.position.x;
      const dy = (this.target.y + 0.05) - 1.45;
      const dz = this.target.z - this.position.z;
      const horiz = Math.hypot(dx, dz) || 1;
      const targetYaw = Math.atan2(-dx, -dz);
      const targetPitch = Math.atan2(dy, horiz);
      this.yaw = THREE.MathUtils.lerp(this.yaw, targetYaw, dt * aimSpeed);
      this.aimPitch = THREE.MathUtils.lerp(this.aimPitch, targetPitch, dt * aimSpeed * 0.85);
    }

    // ── Movement ──
    this.moveSpeed = 0;
    const walkSpeed = 2.6;
    const runSpeed = 3.4;

    if (this.state === 'push' && this.target) {
      const dir = this.target.clone().sub(this.position).setY(0);
      if (dir.length() > this.fightRange * 0.85) {
        dir.normalize().multiplyScalar(runSpeed * dt);
        this.position.add(dir);
        this.position = resolveCollision(this.position, this.colliders);
        this.moveSpeed = runSpeed;
      }
    } else if (this.state === 'fight' && canSee) {
      // Strafe at fighting distance — don't run into player face
      if (now >= this.strafeSwapAt) {
        this.strafeDir *= -1;
        this.strafeSwapAt = now + 0.9 + Math.random() * 1.2;
      }
      const strafe = new THREE.Vector3(
        Math.cos(this.yaw) * this.strafeDir,
        0,
        -Math.sin(this.yaw) * this.strafeDir,
      );
      strafe.normalize().multiplyScalar(walkSpeed * 0.55 * dt);
      this.position.add(strafe);
      this.position = resolveCollision(this.position, this.colliders);
      this.moveSpeed = walkSpeed * 0.55;

      // Back up if too close
      if (distToPlayer < this.holdRange * 0.7) {
        const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
          .multiplyScalar(walkSpeed * 0.4 * dt);
        this.position.add(back);
        this.position = resolveCollision(this.position, this.colliders);
      }
    } else if (this.state === 'patrol') {
      const dir = this.patrolTarget.clone().sub(this.position).setY(0);
      if (dir.length() < 1.5) {
        this.state = 'hold';
        this.holdUntil = now + 2 + Math.random() * 3;
        this.lookSweep = this.yaw;
      } else {
        dir.normalize().multiplyScalar(walkSpeed * dt);
        this.position.add(dir);
        this.position = resolveCollision(this.position, this.colliders);
        this.moveSpeed = walkSpeed;
        this.yaw = THREE.MathUtils.lerp(this.yaw, Math.atan2(-dir.x, -dir.z), dt * 5);
        this.aimPitch = THREE.MathUtils.lerp(this.aimPitch, 0, dt * 4);
      }
    } else if (this.state === 'hold') {
      this.lookSweep += dt * 0.35 * (this.id % 2 === 0 ? 1 : -1);
      this.yaw = THREE.MathUtils.lerp(this.yaw, this.lookSweep, dt * 2);
      this.aimPitch = THREE.MathUtils.lerp(this.aimPitch, 0, dt * 3);
      if (now >= this.holdUntil) {
        this.state = 'patrol';
        this.pickPatrolTarget();
      }
    }

    // ── Visuals ──
    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
    this.mesh.rotation.y = this.yaw;
    this.headMesh.rotation.x = -this.aimPitch * 0.45;
    this.gunRecoil = THREE.MathUtils.lerp(this.gunRecoil, 0, dt * 16);
    this.gunGroup.rotation.x = -this.aimPitch + this.gunRecoil;
    this.gunGroup.rotation.y = 0.06;

    // Leg bob when moving
    const bob = this.moveSpeed > 0 ? Math.sin(now * 9) * 0.04 : 0;
    this.legL.position.y = -0.28 + bob;
    this.legR.position.y = -0.28 - bob;

    // ── Shooting (only closest bot, burst fire) ──
    let shot = null;
    const canShoot = canSee && reacted && this.state === 'fight' &&
      distToPlayer < this.fightRange && shootPriority === 0;

    if (canShoot && now >= this.burstPauseUntil) {
      if (this.burstShotsLeft <= 0) {
        this.burstShotsLeft = this.burstSize;
      }
      if (canFire(this.weapon, now) && this.burstShotsLeft > 0) {
        fireWeapon(this.weapon, now);
        this.burstShotsLeft--;
        this.gunRecoil = 0.12;
        if (this.burstShotsLeft === 0) {
          this.burstPauseUntil = now + 0.85 + Math.random() * 1.1;
        }

        const aimOrigin = this.position.clone().setY(1.45);
        const dir = new THREE.Vector3(
          -Math.sin(this.yaw) * Math.cos(this.aimPitch),
          Math.sin(this.aimPitch),
          -Math.cos(this.yaw) * Math.cos(this.aimPitch),
        ).normalize();

        const spread = this.baseAccuracy + distToPlayer * 0.005 +
          (this.moveSpeed > 0 ? 0.05 : 0.02);
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread * 0.65;
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
