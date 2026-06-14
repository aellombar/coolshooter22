/**
 * Valorant-accurate mouse sensitivity and fixed FOV.
 *
 * Valorant uses m_yaw / m_pitch = 0.07 degrees per mouse count at sensitivity 1.0.
 * Horizontal FOV is fixed at 103 degrees (not adjustable in Valorant).
 */
export const VALORANT_M_YAW = 0.07;
export const VALORANT_M_PITCH = 0.07;
export const VALORANT_H_FOV = 103;

const STORAGE_KEY = 'tacticalShooterSettings';

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
  settings.sensitivity = Math.max(0.01, Math.min(10, Math.round(n * 100) / 100));
  saveSettings();
}

export function setInvertY(val) {
  settings.invertY = val;
  saveSettings();
}

/** Convert Valorant horizontal FOV to Three.js vertical FOV. */
export function horizontalToVerticalFov(hFovDeg, aspect) {
  const hRad = (hFovDeg * Math.PI) / 180;
  const vRad = 2 * Math.atan(Math.tan(hRad / 2) / aspect);
  return (vRad * 180) / Math.PI;
}

/** Apply fixed Valorant 103° horizontal FOV to a PerspectiveCamera. */
export function applyValorantFov(camera, aspect = camera.aspect) {
  camera.fov = horizontalToVerticalFov(VALORANT_H_FOV, aspect);
  camera.updateProjectionMatrix();
}

export function mouseDeltaToYaw(deltaX) {
  const deg = deltaX * settings.sensitivity * VALORANT_M_YAW;
  return deg * (Math.PI / 180);
}

export function mouseDeltaToPitch(deltaY) {
  const sign = settings.invertY ? -1 : 1;
  const deg = deltaY * settings.sensitivity * VALORANT_M_PITCH * sign;
  return deg * (Math.PI / 180);
}

export function degreesPerPixel() {
  return settings.sensitivity * VALORANT_M_YAW;
}
