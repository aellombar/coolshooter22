import * as THREE from 'three';

const WEAPON_SHAPES = {
  classic: { barrel: 0.04, length: 0.22, height: 0.1, color: 0x888888 },
  ghost: { barrel: 0.035, length: 0.24, height: 0.09, color: 0x666688 },
  sheriff: { barrel: 0.05, length: 0.3, height: 0.12, color: 0x886644 },
  stinger: { barrel: 0.035, length: 0.38, height: 0.1, color: 0x668866 },
  spectre: { barrel: 0.04, length: 0.42, height: 0.11, color: 0x556677 },
  bulldog: { barrel: 0.045, length: 0.48, height: 0.12, color: 0x776655 },
  guardian: { barrel: 0.05, length: 0.55, height: 0.13, color: 0x887766 },
  vandal: { barrel: 0.045, length: 0.58, height: 0.12, color: 0x884444 },
  phantom: { barrel: 0.045, length: 0.56, height: 0.12, color: 0x446688 },
  marshal: { barrel: 0.04, length: 0.72, height: 0.1, color: 0x667755 },
  operator: { barrel: 0.055, length: 0.85, height: 0.13, color: 0x555555 },
};

const DEFAULT_SHAPE = { barrel: 0.04, length: 0.4, height: 0.11, color: 0x777777 };

/**
 * First-person view model attached to camera (Valorant-style lower-right hold).
 */
export class ViewModel {
  constructor(camera, scene) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.layers.set(1);
    camera.add(this.group);

    this.basePos = new THREE.Vector3(0.22, -0.18, -0.35);
    this.baseRot = new THREE.Euler(-0.05, 0.08, 0.02);
    this.recoilOffset = 0;
    this.bobTime = 0;

    this._buildModel('classic');
  }

  _buildModel(weaponId) {
    while (this.group.children.length) {
      const c = this.group.children[0];
      this.group.remove(c);
      c.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose?.();
      });
    }

    const shape = WEAPON_SHAPES[weaponId] || DEFAULT_SHAPE;
    const mat = new THREE.MeshStandardMaterial({ color: shape.color, roughness: 0.4, metalness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.4 });

    // Hand / grip area
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), darkMat);
    grip.position.set(0, -0.04, 0.02);
    this.group.add(grip);

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(shape.barrel * 3, shape.height, 0.07), mat);
    body.position.set(0, 0.02, -shape.length * 0.25);
    this.group.add(body);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(shape.barrel, shape.barrel, shape.length), mat);
    barrel.position.set(0, 0.04, -shape.length * 0.55);
    this.group.add(barrel);

    // Stock for rifles/snipers
    if (shape.length > 0.45) {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.18), darkMat);
      stock.position.set(0, 0.01, 0.12);
      this.group.add(stock);
    }

    // Scope for snipers
    if (weaponId === 'operator' || weaponId === 'marshal' || weaponId === 'guardian') {
      const scope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.14), darkMat);
      scope.position.set(0, 0.12, -shape.length * 0.35);
      this.group.add(scope);
    }

    this.currentWeaponId = weaponId;
  }

  setWeapon(weaponId) {
    if (weaponId !== this.currentWeaponId) this._buildModel(weaponId);
  }

  onFire() {
    this.recoilOffset = 0.06;
  }

  update(dt, isMoving) {
    // Recoil kick recovery
    this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, dt * 12);

    // Movement bob (Valorant-style subtle sway)
    if (isMoving) this.bobTime += dt * 8;
    else this.bobTime *= 0.9;
    const bobY = isMoving ? Math.sin(this.bobTime) * 0.012 : 0;
    const bobX = isMoving ? Math.cos(this.bobTime * 0.5) * 0.006 : 0;

    this.group.position.copy(this.basePos);
    this.group.position.y += bobY;
    this.group.position.x += bobX;
    this.group.position.z += this.recoilOffset;

    this.group.rotation.copy(this.baseRot);
    this.group.rotation.x -= this.recoilOffset * 2;
  }
}

/** Keep view model visible while world uses default layer. */
export function setupFpsLayers(camera, scene) {
  camera.layers.enable(0);
  camera.layers.enable(1);
}

export function hideViewModelFromWorld(viewModelGroup) {
  viewModelGroup.traverse((o) => { o.layers.set(1); });
}
