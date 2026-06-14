/**
 * Weapon definitions with Valorant-accurate stats and spray patterns.
 * Recoil patterns are per-bullet [horizontal, vertical] offsets in degrees.
 * Patterns sourced from community recoil charts and normalized to match Valorant feel.
 */

function pattern(bullets) {
  return bullets.map(([x, y]) => [x, y]);
}

// Vandal spray pattern (25 rounds) — strong vertical climb, then left-right sway
const VANDAL_PATTERN = pattern([
  [0, 0.35], [0, 0.38], [0, 0.40], [0, 0.42], [0, 0.44],
  [-0.08, 0.42], [-0.15, 0.40], [-0.20, 0.38], [-0.22, 0.36], [-0.24, 0.34],
  [-0.26, 0.32], [-0.28, 0.30], [0.10, 0.28], [0.22, 0.26], [0.30, 0.24],
  [0.34, 0.22], [0.36, 0.20], [0.32, 0.18], [0.24, 0.16], [0.14, 0.14],
  [0.04, 0.12], [-0.06, 0.10], [-0.14, 0.08], [-0.20, 0.06], [-0.24, 0.04],
]);

// Phantom — tighter horizontal, slightly less vertical
const PHANTOM_PATTERN = pattern([
  [0, 0.30], [0, 0.32], [0, 0.34], [0, 0.35], [0, 0.36],
  [-0.05, 0.35], [-0.10, 0.34], [-0.14, 0.33], [-0.16, 0.32], [-0.18, 0.31],
  [-0.20, 0.30], [-0.22, 0.29], [0.06, 0.28], [0.14, 0.27], [0.20, 0.26],
  [0.24, 0.25], [0.26, 0.24], [0.22, 0.23], [0.16, 0.22], [0.08, 0.21],
  [0, 0.20], [-0.08, 0.19], [-0.14, 0.18], [-0.18, 0.17], [-0.20, 0.16],
  [-0.22, 0.15], [-0.20, 0.14], [-0.16, 0.13], [-0.10, 0.12], [-0.04, 0.11],
]);

// Spectre — moderate vertical, increasing horizontal
const SPECTRE_PATTERN = pattern([
  [0, 0.22], [0, 0.24], [0, 0.25], [0.04, 0.25], [0.08, 0.24],
  [0.12, 0.23], [0.14, 0.22], [0.16, 0.21], [0.18, 0.20], [0.20, 0.19],
  [0.18, 0.18], [0.14, 0.17], [0.08, 0.16], [0, 0.15], [-0.08, 0.14],
  [-0.14, 0.13], [-0.18, 0.12], [-0.20, 0.11], [-0.22, 0.10], [-0.20, 0.09],
  [-0.16, 0.08], [-0.10, 0.07], [-0.04, 0.06], [0.04, 0.05], [0.10, 0.04],
  [0.14, 0.03], [0.16, 0.02], [0.14, 0.01], [0.10, 0], [0.04, 0],
]);

// Stinger — fast climb, wide horizontal
const STINGER_PATTERN = pattern([
  [0, 0.28], [0, 0.30], [0.06, 0.30], [0.12, 0.29], [0.18, 0.28],
  [0.22, 0.27], [0.24, 0.26], [0.22, 0.25], [0.18, 0.24], [0.12, 0.23],
  [0.04, 0.22], [-0.04, 0.21], [-0.12, 0.20], [-0.18, 0.19], [-0.22, 0.18],
  [-0.24, 0.17], [-0.22, 0.16], [-0.18, 0.15], [-0.12, 0.14], [-0.04, 0.13],
]);

// Bulldog — burst rifle, moderate pattern
const BULLDOG_PATTERN = pattern([
  [0, 0.32], [0, 0.34], [0, 0.35], [-0.06, 0.34], [-0.10, 0.33],
  [0.08, 0.32], [0.14, 0.31], [0.18, 0.30], [0.20, 0.29], [0.18, 0.28],
  [-0.04, 0.27], [-0.10, 0.26], [0.06, 0.25], [0.12, 0.24], [0.16, 0.23],
  [0.14, 0.22], [0.08, 0.21], [0, 0.20], [-0.06, 0.19], [-0.10, 0.18],
  [-0.08, 0.17], [-0.04, 0.16], [0.04, 0.15], [0.08, 0.14],
]);

// Guardian — semi-auto, minimal spray
const GUARDIAN_PATTERN = pattern([
  [0, 0.45], [0, 0.48], [0, 0.50], [-0.04, 0.48], [-0.06, 0.46],
  [0.04, 0.44], [0.06, 0.42], [-0.04, 0.40], [0, 0.38], [0.04, 0.36],
  [-0.04, 0.34], [0, 0.32],
]);

export const WEAPONS = {
  classic: {
    id: 'classic',
    name: 'Classic',
    category: 'sidearms',
    price: 0,
    damage: { body: 26, head: 78, leg: 22 },
    fireRate: 6.75,
    magSize: 12,
    reserve: 36,
    automatic: false,
    runSpeed: 5.73,
    equipTime: 0.75,
    firstShotAccuracy: 0.005,
    recoilPattern: null,
    recoilRecovery: 0.35,
    range: 30,
  },
  ghost: {
    id: 'ghost',
    name: 'Ghost',
    category: 'sidearms',
    price: 500,
    damage: { body: 30, head: 105, leg: 25 },
    fireRate: 6.75,
    magSize: 15,
    reserve: 45,
    automatic: false,
    runSpeed: 5.73,
    equipTime: 0.75,
    firstShotAccuracy: 0.003,
    recoilPattern: null,
    recoilRecovery: 0.30,
    range: 30,
  },
  sheriff: {
    id: 'sheriff',
    name: 'Sheriff',
    category: 'sidearms',
    price: 800,
    damage: { body: 55, head: 159, leg: 46 },
    fireRate: 4.0,
    magSize: 6,
    reserve: 24,
    automatic: false,
    runSpeed: 5.4,
    equipTime: 1.0,
    firstShotAccuracy: 0.002,
    recoilPattern: null,
    recoilRecovery: 0.50,
    range: 50,
  },
  stinger: {
    id: 'stinger',
    name: 'Stinger',
    category: 'smgs',
    price: 950,
    damage: { body: 27, head: 81, leg: 23 },
    fireRate: 16,
    magSize: 20,
    reserve: 80,
    automatic: true,
    runSpeed: 5.73,
    equipTime: 0.75,
    firstShotAccuracy: 0.012,
    recoilPattern: STINGER_PATTERN,
    recoilRecovery: 0.20,
    range: 20,
  },
  spectre: {
    id: 'spectre',
    name: 'Spectre',
    category: 'smgs',
    price: 1600,
    damage: { body: 26, head: 78, leg: 22 },
    fireRate: 13.33,
    magSize: 30,
    reserve: 90,
    automatic: true,
    runSpeed: 5.73,
    equipTime: 0.75,
    firstShotAccuracy: 0.015,
    recoilPattern: SPECTRE_PATTERN,
    recoilRecovery: 0.18,
    range: 22,
  },
  bulldog: {
    id: 'bulldog',
    name: 'Bulldog',
    category: 'rifles',
    price: 2050,
    damage: { body: 35, head: 115, leg: 30 },
    fireRate: 9.15,
    magSize: 24,
    reserve: 72,
    automatic: false,
    burstCount: 3,
    runSpeed: 5.4,
    equipTime: 1.0,
    firstShotAccuracy: 0.008,
    recoilPattern: BULLDOG_PATTERN,
    recoilRecovery: 0.25,
    range: 50,
  },
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    category: 'rifles',
    price: 2250,
    damage: { body: 65, head: 195, leg: 49 },
    fireRate: 4.75,
    magSize: 12,
    reserve: 36,
    automatic: false,
    runSpeed: 5.4,
    equipTime: 1.0,
    firstShotAccuracy: 0.002,
    recoilPattern: GUARDIAN_PATTERN,
    recoilRecovery: 0.30,
    range: 50,
    scope: true,
    scopeHFov: 55,
  },
  vandal: {
    id: 'vandal',
    name: 'Vandal',
    category: 'rifles',
    price: 2900,
    damage: { body: 40, head: 160, leg: 34 },
    fireRate: 9.75,
    magSize: 25,
    reserve: 75,
    automatic: true,
    runSpeed: 5.4,
    equipTime: 1.0,
    firstShotAccuracy: 0.008,
    recoilPattern: VANDAL_PATTERN,
    recoilRecovery: 0.22,
    range: 50,
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom',
    category: 'rifles',
    price: 2900,
    damage: { body: 35, head: 140, leg: 30 },
    fireRate: 11,
    magSize: 30,
    reserve: 90,
    automatic: true,
    runSpeed: 5.4,
    equipTime: 1.0,
    firstShotAccuracy: 0.008,
    recoilPattern: PHANTOM_PATTERN,
    recoilRecovery: 0.20,
    range: 30,
    silenced: true,
  },
  marshal: {
    id: 'marshal',
    name: 'Marshal',
    category: 'snipers',
    price: 950,
    damage: { body: 101, head: 202, leg: 85 },
    fireRate: 1.5,
    magSize: 5,
    reserve: 15,
    automatic: false,
    runSpeed: 5.13,
    equipTime: 1.25,
    firstShotAccuracy: 0.001,
    recoilPattern: null,
    recoilRecovery: 0.60,
    range: 50,
    scope: true,
    scopeHFov: 40,
  },
  operator: {
    id: 'operator',
    name: 'Operator',
    category: 'snipers',
    price: 4700,
    damage: { body: 150, head: 255, leg: 120 },
    fireRate: 0.6,
    magSize: 5,
    reserve: 10,
    automatic: false,
    runSpeed: 3.4,
    equipTime: 1.5,
    firstShotAccuracy: 0.0005,
    recoilPattern: null,
    recoilRecovery: 0.80,
    range: 50,
    scope: true,
    scopeHFov: 25,
    boltAction: true,
  },
};

export const ARMOR = {
  light: { id: 'light', name: 'Light Shields', price: 400, hp: 25 },
  heavy: { id: 'heavy', name: 'Heavy Shields', price: 1000, hp: 50 },
};

export const BUY_CATEGORIES = {
  sidearms: ['ghost', 'sheriff'],
  smgs: ['stinger', 'spectre'],
  rifles: ['bulldog', 'guardian', 'vandal', 'phantom'],
  snipers: ['marshal', 'operator'],
  armor: ['light', 'heavy'],
};

export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS.classic;
}

export function createWeaponState(weaponId) {
  const def = getWeapon(weaponId);
  return {
    def,
    ammo: def.magSize,
    reserve: def.reserve,
    shotsFired: 0,
    lastShotTime: 0,
    isReloading: false,
    burstRemaining: 0,
    burstCooldown: 0,
    boltPending: false,
  };
}

/**
 * View kick applied to camera after each shot.
 */
export function getViewKick(weaponState) {
  const { def, shotsFired } = weaponState;
  let pitch = 0;
  let yaw = 0;

  if (def.recoilPattern && shotsFired > 0) {
    const idx = Math.min(shotsFired - 1, def.recoilPattern.length - 1);
    const [h, v] = def.recoilPattern[idx];
    pitch = v * (Math.PI / 180);
    yaw = h * (Math.PI / 180);
  } else if (!def.recoilPattern && shotsFired > 0) {
    pitch = 0.15 * (Math.PI / 180);
  }

  return { pitch: pitch * 0.9, yaw: yaw * 0.9 };
}

/**
 * Bullet spread offset in radians — separate from view kick (Valorant-style).
 * First shot while still + scoped = near perfect accuracy.
 */
export function getBulletSpread(weaponState, moving, airborne, scoped) {
  const { def, shotsFired } = weaponState;
  let inaccuracy = def.firstShotAccuracy;

  if (scoped) inaccuracy *= 0.15;
  if (moving) inaccuracy *= scoped ? 2.0 : 3.5;
  if (airborne) inaccuracy *= 5;

  // Spray pattern adds to bullet path (not random on first shot)
  let patternPitch = 0;
  let patternYaw = 0;
  if (def.recoilPattern && shotsFired > 1) {
    const idx = Math.min(shotsFired - 2, def.recoilPattern.length - 1);
    const [h, v] = def.recoilPattern[idx];
    patternPitch = v * (Math.PI / 180) * 0.6;
    patternYaw = h * (Math.PI / 180) * 0.6;
  }

  const spreadYaw = (Math.random() - 0.5) * inaccuracy * 2;
  const spreadPitch = (Math.random() - 0.5) * inaccuracy * 2;

  return {
    pitch: patternPitch + spreadPitch,
    yaw: patternYaw + spreadYaw,
  };
}

/** @deprecated use getViewKick + getBulletSpread */
export function getRecoilOffset(weaponState, moving, airborne, scoped = false) {
  const kick = getViewKick(weaponState);
  const spread = getBulletSpread(weaponState, moving, airborne, scoped);
  return {
    pitch: spread.pitch,
    yaw: spread.yaw,
    viewKickPitch: kick.pitch,
    viewKickYaw: kick.yaw,
  };
}

export function canFire(weaponState, now) {
  const { def, ammo, isReloading, burstRemaining, boltPending } = weaponState;
  if (isReloading || ammo <= 0 || boltPending) return false;
  const interval = 1 / def.fireRate;
  if (now - weaponState.lastShotTime < interval) return false;
  if (def.burstCount && burstRemaining === 0 && weaponState.burstCooldown > now) return false;
  return true;
}

export function fireWeapon(weaponState, now) {
  weaponState.lastShotTime = now;
  weaponState.ammo--;
  weaponState.shotsFired++;

  const { def } = weaponState;
  if (def.burstCount) {
    if (weaponState.burstRemaining <= 0) {
      weaponState.burstRemaining = def.burstCount - 1;
    } else {
      weaponState.burstRemaining--;
      if (weaponState.burstRemaining === 0) {
        weaponState.burstCooldown = now + 0.35;
      }
    }
  }
  if (def.boltAction) {
    weaponState.boltPending = true;
    setTimeout(() => { weaponState.boltPending = false; }, 1200);
  }
}

export function reloadWeapon(weaponState) {
  const { def } = weaponState;
  const needed = def.magSize - weaponState.ammo;
  const available = Math.min(needed, weaponState.reserve);
  weaponState.ammo += available;
  weaponState.reserve -= available;
  weaponState.shotsFired = 0;
  weaponState.isReloading = false;
}

export function getReloadTime(weaponId) {
  const times = {
    classic: 1.75, ghost: 1.75, sheriff: 2.25,
    stinger: 2.25, spectre: 2.25,
    bulldog: 2.5, guardian: 2.5, vandal: 2.5, phantom: 2.5,
    marshal: 3.0, operator: 3.7,
  };
  return times[weaponId] || 2.0;
}
