import * as THREE from 'three';

const WEAPON_SHAPES = {
  classic: { barrel: 0.05, length: 0.28, height: 0.12, color: 0x999999, type: 'pistol' },
  ghost: { barrel: 0.045, length: 0.3, height: 0.11, color: 0x7788aa, type: 'pistol' },
  sheriff: { barrel: 0.06, length: 0.38, height: 0.14, color: 0xaa7744, type: 'pistol' },
  stinger: { barrel: 0.045, length: 0.48, height: 0.13, color: 0x669966, type: 'smg' },
  spectre: { barrel: 0.05, length: 0.52, height: 0.14, color: 0x556688, type: 'smg' },
  bulldog: { barrel: 0.055, length: 0.58, height: 0.15, color: 0x887766, type: 'rifle' },
  guardian: { barrel: 0.06, length: 0.68, height: 0.16, color: 0x998866, type: 'rifle' },
  vandal: { barrel: 0.055, length: 0.72, height: 0.15, color: 0xaa4444, type: 'rifle' },
  phantom: { barrel: 0.055, length: 0.7, height: 0.15, color: 0x446688, type: 'rifle' },
  marshal: { barrel: 0.05, length: 0.88, height: 0.13, color: 0x668855, type: 'sniper' },
  operator: { barrel: 0.065, length: 1.05, height: 0.17, color: 0x444444, type: 'sniper' },
};

const DEFAULT_SHAPE = { barrel: 0.05, length: 0.5, height: 0.14, color: 0x777777, type: 'rifle' };
const SNIPER_SCOPED = new Set(['operator', 'marshal']);

export class ViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.barrelTip = new THREE.Object3D();
    camera.add(this.group);

    this.hipPos = new THREE.Vector3(0.28, -0.24, -0.42);
    this.hipRot = new THREE.Euler(-0.06, 0.1, 0.03);
    this.adsPos = new THREE.Vector3(0.15, -0.22, -0.45);
    this.adsRot = new THREE.Euler(-0.04, 0.05, 0.02);

    this.recoilOffset = 0;
    this.bobTime = 0;
    this.adsBlend = 0;
    this.currentWeaponId = null;

    const light = new THREE.PointLight(0xffffff, 1.2, 3);
    light.position.set(0.1, 0.1, -0.2);
    this.group.add(light);

    this._buildModel('classic');
  }

  _buildModel(weaponId) {
    const light = this.group.children.find(o => o.isPointLight);
    for (const c of [...this.group.children]) {
      if (c !== light) {
        this.group.remove(c);
        c.traverse?.((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose?.();
        });
      }
    }

    const shape = WEAPON_SHAPES[weaponId] || DEFAULT_SHAPE;
    const mat = new THREE.MeshStandardMaterial({
      color: shape.color, roughness: 0.35, metalness: 0.65,
      depthTest: false, depthWrite: false,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, roughness: 0.5, metalness: 0.5,
      depthTest: false, depthWrite: false,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x333333, roughness: 0.3, metalness: 0.7,
      depthTest: false, depthWrite: false,
    });

    const weaponRoot = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.1), darkMat);
    grip.position.set(0, -0.05, 0.04);
    weaponRoot.add(grip);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.12), accentMat);
    guard.position.set(0, 0.02, -0.04);
    weaponRoot.add(guard);

    const bodyW = shape.type === 'pistol' ? shape.barrel * 2.5 : shape.barrel * 3.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, shape.height, 0.09), mat);
    body.position.set(0, 0.04, -shape.length * 0.22);
    weaponRoot.add(body);

    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(shape.barrel, shape.barrel * 0.9, shape.length * 0.65),
      mat
    );
    barrel.position.set(0, 0.06, -shape.length * 0.58);
    weaponRoot.add(barrel);

    this.barrelTip.position.set(0, 0.06, -shape.length * 0.92);
    weaponRoot.add(this.barrelTip);

    if (shape.type !== 'pistol') {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), darkMat);
      mag.position.set(0, -0.1, -shape.length * 0.15);
      weaponRoot.add(mag);
    }

    if (shape.type === 'rifle' || shape.type === 'sniper') {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.22), darkMat);
      stock.position.set(0, 0.02, 0.16);
      weaponRoot.add(stock);
    }

    // Scope mesh only visible when NOT scoped (hip fire visual)
    if (shape.type === 'sniper' || weaponId === 'guardian') {
      const scopeBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.22), darkMat);
      scopeBody.position.set(0, 0.16, -shape.length * 0.38);
      scopeBody.name = 'scopeMesh';
      weaponRoot.add(scopeBody);
    }

    if (shape.type === 'rifle' || shape.type === 'smg') {
      const fGrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), darkMat);
      fGrip.position.set(0, -0.08, -shape.length * 0.45);
      weaponRoot.add(fGrip);
    }

    this.group.add(weaponRoot);
    weaponRoot.traverse(o => { if (o.isMesh) o.renderOrder = 999; });
    this.weaponRoot = weaponRoot;
    this.currentWeaponId = weaponId;
  }

  setWeapon(weaponId) {
    if (weaponId !== this.currentWeaponId) this._buildModel(weaponId);
  }

  onFire() {
    this.recoilOffset = 0.08;
  }

  getMuzzleWorldPosition(target = new THREE.Vector3()) {
    this.camera.updateMatrixWorld(true);
    this.barrelTip.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(this.barrelTip.matrixWorld);
  }

  update(dt, isMoving, isScoped, weaponId) {
    this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, dt * 14);
    this.adsBlend = THREE.MathUtils.lerp(this.adsBlend, isScoped ? 1 : 0, dt * 12);

    // Hide weapon entirely when scoped on sniper rifles (Valorant behavior)
    const hideWhenScoped = isScoped && SNIPER_SCOPED.has(weaponId);
    this.group.visible = !hideWhenScoped;

    if (hideWhenScoped) return;

    if (isMoving && !isScoped) this.bobTime += dt * 9;
    else this.bobTime *= 0.85;

    const bobY = isMoving && !isScoped ? Math.sin(this.bobTime) * 0.015 : 0;
    const bobX = isMoving && !isScoped ? Math.cos(this.bobTime * 0.5) * 0.008 : 0;

    this.group.position.lerpVectors(this.hipPos, this.adsPos, this.adsBlend);
    this.group.position.y += bobY;
    this.group.position.x += bobX * (1 - this.adsBlend);
    this.group.position.z += this.recoilOffset;

    this.group.rotation.x = THREE.MathUtils.lerp(this.hipRot.x, this.adsRot.x, this.adsBlend) - this.recoilOffset * 2.5;
    this.group.rotation.y = THREE.MathUtils.lerp(this.hipRot.y, this.adsRot.y, this.adsBlend);
    this.group.rotation.z = THREE.MathUtils.lerp(this.hipRot.z, this.adsRot.z, this.adsBlend);
  }
}
