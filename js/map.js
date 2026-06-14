import * as THREE from 'three';

/**
 * Haven Lite — Valorant-style map with structured lanes:
 *   Attacker Spawn → Mid → A Main / A Short → Site A
 *                      → B Main / B Short → Site B
 */
export function buildMap(scene) {
  const mapObjects = [];
  const colliders = [];

  // Zone palette (Valorant-inspired)
  const mats = {
    floorDefault: mat(0xc8cdd8, 0.88),
    floorSpawn: mat(0x2dd4bf, 0.75, 0x0fb5ae, 0.15),
    floorMid: mat(0xd4a574, 0.8, 0xffc940, 0.08),
    floorAMain: mat(0x7ec8a0, 0.78),
    floorASite: mat(0x3d9970, 0.7, 0x0fb5ae, 0.12),
    floorBMain: mat(0xc9956a, 0.78),
    floorBSite: mat(0xc45c4a, 0.7, 0xff4655, 0.1),
    wallConcrete: mat(0xa8b0bc, 0.82),
    wallDark: mat(0x5a6270, 0.85),
    wallAccent: mat(0xff4655, 0.55, 0xff4655, 0.25),
    wallTeal: mat(0x0fb5ae, 0.6, 0x0fb5ae, 0.2),
    wallGold: mat(0xffc940, 0.55, 0xffc940, 0.15),
    crate: mat(0x8899aa, 0.9),
    siteBox: mat(0xff4655, 0.5, 0xff4655, 0.35),
  };

  function mat(color, roughness, emissive = 0x000000, emissiveInt = 0) {
    return new THREE.MeshStandardMaterial({
      color, roughness, metalness: 0.05,
      emissive, emissiveIntensity: emissiveInt,
    });
  }

  function addBox(w, h, d, x, y, z, material, isCollider = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    mapObjects.push(mesh);
    if (isCollider) {
      colliders.push({
        min: { x: x - w / 2, y, z: z - d / 2 },
        max: { x: x + w / 2, y: y + h, z: z + d / 2 },
      });
    }
    return mesh;
  }

  function addFloor(w, d, x, z, material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.02, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    mapObjects.push(mesh);
  }

  function addWall(w, h, d, x, z, material) {
    return addBox(w, h, d, x, 0, z, material);
  }

  // ─── Base ground ───
  const baseGround = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    mats.floorDefault
  );
  baseGround.rotation.x = -Math.PI / 2;
  baseGround.receiveShadow = true;
  scene.add(baseGround);
  mapObjects.push(baseGround);

  // Outer boundary
  addWall(90, 6, 1, 0, -45, mats.wallDark);
  addWall(90, 6, 1, 0, 45, mats.wallDark);
  addWall(1, 6, 90, -45, 0, mats.wallDark);
  addWall(1, 6, 90, 45, 0, mats.wallDark);

  // ─── ATTACKER SPAWN (south) ───
  addFloor(16, 14, 0, 32, mats.floorSpawn);
  addWall(16, 4, 0.5, 0, 39, mats.wallTeal);          // back wall
  addWall(0.5, 4, 14, -8, 32, mats.wallTeal);          // west
  addWall(0.5, 4, 14, 8, 32, mats.wallTeal);           // east
  // north opening into spawn corridor (no wall)

  createAreaLabel(scene, mapObjects, 'ATTACKER SPAWN', 0, 4, 32, '#0fb5ae');

  // Spawn corridor → Mid
  addFloor(8, 18, 0, 15, mats.floorSpawn);
  addWall(0.5, 4, 18, -4.25, 15, mats.wallConcrete);   // west corridor wall
  addWall(0.5, 4, 18, 4.25, 15, mats.wallConcrete);    // east corridor wall

  const spawnPoint = new THREE.Vector3(0, 1.6, 30);

  // ─── MID ───
  addFloor(28, 22, 0, -2, mats.floorMid);
  addWall(28, 4, 0.5, 0, 9, mats.wallGold);            // south partial wall (cover)
  addWall(0.5, 4, 22, -14, -2, mats.wallConcrete);     // west mid wall
  addWall(0.5, 4, 22, 14, -2, mats.wallConcrete);     // east mid wall
  // Mid cover
  addBox(3, 1.4, 1.2, -4, 0, -4, mats.crate);
  addBox(3, 1.4, 1.2, 4, 0, -4, mats.crate);
  addBox(1.2, 1.4, 3, 0, 0, -8, mats.crate);
  addBox(2, 1.8, 2, -7, 0, 2, mats.wallDark);
  addBox(2, 1.8, 2, 7, 0, 2, mats.wallDark);

  createAreaLabel(scene, mapObjects, 'MID', 0, 5, -2, '#ffc940');

  // Mid → A Main connector (west door gap)
  addFloor(6, 8, -10, -2, mats.floorMid);
  // gap in west wall at mid for A route
  addWall(0.5, 4, 7, -14, -5.5, mats.wallConcrete);
  addWall(0.5, 4, 7, -14, 1.5, mats.wallConcrete);

  // Mid → B Main connector (east door gap)
  addFloor(6, 8, 10, -2, mats.floorMid);
  addWall(0.5, 4, 7, 14, -5.5, mats.wallConcrete);
  addWall(0.5, 4, 7, 14, 1.5, mats.wallConcrete);

  // ─── A MAIN (west lane) ───
  addFloor(8, 28, -22, -10, mats.floorAMain);
  addWall(0.5, 4, 28, -26, -10, mats.wallConcrete);    // outer west
  addWall(0.5, 4, 28, -18, -10, mats.wallConcrete);    // inner east (with gap at site)
  // door gap into A site
  addWall(0.5, 4, 10, -18, -20, mats.wallConcrete);
  addWall(0.5, 4, 8, -18, -6, mats.wallConcrete);
  addBox(2.5, 1.5, 1.5, -22, 0, -14, mats.crate);
  addBox(2.5, 1.5, 1.5, -22, 0, -6, mats.crate);

  createAreaLabel(scene, mapObjects, 'A MAIN', -22, 4, -10, '#0fb5ae');

  // ─── A SHORT (north-west flank) ───
  addFloor(14, 8, -8, -18, mats.floorAMain);
  addFloor(8, 10, -22, -22, mats.floorAMain);
  addWall(0.5, 4, 8, -1, -18, mats.wallConcrete);      // separator with gap
  addWall(14, 4, 0.5, -8, -22, mats.wallConcrete);
  addWall(0.5, 4, 10, -15, -22, mats.wallConcrete);
  addWall(0.5, 4, 10, -29, -22, mats.wallConcrete);
  // A short entrance gap in site wall (east side)
  addBox(2, 1.4, 2, -10, 0, -20, mats.crate);

  createAreaLabel(scene, mapObjects, 'A SHORT', -14, 4, -20, '#7ec8a0');

  // ─── SITE A (enclosed) ───
  addFloor(16, 14, -30, -28, mats.floorASite);
  addWall(16, 5, 0.5, -30, -35, mats.wallTeal);         // back
  addWall(0.5, 5, 14, -38, -28, mats.wallTeal);        // west
  addWall(0.5, 5, 14, -22, -28, mats.wallTeal);        // east (gaps for entries)
  addWall(0.5, 5, 5, -22, -23, mats.wallTeal);         // east lower (A short gap)
  addWall(0.5, 5, 5, -22, -33, mats.wallTeal);         // east upper
  // A main entrance (south) — gap in south wall
  addWall(5, 5, 0.5, -35, -21, mats.wallTeal);
  addWall(5, 5, 0.5, -25, -21, mats.wallTeal);
  // Site cover
  addBox(2.5, 2.5, 2.5, -33, 0, -31, mats.siteBox);
  addBox(3, 1.5, 1.5, -27, 0, -26, mats.crate);
  addBox(1.5, 1.5, 3, -30, 0, -33, mats.crate);

  createSiteLabel(scene, mapObjects, 'A', -30, 4.5, -28);
  createAreaLabel(scene, mapObjects, 'SITE A', -30, 3, -24, '#0fb5ae');

  const plantSites = {
    A: { center: new THREE.Vector3(-30, 0, -28), radius: 5.5, label: 'A' },
    B: { center: new THREE.Vector3(30, 0, -28), radius: 5.5, label: 'B' },
  };

  // ─── B MAIN (east lane) ───
  addFloor(8, 28, 22, -10, mats.floorBMain);
  addWall(0.5, 4, 28, 26, -10, mats.wallConcrete);
  addWall(0.5, 4, 28, 18, -10, mats.wallConcrete);
  addWall(0.5, 4, 10, 18, -20, mats.wallConcrete);
  addWall(0.5, 4, 8, 18, -6, mats.wallConcrete);
  addBox(2.5, 1.5, 1.5, 22, 0, -14, mats.crate);
  addBox(2.5, 1.5, 1.5, 22, 0, -6, mats.crate);

  createAreaLabel(scene, mapObjects, 'B MAIN', 22, 4, -10, '#ff4655');

  // ─── B SHORT (north-east flank) ───
  addFloor(14, 8, 8, -18, mats.floorBMain);
  addFloor(8, 10, 22, -22, mats.floorBMain);
  addWall(0.5, 4, 8, 1, -18, mats.wallConcrete);
  addWall(14, 4, 0.5, 8, -22, mats.wallConcrete);
  addWall(0.5, 4, 10, 15, -22, mats.wallConcrete);
  addWall(0.5, 4, 10, 29, -22, mats.wallConcrete);
  addBox(2, 1.4, 2, 10, 0, -20, mats.crate);

  createAreaLabel(scene, mapObjects, 'B SHORT', 14, 4, -20, '#c9956a');

  // ─── SITE B (enclosed) ───
  addFloor(16, 14, 30, -28, mats.floorBSite);
  addWall(16, 5, 0.5, 30, -35, mats.wallAccent);
  addWall(0.5, 5, 14, 38, -28, mats.wallAccent);
  addWall(0.5, 5, 14, 22, -28, mats.wallAccent);
  addWall(0.5, 5, 5, 22, -23, mats.wallAccent);
  addWall(0.5, 5, 5, 22, -33, mats.wallAccent);
  addWall(5, 5, 0.5, 25, -21, mats.wallAccent);
  addWall(5, 5, 0.5, 35, -21, mats.wallAccent);
  addBox(2.5, 2.5, 2.5, 33, 0, -31, mats.siteBox);
  addBox(3, 1.5, 1.5, 27, 0, -26, mats.crate);
  addBox(1.5, 1.5, 3, 30, 0, -33, mats.crate);

  createSiteLabel(scene, mapObjects, 'B', 30, 4.5, -28);
  createAreaLabel(scene, mapObjects, 'SITE B', 30, 3, -24, '#ff4655');

  // ─── DEFENDER BACK / link between sites ───
  addFloor(40, 8, 0, -38, mats.floorDefault);
  addWall(40, 4, 0.5, 0, -42, mats.wallDark);
  addBox(4, 1.5, 2, -5, 0, -38, mats.crate);
  addBox(4, 1.5, 2, 5, 0, -38, mats.crate);

  createAreaLabel(scene, mapObjects, 'DEFENDER SPAWN', 0, 4, -40, '#ff4655');

  // Decorative ceiling beams in sites (visual only)
  addBox(14, 0.3, 0.4, -30, 4.5, -28, mats.wallGold, false);
  addBox(14, 0.3, 0.4, 30, 4.5, -28, mats.wallGold, false);

  // ─── Lighting ───
  const hemi = new THREE.HemisphereLight(0xc8e0ff, 0x909880, 0.7);
  scene.add(hemi);
  mapObjects.push(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  mapObjects.push(ambient);

  const sun = new THREE.DirectionalLight(0xfff8f0, 1.25);
  sun.position.set(25, 55, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 100;
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  scene.add(sun);
  mapObjects.push(sun);

  // Zone accent point lights
  addZoneLight(scene, mapObjects, 0x0fb5ae, -30, 6, -28, 0.4);  // Site A
  addZoneLight(scene, mapObjects, 0xff4655, 30, 6, -28, 0.4);   // Site B
  addZoneLight(scene, mapObjects, 0xffc940, 0, 7, -2, 0.35);     // Mid

  return {
    mapObjects,
    colliders,
    plantSites,
    spawnPoint,
    defenderSpawns: getDefenderSpawns(),
    patrolPoints: getPatrolPoints(),
  };
}

function addZoneLight(scene, mapObjects, color, x, y, z, intensity) {
  const light = new THREE.PointLight(color, intensity, 22);
  light.position.set(x, y, z);
  scene.add(light);
  mapObjects.push(light);
}

function createSiteLabel(scene, mapObjects, text, x, y, z) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff4655';
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5), mat);
  plane.position.set(x, y, z);
  scene.add(plane);
  mapObjects.push(plane);
}

function createAreaLabel(scene, mapObjects, text, x, y, z, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), mat);
  plane.position.set(x, y, z);
  scene.add(plane);
  mapObjects.push(plane);
}

function getDefenderSpawns() {
  return [
    new THREE.Vector3(-30, 1.6, -32),
    new THREE.Vector3(30, 1.6, -32),
    new THREE.Vector3(-30, 1.6, -24),
    new THREE.Vector3(30, 1.6, -24),
    new THREE.Vector3(0, 1.6, -38),
  ];
}

export function getPatrolPoints() {
  return [
    new THREE.Vector3(0, 1.6, -2),      // Mid
    new THREE.Vector3(-22, 1.6, -10),   // A Main
    new THREE.Vector3(-14, 1.6, -20), // A Short
    new THREE.Vector3(-30, 1.6, -28), // Site A
    new THREE.Vector3(22, 1.6, -10),  // B Main
    new THREE.Vector3(14, 1.6, -20),  // B Short
    new THREE.Vector3(30, 1.6, -28),  // Site B
    new THREE.Vector3(0, 1.6, 15),      // Spawn corridor
  ];
}

export function resolveCollision(pos, colliders, radius = 0.4) {
  const result = pos.clone();
  for (const c of colliders) {
    const closest = new THREE.Vector3(
      Math.max(c.min.x, Math.min(result.x, c.max.x)),
      Math.max(c.min.y, Math.min(result.y, c.max.y)),
      Math.max(c.min.z, Math.min(result.z, c.max.z))
    );
    const dist = result.distanceTo(closest);
    if (dist < radius && dist > 0) {
      const push = result.clone().sub(closest).normalize().multiplyScalar(radius - dist);
      result.add(push);
    }
    if (result.x > c.min.x - radius && result.x < c.max.x + radius &&
        result.z > c.min.z - radius && result.z < c.max.z + radius &&
        result.y < c.max.y && result.y > c.min.y - 1) {
      const dx = Math.min(Math.abs(result.x - c.min.x), Math.abs(result.x - c.max.x));
      const dz = Math.min(Math.abs(result.z - c.min.z), Math.abs(result.z - c.max.z));
      if (dx < dz) {
        result.x = result.x < (c.min.x + c.max.x) / 2 ? c.min.x - radius : c.max.x + radius;
      } else {
        result.z = result.z < (c.min.z + c.max.z) / 2 ? c.min.z - radius : c.max.z + radius;
      }
    }
  }
  result.y = Math.max(1.6, result.y);
  return result;
}

export function checkLineOfSight(from, to, colliders) {
  const dir = to.clone().sub(from);
  const dist = dir.length();
  dir.normalize();
  const step = 0.5;
  for (let d = 0; d < dist; d += step) {
    const p = from.clone().add(dir.clone().multiplyScalar(d));
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
