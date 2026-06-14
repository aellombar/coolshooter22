import * as THREE from 'three';
import { createWeaponState, getWeapon, canFire, fireWeapon, getRecoilOffset } from './weapons.js';
import { resolveCollision, checkLineOfSight } from './map.js';

const BOT_NAMES = ['Jett', 'Reyna', 'Phoenix', 'Raze', 'Sage'];

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
    this.target = null;
    this.state = 'patrol'; // patrol, chase, shoot
    this.patrolTarget = new THREE.Vector3();
    this.pickPatrolTarget();

    this.weapon = createWeaponState('vandal');
    this.weapon.ammo = 25;
    this.lastShotTime = 0;
    this.reactionTime = 0.3 + Math.random() * 0.4;
    this.accuracy = 0.15 + Math.random() * 0.15;
    this.seeRange = 40;
    this.shootRange = 30;

    // Visual mesh
    const bodyGeo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff4655 });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.position.copy(this.position);
    this.mesh.position.y = 0.9;
    this.mesh.castShadow = true;

    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xcc3344 });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 1.15;
    this.mesh.add(this.headMesh);

    scene.add(this.mesh);
  }

  pickPatrolTarget() {
    const points = [
      new THREE.Vector3(-35, 1.6, -35),
      new THREE.Vector3(35, 1.6, -35),
      new THREE.Vector3(0, 1.6, -20),
      new THREE.Vector3(-15, 1.6, -35),
      new THREE.Vector3(15, 1.6, -35),
      new THREE.Vector3(0, 1.6, -50),
    ];
    this.patrolTarget.copy(points[Math.floor(Math.random() * points.length)]);
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
  }

  takeDamage(amount, hitZone = 'body') {
    if (!this.alive) return;
    const def = getWeapon('vandal');
    let dmg = amount;
    if (hitZone === 'head') dmg = amount;
    else if (hitZone === 'leg') dmg = amount * 0.75;

    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.66);
      this.armor -= absorbed;
      dmg -= absorbed * 0.66;
    }
    this.health -= dmg;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.mesh.visible = false;
    }
  }

  update(dt, player, colliders) {
    if (!this.alive) return null;

    const distToPlayer = this.position.distanceTo(player.position);
    const canSee = distToPlayer < this.seeRange &&
      checkLineOfSight(
        this.position.clone().setY(1.4),
        player.position.clone(),
        colliders
      );

    if (canSee) {
      this.state = distToPlayer < this.shootRange ? 'shoot' : 'chase';
      this.target = player.position.clone();
    } else if (this.state !== 'patrol') {
      this.state = 'patrol';
    }

    // Look at target
    if (this.target) {
      const dx = this.target.x - this.position.x;
      const dz = this.target.z - this.position.z;
      this.yaw = Math.atan2(-dx, -dz);
    }

    const speed = 3.5;
    if (this.state === 'chase' && this.target) {
      const dir = this.target.clone().sub(this.position).setY(0);
      if (dir.length() > 2) {
        dir.normalize().multiplyScalar(speed * dt);
        this.position.add(dir);
        this.position = resolveCollision(this.position, this.colliders);
      }
    } else if (this.state === 'patrol') {
      const dir = this.patrolTarget.clone().sub(this.position).setY(0);
      if (dir.length() < 2) {
        this.pickPatrolTarget();
      } else {
        dir.normalize().multiplyScalar(speed * 0.6 * dt);
        this.position.add(dir);
        this.position = resolveCollision(this.position, this.colliders);
      }
    }

    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
    this.mesh.rotation.y = this.yaw;

    // Shoot at player
    let shot = null;
    if (this.state === 'shoot' && canSee) {
      const now = performance.now() / 1000;
      if (canFire(this.weapon, now)) {
        fireWeapon(this.weapon, now);
        const dir = player.position.clone().sub(this.position.clone().setY(1.4)).normalize();
        // Add inaccuracy
        dir.x += (Math.random() - 0.5) * this.accuracy;
        dir.y += (Math.random() - 0.5) * this.accuracy * 0.5;
        dir.z += (Math.random() - 0.5) * this.accuracy;
        dir.normalize();

        shot = {
          origin: this.position.clone().setY(1.4),
          direction: dir,
          damage: this.weapon.def.damage,
          shooter: this,
        };
      }
    }

    return shot;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
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
