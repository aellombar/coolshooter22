import * as THREE from 'three';

/**
 * Haven Lite — simplified 3-site map layout with 2 playable plant sites (A & B).
 * Site C area exists visually but only A/B are active for planting.
 */
export function buildMap(scene) {
  const mapObjects = [];
  const colliders = [];
  const plantSites = {};

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x6a7585, roughness: 0.85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a95a5, roughness: 0.8 });
  const siteAMat = new THREE.MeshStandardMaterial({ color: 0x3a7560, roughness: 0.75 });
  const siteBMat = new THREE.MeshStandardMaterial({ color: 0x756040, roughness: 0.75 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xff4655, roughness: 0.6, emissive: 0xff4655, emissiveIntensity: 0.3 });
  const spawnMat = new THREE.MeshStandardMaterial({ color: 0x0fb5ae, roughness: 0.8 });

  function addBox(w, h, d, x, y, z, mat, isCollider = true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    mapObjects.push(mesh);
    if (isCollider) {
      colliders.push({ min: { x: x - w / 2, y, z: z - d / 2 }, max: { x: x + w / 2, y: y + h, z: z + d / 2 } });
    }
    return mesh;
  }

  // Ground
  const groundGeo = new THREE.PlaneGeometry(120, 120);
  const ground = new THREE.Mesh(groundGeo, floorMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  mapObjects.push(ground);

  // Outer walls
  addBox(120, 8, 1, 0, 0, -60, wallMat);
  addBox(120, 8, 1, 0, 0, 60, wallMat);
  addBox(1, 8, 120, -60, 0, 0, wallMat);
  addBox(1, 8, 120, 60, 0, 0, wallMat);

  // Attacker spawn (south)
  addBox(20, 0.2, 10, 0, 0, 50, spawnMat, false);
  const spawnPoint = new THREE.Vector3(0, 1.6, 45);

  // Mid area
  addBox(30, 4, 2, 0, 0, 0, wallMat); // mid wall
  addBox(2, 4, 20, 0, 0, -10, wallMat); // mid connector

  // Site A (west) — large box site
  addBox(18, 5, 18, -35, 0, -35, wallMat);
  addBox(16, 0.15, 16, -35, 0.05, -35, siteAMat, false);
  addBox(4, 3, 0.5, -35, 0, -26, wallMat); // site A entrance
  addBox(0.5, 3, 8, -26, 0, -35, wallMat);
  // A site default box
  addBox(2, 2, 2, -38, 0, -38, accentMat, false);

  plantSites.A = {
    center: new THREE.Vector3(-35, 0, -35),
    radius: 6,
    label: 'A',
  };

  // Site B (east)
  addBox(18, 5, 18, 35, 0, -35, wallMat);
  addBox(16, 0.15, 16, 35, 0.05, -35, siteBMat, false);
  addBox(4, 3, 0.5, 35, 0, -26, wallMat);
  addBox(0.5, 3, 8, 26, 0, -35, wallMat);
  addBox(2, 2, 2, 38, 0, -38, accentMat, false);

  plantSites.B = {
    center: new THREE.Vector3(35, 0, -35),
    radius: 6,
    label: 'B',
  };

  // Connector paths
  addBox(8, 3, 30, -15, 0, -35, wallMat);
  addBox(8, 3, 30, 15, 0, -35, wallMat);

  // Cover boxes throughout
  const covers = [
    [-10, -15, 3, 2, 1.2], [10, -15, 3, 2, 1.2],
    [-20, -5, 2, 2, 1.2], [20, -5, 2, 2, 1.2],
    [0, -20, 4, 1.5, 1.2], [-35, -20, 2, 3, 1.5],
    [35, -20, 2, 3, 1.5], [0, 10, 6, 1.5, 1.2],
    [-15, 25, 3, 2, 1.2], [15, 25, 3, 2, 1.2],
    [-40, -15, 2, 2, 1.5], [40, -15, 2, 2, 1.5],
  ];
  for (const [x, z, w, d, h] of covers) {
    addBox(w, h, d, x, 0, z, wallMat);
  }

  // Defender spawn markers (north, near sites)
  addBox(15, 0.2, 8, 0, 0, -52, new THREE.MeshStandardMaterial({ color: 0xff4655, roughness: 0.8 }), false);

  // Site labels (3D text planes)
  createSiteLabel(scene, mapObjects, 'A', -35, 3, -35);
  createSiteLabel(scene, mapObjects, 'B', 35, 3, -35);

  // Lighting — bright, outdoor feel
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x8a9080, 0.65);
  scene.add(hemi);
  mapObjects.push(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);
  mapObjects.push(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e8, 1.2);
  sun.position.set(40, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);
  mapObjects.push(sun);

  return { mapObjects, colliders, plantSites, spawnPoint, defenderSpawns: getDefenderSpawns() };
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
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), mat);
  plane.position.set(x, y, z);
  scene.add(plane);
  mapObjects.push(plane);
}

function getDefenderSpawns() {
  return [
    new THREE.Vector3(-35, 1.6, -48),
    new THREE.Vector3(35, 1.6, -48),
    new THREE.Vector3(-10, 1.6, -50),
    new THREE.Vector3(10, 1.6, -50),
    new THREE.Vector3(0, 1.6, -55),
  ];
}

/**
 * Simple AABB collision resolution for player movement.
 */
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
    // Simple XZ clamp for walls
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
