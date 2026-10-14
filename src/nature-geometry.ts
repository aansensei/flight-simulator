import { BufferGeometry, GeometryBuilder } from './webgl2-three';

// Overlapping ragged whorls give spruce trees a branch silhouette.
export function spruceCrown(levels = 11, segments = 14): BufferGeometry {
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let level = 0; level < levels; level++) {
    const baseY = 2.4 + level / Math.max(1, levels - 1) * 9.5;
    const radius = 3.0 * (1 - level / (levels + 1));
    const base = positions.length / 3;
    for (let ring = 0; ring < 3; ring++) {
      for (let j = 0; j <= segments; j++) {
        const angle = j / segments * Math.PI * 2 + level * 2.39996;
        const ragged = 0.78 + 0.22 * Math.sin(j * 7.13 + level * 3.21) ** 2;
        const r = radius * (ring === 0 ? 0.12 : ring === 1 ? ragged : 0.06);
        positions.push(Math.cos(angle) * r, baseY + (ring === 0 ? -0.35 : ring === 1 ? 0 : 2.2), Math.sin(angle) * r);
        const light = (ring === 0 ? 0.7 : 1) * (0.85 + level * 0.025);
        colors.push(0.10 * light, 0.23 * light, 0.095 * light);
        uvs.push(j / segments, ring / 2);
      }
    }
    for (let ring = 0; ring < 2; ring++) for (let j = 0; j < segments; j++) {
      const a = base + ring * (segments + 1) + j, b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const p = new Float32Array(positions), i = new Uint16Array(indices);
  return new BufferGeometry({ positions: p, indices: i, normals: GeometryBuilder.computeVertexNormals(p, i), colors: new Float32Array(colors), uvs: new Float32Array(uvs) });
}
