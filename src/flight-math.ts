import { Vector3 } from './webgl2-three';

export const GRAVITY = 9.80665;
export const SEA_LEVEL_DENSITY = 1.225;

export function airDensity(altitudeM: number): number {
  return SEA_LEVEL_DENSITY * Math.pow(Math.max(0.1, 1 - 2.2558e-5 * altitudeM), 4.2559);
}

// Actuator disk power includes the energy carried away in the slipstream.
export function propellerThrust(powerW: number, speedMs: number, density: number, diameter: number): number {
  if (powerW <= 0 || density <= 0) return 0;
  const area = Math.PI * diameter * diameter / 4;
  const speed = Math.max(0, speedMs);
  let low = 0;
  let high = Math.cbrt(powerW / (2 * density * area)) + 1;
  for (let i = 0; i < 32; i++) {
    const induced = (low + high) / 2;
    const required = 2 * density * area * induced * (speed + induced) ** 2;
    if (required > powerW) high = induced;
    else low = induced;
  }
  const induced = (low + high) / 2;
  return 2 * density * area * induced * (speed + induced);
}

// Euler's rigid body equation in body axes, including gyroscopic coupling.
export function angularAcceleration(omega: Vector3, moment: Vector3, inertia: Vector3, out = new Vector3()): Vector3 {
  return out.set(
    (moment.x + (inertia.y - inertia.z) * omega.y * omega.z) / inertia.x,
    (moment.y + (inertia.z - inertia.x) * omega.z * omega.x) / inertia.y,
    (moment.z + (inertia.x - inertia.y) * omega.x * omega.y) / inertia.z
  );
}

export function liftCoefficient(alpha: number, flaps: number): { cl: number; severity: number; critical: number } {
  const ratio = Math.max(0, Math.min(1, flaps / 30));
  const critical = 0.279 + (0.253 - 0.279) * ratio;
  const peak = 1.44 + 0.5 * ratio;
  const offset = 0.28 + 0.48 * ratio;
  const slope = (peak - offset) / critical;
  if (alpha >= -0.21 && alpha <= critical) return { cl: offset + slope * alpha, severity: 0, critical };
  const edge = alpha > critical ? critical : -0.21;
  const excess = Math.abs(alpha - edge);
  const t = Math.min(1, excess / 0.24);
  const blend = t * t * (3 - 2 * t);
  return {
    cl: (offset + slope * edge) * (1 - blend) + 0.72 * Math.sin(2 * alpha) * blend,
    severity: Math.min(1, excess / 0.22), critical
  };
}
