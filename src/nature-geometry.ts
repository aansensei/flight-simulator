import { BufferGeometry, GeometryBuilder } from './webgl2-three';

// Branch cards use the needle region of Poly Haven's pine twig atlas.
export function spruceCrown(levels = 11, segments = 14): BufferGeometry {
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  const branches = segments > 8 ? 5 : 3;
  for (let level = 0; level < levels; level++) {
    const y = 2.4 + level / Math.max(1, levels - 1) * 9.5;
    const radius = 3 * (1 - level / (levels + 1));
    for (let j = 0; j < branches; j++) {
      const angle = j / branches * Math.PI * 2 + level * 2.399963;
      const dx = Math.cos(angle), dz = Math.sin(angle);
      const width = radius * 0.5, base = positions.length / 3;
      const length = radius * (0.87 + 0.13 * Math.sin(j * 7.13 + level) ** 2);
      positions.push(-dz * width * 0.15, y, dx * width * 0.15,
        dz * width * 0.15, y, -dx * width * 0.15,
        dx * length + dz * width, y - length * 0.25, dz * length - dx * width,
        dx * length - dz * width, y - length * 0.25, dz * length + dx * width);
      uvs.push(0.015, 0.45, 0.245, 0.45, 0.245, 0.035, 0.015, 0.035);
      const light = 0.80 + level / levels * 0.25;
      for (let k = 0; k < 4; k++) colors.push(0.30 * light, 0.42 * light, 0.25 * light);
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const p = new Float32Array(positions), i = new Uint16Array(indices);
  return new BufferGeometry({ positions: p, indices: i, normals: GeometryBuilder.computeVertexNormals(p, i), colors: new Float32Array(colors), uvs: new Float32Array(uvs) });
}
