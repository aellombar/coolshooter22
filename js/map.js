import * as THREE from 'three';

/**
 * Haven Lite — clear Valorant-style callouts with walkable routes:
 *
 *   Attacker Spawn
 *        |
 *      Mid
 *    /   |   \
 * A Main  |  B Main
 *    \    |    /
 *   A Short B Short
 *      \  |  /
 *    Site A  Site B
 */
export function buildMap(scene) {
  const mapObjects = [];
  const wallMeshes = [];
  const colliders = [];

  const mats = {
    floor: mat(0xbfc5d0),
    spawn: mat(0x3dd6c8, 0.7, 0x0fb5ae, 0.12),
    mid: mat(0xe8c07a, 0.75, 0xffc940, 0.06),
    aLane: mat(0x6ecf9a, 0.75),
    aSite: mat(0x2d9968, 0.7, 0x0fb5ae, 0.1),
    bLane: mat(0xe0a060, 0.75),
    bSite: mat(0xd05040, 0.7, 0xff4655, 0.1),
    wall: mat(0x98a2b0, 0.85),
    wallA: mat(0x0fb5ae, 0.55, 0x0fb5ae, 0.15),
    wallB: mat(0xff4655, 0.55, 0xff4655, 0.15),
    crate: mat(0x788898, 0.9),
    box: mat(0xff4655, 0.5, 0xff4655, 0.3),
  };

  function mat(color, roughness = 0.85, emissive = 0x000000, emissiveInt = 0) {
    return new THREE.MeshStandardMaterial({
      color, roughness, metalness: 0.05,
      emissive, emissiveIntensity: emissiveInt,
    });
  }

  function brightMat(color) {
    return new THREE.MeshLambertMaterial({ color });
  }

  function wall(w, h, d, x, y, z, m) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.blocker = true;
    scene.add(mesh);
    mapObjects.push(mesh);
    wallMeshes.push(mesh);
    colliders.push({
      min: { x: x - w / 2, y, z: z - d / 2 },
      max: { x: x + w / 2, y: y + h, z: z + d / 2 },
    });
  }

  function floor(w, d, x, z, m) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.01, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    mapObjects.push(mesh);
  }

  // Use Lambert (lit, no PBR issues) for floors so they're always visible
  const floorMats = {
    floor: brightMat(0xbfc5d0),
    spawn: brightMat(0x3dd6c8),
    mid: brightMat(0xe8c07a),
    aLane: brightMat(0x6ecf9a),
    aSite: brightMat(0x2d9968),
    bLane: brightMat(0xe0a060),
    bSite: brightMat(0xd05040),
  };

  function crate(w, h, d, x, z) {
    wall(w, h, d, x, 0, z, mats.crate);
  }

  function cover(w, h, d, x, z, m = mats.crate) {
    wall(w, h, d, x, 0, z, m);
  }

  function halfWall(w, h, d, x, y, z, m = mats.wall) {
    wall(w, h, d, x, y, z, m);
  }

  // ── Ground & bounds ──
  floor(100, 100, 0, 0, floorMats.floor);
  wall(100, 6, 1, 0, 0, 50, mats.wall);   // south
  wall(100, 6, 1, 0, 0, -50, mats.wall);  // north
  wall(1, 6, 100, -50, 0, 0, mats.wall); // west
  wall(1, 6, 100, 50, 0, 0, mats.wall);  // east

  const spawnPoint = new THREE.Vector3(0, 1.6, 34);

  // Buy-phase barrier — blocks spawn exit until buy time ends
  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0xff4655, transparent: true, opacity: 0.35,
    emissive: 0xff4655, emissiveIntensity: 0.25,
  });
  const buyBarrierMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 0.4), barrierMat);
  buyBarrierMesh.position.set(0, 2.25, 27.8);
  buyBarrierMesh.visible = false;
  scene.add(buyBarrierMesh);
  const buyBarrierCollider = {
    min: { x: -3, y: 0, z: 27.6 },
    max: { x: 3, y: 4.5, z: 28.0 },
  };

  // ── ATTACKER SPAWN (south) ──
  floor(20, 12, 0, 34, floorMats.spawn);
  floor(8, 8, 0, 34, brightMat(0x2a9d8f)); // buy zone marker
  wall(20, 4, 0.5, 0, 0, 40.5, mats.wallA);
  wall(0.5, 4, 12, -10, 0, 34, mats.wallA);
  wall(0.5, 4, 12, 10, 0, 34, mats.wallA);
  cover(2, 1.2, 1, -4, 36, mats.box);
  cover(2, 1.2, 1, 4, 36, mats.box);
  label(scene, mapObjects, 'ATTACKER SPAWN · BUY ZONE', 0, 4, 34, '#0fb5ae');

  // ── SPAWN → MID corridor (6 units wide) ──
  floor(6, 22, 0, 17, floorMats.spawn);
  wall(0.5, 4, 22, -3.25, 0, 17, mats.wall);
  wall(0.5, 4, 22, 3.25, 0, 17, mats.wall);

  // ── MID (open 26 × 18) ──
  floor(26, 18, 0, -2, floorMats.mid);
  wall(8, 3, 0.5, -7, 0, 7, mats.wall);
  wall(8, 3, 0.5, 7, 0, 7, mats.wall);
  // Mid cubbies (Valorant-style cover)
  halfWall(3, 2.5, 0.4, -9, 0, -2, mats.wall);
  halfWall(3, 2.5, 0.4, 9, 0, -2, mats.wall);
  halfWall(0.4, 2.5, 3, -11, 0, -5, mats.wall);
  halfWall(0.4, 2.5, 3, 11, 0, -5, mats.wall);
  crate(3, 1.3, 1.2, -5, -2);
  crate(3, 1.3, 1.2, 5, -2);
  crate(1.2, 1.3, 3, 0, -6);
  crate(2.5, 1.5, 1.5, -3, 2);
  crate(2.5, 1.5, 1.5, 3, 2);
  cover(4, 0.3, 4, 0, -2, brightMat(0xd4a843)); // mid control pad
  label(scene, mapObjects, 'MID', 0, 5, -2, '#ffc940');

  // ── A MAIN: mid west exit → site A (corridor 6 wide) ──
  floor(6, 14, -12, -2, floorMats.aLane);
  floor(6, 16, -22, -14, floorMats.aLane);
  wall(0.5, 4, 14, -15.25, 0, -2, mats.wall); // west outer
  wall(0.5, 4, 14, -8.75, 0, -2, mats.wall);  // east inner (mid side)
  wall(0.5, 4, 16, -25.25, 0, -14, mats.wall);
  wall(0.5, 4, 16, -18.75, 0, -14, mats.wall);
  // mid west wall with 6-unit door gap (already open between -3 and 3 at x=-13)
  wall(0.5, 4, 5, -13, 0, 4, mats.wall);
  wall(0.5, 4, 5, -13, 0, -8, mats.wall);
  crate(2, 1.3, 1.5, -22, -6);
  crate(2, 1.3, 1.5, -18, -10);
  cover(2, 2, 1.2, -20, -4, mats.box);
  cover(1.5, 1.5, 1.5, -14, -6, mats.crate);
  label(scene, mapObjects, 'A MAIN', -22, 4, -8, '#0fb5ae');

  // ── A SHORT: mid northwest → site A east door ──
  floor(10, 6, -6, -12, floorMats.aLane);
  floor(6, 10, -16, -20, floorMats.aLane);
  wall(0.5, 4, 6, -1, 0, -12, mats.wall);
  wall(0.5, 4, 6, -11, 0, -12, mats.wall);
  wall(10, 4, 0.5, -6, 0, -15.5, mats.wall);
  wall(0.5, 4, 10, -19, 0, -20, mats.wall);
  cover(1.5, 1.2, 1.5, -8, -14, mats.crate);
  cover(1.5, 1.2, 1.5, -12, -18, mats.crate);
  label(scene, mapObjects, 'A SHORT', -10, 4, -16, '#6ecf9a');

  // ── SITE A (room 16×14) — doors south (A Main) + east (A Short) ──
  floor(16, 14, -26, -24, floorMats.aSite);
  wall(16, 5, 0.5, -26, 0, -31.5, mats.wallA); // north back
  wall(0.5, 5, 14, -34.5, 0, -24, mats.wallA); // west
  // east wall — gap for A Short (z -20 to -28)
  wall(0.5, 5, 4, -17.5, 0, -19, mats.wallA);
  wall(0.5, 5, 6, -17.5, 0, -27, mats.wallA);
  // south wall — 6-unit door for A Main (center x=-26)
  wall(4, 5, 0.5, -31, 0, -17.5, mats.wallA);
  wall(4, 5, 0.5, -21, 0, -17.5, mats.wallA);
  wall(2.5, 2.2, 2.5, -29, 0, -26, mats.box);
  wall(3, 1.8, 3, -23, 0, -28, mats.box); // default plant box
  crate(2, 1.3, 1.5, -23, -22);
  crate(2, 1.3, 1.5, -29, -20);
  halfWall(0.4, 3, 4, -30, 0, -24, mats.wallA);
  halfWall(0.4, 3, 4, -22, 0, -24, mats.wallA);
  cover(4, 0.25, 4, -26, -24, brightMat(0x0fb5ae));
  siteLabel(scene, mapObjects, 'A', -26, 4, -24);
  label(scene, mapObjects, 'SITE A', -26, 3, -20, '#0fb5ae');

  const plantSites = {
    A: { center: new THREE.Vector3(-26, 0, -24), radius: 8, label: 'A' },
    B: { center: new THREE.Vector3(26, 0, -24), radius: 8, label: 'B' },
  };

  // ── B MAIN: mid east → site B ──
  floor(6, 14, 12, -2, floorMats.bLane);
  floor(6, 16, 22, -14, floorMats.bLane);
  wall(0.5, 4, 14, 15.25, 0, -2, mats.wall);
  wall(0.5, 4, 14, 8.75, 0, -2, mats.wall);
  wall(0.5, 4, 16, 25.25, 0, -14, mats.wall);
  wall(0.5, 4, 16, 18.75, 0, -14, mats.wall);
  wall(0.5, 4, 5, 13, 0, 4, mats.wall);
  wall(0.5, 4, 5, 13, 0, -8, mats.wall);
  crate(2, 1.3, 1.5, 22, -6);
  crate(2, 1.3, 1.5, 18, -10);
  cover(2, 2, 1.2, 20, -4, mats.box);
  cover(1.5, 1.5, 1.5, 14, -6, mats.crate);
  label(scene, mapObjects, 'B MAIN', 22, 4, -8, '#ff4655');

  // ── B SHORT: mid northeast → site B west door ──
  floor(10, 6, 6, -12, floorMats.bLane);
  floor(6, 10, 16, -20, floorMats.bLane);
  wall(0.5, 4, 6, 1, 0, -12, mats.wall);
  wall(0.5, 4, 6, 11, 0, -12, mats.wall);
  wall(10, 4, 0.5, 6, 0, -15.5, mats.wall);
  wall(0.5, 4, 10, 19, 0, -20, mats.wall);
  cover(1.5, 1.2, 1.5, 8, -14, mats.crate);
  cover(1.5, 1.2, 1.5, 12, -18, mats.crate);
  label(scene, mapObjects, 'B SHORT', 10, 4, -16, '#e0a060');

  // ── SITE B — doors south (B Main) + west (B Short) ──
  floor(16, 14, 26, -24, floorMats.bSite);
  wall(16, 5, 0.5, 26, 0, -31.5, mats.wallB);
  wall(0.5, 5, 14, 34.5, 0, -24, mats.wallB);
  wall(0.5, 5, 4, 17.5, 0, -19, mats.wallB);
  wall(0.5, 5, 6, 17.5, 0, -27, mats.wallB);
  wall(4, 5, 0.5, 21, 0, -17.5, mats.wallB);
  wall(4, 5, 0.5, 31, 0, -17.5, mats.wallB);
  wall(2.5, 2.2, 2.5, 29, 0, -26, mats.box);
  wall(3, 1.8, 3, 23, 0, -28, mats.box);
  crate(2, 1.3, 1.5, 23, -22);
  crate(2, 1.3, 1.5, 29, -20);
  halfWall(0.4, 3, 4, 30, 0, -24, mats.wallB);
  halfWall(0.4, 3, 4, 22, 0, -24, mats.wallB);
  cover(4, 0.25, 4, 26, -24, brightMat(0xff4655));
  siteLabel(scene, mapObjects, 'B', 26, 4, -24);
  label(scene, mapObjects, 'SITE B', 26, 3, -20, '#ff4655');

  // ── Defender spawn (north, between sites) ──
  floor(30, 8, 0, -40, floorMats.floor);
  wall(30, 4, 0.5, 0, 0, -44, mats.wall);
  label(scene, mapObjects, 'DEFENDERS', 0, 4, -40, '#ff4655');

  // ── Lighting (strong so map is always visible) ──
  scene.add(new THREE.HemisphereLight(0xd0e4ff, 0x808870, 1.0));
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const sun = new THREE.DirectionalLight(0xfff8f0, 1.4);
  sun.position.set(20, 50, 15);
  scene.add(sun);

  for (const [c, x, z] of [[0x0fb5ae, -26, -24], [0xff4655, 26, -24], [0xffc940, 0, -2]]) {
    const pl = new THREE.PointLight(c, 0.45, 24);
    pl.position.set(x, 6, z);
    scene.add(pl);
  }

  return {
    mapObjects,
    wallMeshes,
    colliders,
    plantSites,
    spawnPoint,
    defenderSpawns: getDefenderSpawns(),
    buyBarrierMesh,
    buyBarrierCollider,
    spawnBounds: { minX: -9, maxX: 9, minZ: 28.5, maxZ: 41 },
  };
}

function label(scene, objs, text, x, y, z, color = '#fff') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 32);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), m);
  p.position.set(x, y, z);
  scene.add(p);
  objs.push(p);
}

function siteLabel(scene, objs, text, x, y, z) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff4655';
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5), m);
  p.position.set(x, y, z);
  scene.add(p);
  objs.push(p);
}

function getDefenderSpawns() {
  return [
    new THREE.Vector3(-26, 1.6, -28),
    new THREE.Vector3(26, 1.6, -28),
    new THREE.Vector3(-26, 1.6, -20),
    new THREE.Vector3(26, 1.6, -20),
    new THREE.Vector3(0, 1.6, -38),
  ];
}

export function getPatrolPoints() {
  return [
    new THREE.Vector3(0, 1.6, -2),
    new THREE.Vector3(-22, 1.6, -14),
    new THREE.Vector3(-10, 1.6, -16),
    new THREE.Vector3(-26, 1.6, -24),
    new THREE.Vector3(22, 1.6, -14),
    new THREE.Vector3(10, 1.6, -16),
    new THREE.Vector3(26, 1.6, -24),
    new THREE.Vector3(0, 1.6, 17),
  ];
}

/** Slide collision — pushes player out of walls without trapping in doorways. */
export function resolveCollision(pos, colliders, radius = 0.35) {
  const result = pos.clone();

  for (let pass = 0; pass < 4; pass++) {
    for (const c of colliders) {
      if (result.y > c.max.y + 0.5 || result.y < c.min.y - 1.5) continue;

      const closestX = Math.max(c.min.x, Math.min(result.x, c.max.x));
      const closestZ = Math.max(c.min.z, Math.min(result.z, c.max.z));
      const dx = result.x - closestX;
      const dz = result.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius && distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const push = (radius - dist) / dist;
        result.x += dx * push;
        result.z += dz * push;
      } else if (distSq === 0) {
        // Inside wall footprint — push out on smallest axis
        const toLeft = result.x - c.min.x;
        const toRight = c.max.x - result.x;
        const toFront = result.z - c.min.z;
        const toBack = c.max.z - result.z;
        const min = Math.min(toLeft, toRight, toFront, toBack);
        if (min === toLeft) result.x = c.min.x - radius;
        else if (min === toRight) result.x = c.max.x + radius;
        else if (min === toFront) result.z = c.min.z - radius;
        else result.z = c.max.z + radius;
      }
    }
  }

  return result;
}

export function checkLineOfSight(from, to, colliders) {
  const dir = to.clone().sub(from);
  const dist = dir.length();
  if (dist < 0.01) return true;
  dir.normalize();
  for (let d = 0.5; d < dist; d += 0.5) {
    const p = from.clone().addScaledVector(dir, d);
    for (const c of colliders) {
      if (p.x > c.min.x && p.x < c.max.x && p.y > c.min.y && p.y < c.max.y && p.z > c.min.z && p.z < c.max.z) {
        return false;
      }
    }
  }
  return true;
}

export function getNearestPlantSite(pos, plantSites) {
  let nearest = null;
  let minDist = Infinity;
  for (const key of ['A', 'B']) {
    const site = plantSites[key];
    const d = pos.distanceTo(site.center);
    if (d < site.radius && d < minDist) {
      minDist = d;
      nearest = site;
    }
  }
  return nearest;
}
