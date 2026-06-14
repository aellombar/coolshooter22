import * as THREE from 'three';

const MAX_DECALS = 180;
const decalGeo = new THREE.CircleGeometry(0.045, 10);

/**
 * Dark bullet impact marks on walls.
 */
export class BulletDecalManager {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
  }

  add(point, normal) {
    while (this.pool.length >= MAX_DECALS) {
      const old = this.pool.shift();
      this.scene.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }

    const mat = new THREE.MeshBasicMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(decalGeo, mat);
    const n = normal.clone().normalize();
    mesh.position.copy(point).addScaledVector(n, 0.02);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    mesh.rotateZ(Math.random() * Math.PI * 2);
    this.scene.add(mesh);
    this.pool.push(mesh);
  }
}

/** First wall hit along a shot ray (for decals). */
export function raycastWallHit(origin, direction, wallMeshes, maxDist = 150) {
  if (!wallMeshes?.length) return null;
  const dir = direction.clone().normalize();
  const raycaster = new THREE.Raycaster(origin, dir, 0.05, maxDist);
  raycaster.camera = null;
  for (const mesh of wallMeshes) mesh.updateMatrixWorld?.(true);
  const hits = raycaster.intersectObjects(wallMeshes, false);
  if (hits.length === 0) return null;
  const hit = hits[0];
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  return { point: hit.point, normal, distance: hit.distance };
}
