/**
 * Valorant-accurate mouse sensitivity and fixed FOV.
 *
 * Valorant: rotation (degrees) = mouseDelta × sensitivity × 0.07
 * Uses raw pointer-lock deltas (1:1 with in-game mouse counts).
 */
export const VALORANT_M_YAW = 0.07;
export const VALORANT_M_PITCH = 0.07;
export const VALORANT_H_FOV = 103;

const STORAGE_KEY = 'tacticalShooterSettings';
const DEG2RAD = Math.PI / 180;

const defaults = {
  sensitivity: 0.5,
  invertY: false,
};

let settings = { ...defaults };

export function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) settings = { ...defaults, ...JSON.parse(saved) };
  } catch (_) { /* ignore */ }
  return settings;
}

export function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getSettings() {
  return settings;
}

export function setSensitivity(val) {
  const n = parseFloat(val);
  if (Number.isNaN(n)) return;
  settings.sensitivity = Math.max(0.001, Math.min(10, Math.round(n * 1000) / 1000));
  saveSettings();
}

export function setInvertY(val) {
  settings.invertY = val;
  saveSettings();
}

export function horizontalToVerticalFov(hFovDeg, aspect) {
  const hRad = hFovDeg * DEG2RAD;
  const vRad = 2 * Math.atan(Math.tan(hRad / 2) / aspect);
  return (vRad * 180) / Math.PI;
}

export function applyValorantFov(camera, aspect = camera.aspect) {
  camera.fov = horizontalToVerticalFov(VALORANT_H_FOV, aspect);
  camera.updateProjectionMatrix();
}

/** Scoped sensitivity multiplier (Valorant ~35% while ADS on Op). */
export function getScopedSensMultiplier(scoped, weaponId) {
  if (!scoped) return 1;
  if (weaponId === 'operator') return 0.35;
  if (weaponId === 'marshal') return 0.45;
  return 0.55; // guardian
}

export function mouseDeltaToYaw(deltaX, scopedMul = 1) {
  const deg = deltaX * settings.sensitivity * VALORANT_M_YAW * scopedMul;
  return deg * DEG2RAD;
}

export function mouseDeltaToPitch(deltaY, scopedMul = 1) {
  const sign = settings.invertY ? -1 : 1;
  const deg = deltaY * settings.sensitivity * VALORANT_M_PITCH * sign * scopedMul;
  return deg * DEG2RAD;
}

export function degreesPerPixel() {
  return settings.sensitivity * VALORANT_M_YAW;
}
