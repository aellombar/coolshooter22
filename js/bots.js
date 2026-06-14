import * as THREE from 'three';
import { createWeaponState, canFire, fireWeapon, applyArmorDamage } from './weapons.js';
import { resolveCollision, checkLineOfSight, getPatrolPoints } from './map.js';

const BOT_NAMES = ['Bot1', 'Bot2', 'Bot3', 'Bot4', 'Bot5'];
const PATROL_POINTS = getPatrolPoints();
const BODY_COLOR = 0xff4655;
const HEAD_COLOR = 0xcc3344;

export class Bot {
  constructor(id, scene, colliders, spawnPos) {
    this.id = id;
    this.name = BOT_NAMES[id % BOT_NAMES.length];
    this.colliders = colliders;
    this.alive = true;
    this.health = 100;
    this.armor = 50;

    this.position = spawnPos.clone();
    this.yaw = Math.PI;
    this.target = null;
    this.state = 'patrol';
    this.patrolTarget = new THREE.Vector3();
    this.pickPatrolTarget();

    this.weapon = createWeaponState('vandal');
    this.reactionTime = 0.5 + Math.random() * 0.4;
    this.spottedAt = 0;
    this.burstShotsLeft = 0;
    this.burstPauseUntil = 0;
    this.baseAccuracy = 0.12 + Math.random() * 0.1;
    this.seeRange = 40;
    this.shootRange = 28;

    this._buildModel(scene);
  }

  _buildModel(scene) {
    // Aim Lab style — simple body + head boxes (reliable raycast targets)
    const bodyMat = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.5 });
    const headMat = new THREE.MeshStandardMaterial({ color: HEAD_COLOR, roughness: 0.45 });

    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.55, 0.78), bodyMat);
    this.mesh.castShadow = true;
    this.mesh.userData = { bot: this, hitZone: 'body' };

    this.headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), headMat);
    this.headMesh.position.y = 1.02;
    this.headMesh.userData = { bot: this, hitZone: 'head' };
    this.mesh.add(this.headMesh);

    this.mesh.position.copy(this.position);
    this.mesh.position.y = 0.775;
    scene.add(this.mesh);

    // Direct mesh list for hitscan — no group traversal
    this.hitMeshes = [this.mesh, this.headMesh];
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
    this.mesh.position.y = 0.775;
    this.mesh.visible = true;
    this.state = 'patrol';
    this.spottedAt = 0;
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
    for (const m of [this.mesh, this.headMesh]) {
      const prev = m.material.color.getHex();
      m.material.color.setHex(0xffffff);
      setTimeout(() => m.material.color.setHex(prev), 70);
    }
  }

  update(dt, player, colliders, shootPriority = 0) {
    if (!this.alive) return null;

    const now = performance.now() / 1000;
    const dist = this.position.distanceTo(player.position);
    const canSee = dist < this.seeRange &&
      checkLineOfSight(this.position.clone().setY(1.4), player.position.clone(), colliders);

    if (canSee) {
      if (this.state === 'patrol') {
        this.state = 'alert';
        this.spottedAt = now;
      }
      this.target = player.position.clone();
    } else if (this.state !== 'patrol') {
      this.state = 'patrol';
      this.target = null;
    }

    const reacted = this.state !== 'alert' || (now - this.spottedAt >= this.reactionTime);
    if (canSee && reacted) {
      this.state = dist < this.shootRange ? 'fight' : 'chase';
    }

    if (this.target) {
      const dx = this.target.x - this.position.x;
      const dz = this.target.z - this.position.z;
      this.yaw = Math.atan2(-dx, -dz);
    }

    const speed = 3.0;
    if (this.state === 'chase' && this.target) {
      const dir = this.target.clone().sub(this.position).setY(0);
      if (dir.length() > 6) {
        dir.normalize().multiplyScalar(speed * dt);
        this.position.add(dir);
        this.position = resolveCollision(this.position, this.colliders);
      }
    } else if (this.state === 'patrol') {
      const dir = this.patrolTarget.clone().sub(this.position).setY(0);
      if (dir.length() < 2) this.pickPatrolTarget();
      else {
        dir.normalize().multiplyScalar(speed * 0.5 * dt);
        this.position.add(dir);
        this.position = resolveCollision(this.position, this.colliders);
      }
    }

    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
    this.mesh.rotation.y = this.yaw;

    let shot = null;
    if (canSee && reacted && this.state === 'fight' && dist < this.shootRange && shootPriority === 0) {
      if (now >= this.burstPauseUntil) {
        if (this.burstShotsLeft <= 0) this.burstShotsLeft = 2 + Math.floor(Math.random() * 2);
        if (canFire(this.weapon, now) && this.burstShotsLeft > 0) {
          fireWeapon(this.weapon, now);
          this.burstShotsLeft--;
          if (this.burstShotsLeft === 0) this.burstPauseUntil = now + 0.7 + Math.random() * 0.6;

          const dir = player.position.clone().sub(this.position.clone().setY(1.45)).normalize();
          const acc = this.baseAccuracy + dist * 0.004;
          dir.x += (Math.random() - 0.5) * acc;
          dir.y += (Math.random() - 0.5) * acc * 0.5;
          dir.z += (Math.random() - 0.5) * acc;
          dir.normalize();
          shot = { origin: this.position.clone().setY(1.45), direction: dir, weaponDef: this.weapon.def, shooter: this };
        }
      }
    }
    return shot;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.headMesh.geometry.dispose();
    this.headMesh.material.dispose();
  }
}

export function createBotTeam(scene, colliders, spawnPoints) {
  return spawnPoints.map((pos, i) => new Bot(i, scene, colliders, pos));
}

export function addKillFeed(killerName, victimName, weaponName) {
  const feed = document.getElementById('kill-feed');
  if (!feed) return;
  const entry = document.createElement('div');
  entry.className = 'kill-entry';
  entry.textContent = `${killerName} [${weaponName}] ${victimName}`;
  feed.prepend(entry);
  setTimeout(() => entry.remove(), 4000);
}
