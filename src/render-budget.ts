export function nextRenderScale(scale: number, frameMilliseconds: number, targetFps = 60): number {
  const budget = 1000 / targetFps;
  if (!Number.isFinite(frameMilliseconds) || frameMilliseconds <= 0) return scale;
  if (frameMilliseconds > budget * 1.08) return Math.max(0.55, Math.round((scale - 0.06) * 100) / 100);
  if (frameMilliseconds < budget * 0.76) return Math.min(1, Math.round((scale + 0.03) * 100) / 100);
  return scale;
}
