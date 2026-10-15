export const RUNWAY_CONFIG = { centerX: 850, centerZ: 0, width: 48, length: 2200, elevation: 16 };

export const AIRFIELD_PAVEMENT = [
  { x: RUNWAY_CONFIG.centerX, z: RUNWAY_CONFIG.centerZ, width: RUNWAY_CONFIG.width, length: RUNWAY_CONFIG.length },
  { x: RUNWAY_CONFIG.centerX + 65, z: RUNWAY_CONFIG.centerZ, width: 20, length: RUNWAY_CONFIG.length - 120 },
  { x: RUNWAY_CONFIG.centerX + 130, z: RUNWAY_CONFIG.centerZ + 120, width: 180, length: 320 },
  ...[-850, 0, 850].map(z => ({ x: RUNWAY_CONFIG.centerX + 35, z: RUNWAY_CONFIG.centerZ + z, width: 90, length: 24 }))
];

export function isAirfieldPavement(x: number, z: number, margin = 0): boolean {
  return AIRFIELD_PAVEMENT.some(rect => Math.abs(x - rect.x) <= rect.width / 2 + margin && Math.abs(z - rect.z) <= rect.length / 2 + margin);
}

const number = (value: number): string => value.toFixed(3);
const firstDash = -RUNWAY_CONFIG.length / 2 + 100;
const lastDash = firstDash + Math.floor((RUNWAY_CONFIG.length - 200) / 44) * 44;

// Pavement and paint share the terrain fragment's depth. Box filtering preserves subpixel coverage.
export const AIRFIELD_SURFACE_GLSL = `
float airfieldBand(float coordinate, float halfWidth, float pixelWidth) {
  float halfPixel = max(pixelWidth, 0.001) * 0.5;
  return max(0.0, min(coordinate + halfPixel, halfWidth) - max(coordinate - halfPixel, -halfWidth)) / (halfPixel * 2.0);
}
float airfieldRect(vec2 coordinate, vec2 halfSize, vec2 pixelWidth) {
  return airfieldBand(coordinate.x, halfSize.x, pixelWidth.x) * airfieldBand(coordinate.y, halfSize.y, pixelWidth.y);
}
float dashIntegral(float coordinate) {
  float shifted = coordinate + 11.0;
  return floor(shifted / 44.0) * 22.0 + min(mod(shifted, 44.0), 22.0);
}
float airfieldSurface(vec2 world, vec2 pixelWidth, out float paint) {
  paint = 0.0;
  vec2 p = world - vec2(${number(RUNWAY_CONFIG.centerX)}, ${number(RUNWAY_CONFIG.centerZ)});
  if (abs(p.x) > 230.0 + pixelWidth.x || abs(p.y) > ${number(RUNWAY_CONFIG.length / 2 + 10)} + pixelWidth.y) return 0.0;
  float pavement = 0.0;
  ${AIRFIELD_PAVEMENT.map(rect => `pavement = max(pavement, airfieldRect(world - vec2(${number(rect.x)}, ${number(rect.z)}), vec2(${number(rect.width / 2)}, ${number(rect.length / 2)}), pixelWidth));`).join('\n  ')}
  float dash = (dashIntegral(p.y - ${number(firstDash)} + pixelWidth.y * 0.5) - dashIntegral(p.y - ${number(firstDash)} - pixelWidth.y * 0.5)) / pixelWidth.y;
  paint = airfieldBand(p.x, 0.425, pixelWidth.x) * clamp(dash, 0.0, 1.0) * airfieldBand(p.y - ${number((firstDash + lastDash) / 2)}, ${number((lastDash - firstDash) / 2 + 11)}, pixelWidth.y);
  for (int i = 0; i < 8; i++) {
    float x = -12.0 + float(i) * 3.2;
    if (abs(x) < 2.0) continue;
    float bar = airfieldBand(p.x - x, 0.7, pixelWidth.x);
    float ends = airfieldBand(p.y - ${number(RUNWAY_CONFIG.length / 2 - 35)}, 13.0, pixelWidth.y) + airfieldBand(p.y + ${number(RUNWAY_CONFIG.length / 2 - 35)}, 13.0, pixelWidth.y);
    paint = max(paint, bar * ends);
  }
  return pavement;
}`;
