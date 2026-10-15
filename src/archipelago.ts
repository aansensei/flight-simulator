import { BufferGeometry, GeometryBuilder, MathUtils } from './webgl2-three';

import { getDetailedIslandHeight } from './detailed-islands';

const SEGMENTS = 40;
const CELL = 2000;
export const BAY_CENTER = { x: 18200, z: 0 };

interface Island { x: number; z: number; rx: number; rz: number; height: number; seed: number; samples: Float32Array }
const random = (n: number): number => { const r = Math.sin(n * 127.1 + 311.7) * 43758.5453; return r - Math.floor(r); };
export const islands: Island[] = [];
const cells = new Map<string, Island[]>();

function heightAt(island: Island, x: number, z: number): number {
  const px = (x - island.x) / island.rx, pz = (z - island.z) / island.rz;
  const angle = Math.atan2(pz, px);
  const radius = Math.hypot(px, pz) * (1 + 0.13 * Math.sin(angle * 5 + island.seed) + 0.07 * Math.cos(angle * 9 - island.seed));
  const top = Math.pow(Math.max(0, 1 - radius * radius), 0.38);
  const weathering = 0.9 + 0.06 * Math.sin(px * 13 + island.seed) * Math.sin(pz * 11) + 0.04 * Math.cos(px * 23 + pz * 9);
  return -18 + island.height * top * weathering;
}

for (let row = -4; row <= 4; row++) for (let col = -4; col <= 4; col++) {
  const n = (row + 4) * 9 + col + 5;
  if (random(n + 500) < 0.17) continue;
  const island: Island = {
    x: BAY_CENTER.x + col * 1700 + (random(n) - 0.5) * 1100,
    z: row * 1800 + (random(n + 100) - 0.5) * 1100,
    rx: 200 + random(n + 200) * 450, rz: 220 + random(n + 300) * 650,
    height: 110 + random(n + 400) * 290, seed: n, samples: new Float32Array((SEGMENTS + 1) ** 2)
  };
  for (let iz = 0; iz <= SEGMENTS; iz++) for (let ix = 0; ix <= SEGMENTS; ix++) {
    island.samples[iz * (SEGMENTS + 1) + ix] = heightAt(island, island.x + (ix / SEGMENTS * 2 - 1) * island.rx * 1.3, island.z + (iz / SEGMENTS * 2 - 1) * island.rz * 1.3);
  }
  islands.push(island);
  for (let iz = Math.floor((island.z - island.rz * 1.3) / CELL); iz <= Math.floor((island.z + island.rz * 1.3) / CELL); iz++) {
    for (let ix = Math.floor((island.x - island.rx * 1.3) / CELL); ix <= Math.floor((island.x + island.rx * 1.3) / CELL); ix++) {
      const key = `${ix},${iz}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(island);
    }
  }
}

export function getIslandHeight(x: number, z: number): number {
  let height = -60;
  for (const island of cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) || []) {
    const gx = ((x - island.x) / (island.rx * 2.6) + 0.5) * SEGMENTS;
    const gz = ((z - island.z) / (island.rz * 2.6) + 0.5) * SEGMENTS;
    if (gx < -0.001 || gz < -0.001 || gx > SEGMENTS + 0.001 || gz > SEGMENTS + 0.001) continue;
    const ix = MathUtils.clamp(Math.floor(gx), 0, SEGMENTS - 1), iz = MathUtils.clamp(Math.floor(gz), 0, SEGMENTS - 1);
    const fx = MathUtils.clamp(gx - ix, 0, 1), fz = MathUtils.clamp(gz - iz, 0, 1), stride = SEGMENTS + 1;
    const a = island.samples[iz * stride + ix], b = island.samples[(iz + 1) * stride + ix];
    const c = island.samples[(iz + 1) * stride + ix + 1], d = island.samples[iz * stride + ix + 1];
    height = Math.max(height, fx + fz <= 1 ? a + (d - a) * fx + (b - a) * fz : c + (b - c) * (1 - fx) + (d - c) * (1 - fz));
  }
  return Math.max(height, getDetailedIslandHeight(x, z));
}

export function createIslandGeometry(island: Island): BufferGeometry {
  const geo = GeometryBuilder.createPlane(island.rx * 2.6, island.rz * 2.6, SEGMENTS, SEGMENTS, false);
  for (let i = 0; i < geo.positions.length; i += 3) {
    geo.positions[i] += island.x; geo.positions[i + 2] += island.z;
    const gx = MathUtils.clamp(Math.round(((geo.positions[i] - island.x) / (island.rx * 2.6) + 0.5) * SEGMENTS), 0, SEGMENTS);
    const gz = MathUtils.clamp(Math.round(((geo.positions[i + 2] - island.z) / (island.rz * 2.6) + 0.5) * SEGMENTS), 0, SEGMENTS);
    geo.positions[i + 1] = island.samples[gz * (SEGMENTS + 1) + gx];
  }
  geo.normals = GeometryBuilder.computeVertexNormals(geo.positions, geo.indices!);
  return geo;
}
