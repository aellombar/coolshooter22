/**
 * Valorant-accurate mouse sensitivity system.
 *
 * Valorant uses m_yaw / m_pitch = 0.07 degrees per mouse count at sensitivity 1.0.
 * Browser mousemove reports pixel deltas which map 1:1 to in-game counts.
 */
export const VALORANT_M_YAW = 0.07;
export const VALORANT_M_PITCH = 0.07;

const STORAGE_KEY = 'tacticalShooterSettings';

const defaults = {
  sensitivity: 0.5,
  fov: 103,
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
  settings.sensitivity = Math.max(0.1, Math.min(10, val));
  saveSettings();
}

export function setFov(val) {
  settings.fov = Math.max(80, Math.min(120, val));
  saveSettings();
}

export function setInvertY(val) {
  settings.invertY = val;
  saveSettings();
}

/**
 * Convert mouse delta to yaw rotation in radians (Valorant formula).
 */
export function mouseDeltaToYaw(deltaX) {
  const deg = deltaX * settings.sensitivity * VALORANT_M_YAW;
  return deg * (Math.PI / 180);
}

/**
 * Convert mouse delta to pitch rotation in radians (Valorant formula).
 */
export function mouseDeltaToPitch(deltaY) {
  const sign = settings.invertY ? -1 : 1;
  const deg = deltaY * settings.sensitivity * VALORANT_M_PITCH * sign;
  return deg * (Math.PI / 180);
}

/**
 * Degrees turned per pixel at current sensitivity (for UI display).
 */
export function degreesPerPixel() {
  return settings.sensitivity * VALORANT_M_YAW;
}
