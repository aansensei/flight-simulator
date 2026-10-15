export function flightMouseAxis(value: number): number {
  const distance = Math.abs(value);
  if (distance <= 0.045) return 0;
  const normalized = Math.min(1, (distance - 0.045) / 0.955);
  return Math.sign(value) * (normalized * 0.7 + normalized ** 3 * 0.3);
}

export function approachCommand(current: number, target: number, rate: number, dt: number): number {
  return current + Math.max(-rate * dt, Math.min(rate * dt, target - current));
}
