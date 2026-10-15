export interface BoundingSphere { x: number; y: number; z: number; radius: number }

export function geometrySphere(positions: Float32Array): BoundingSphere {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2]);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2, radius: Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 };
}

export class RenderFrustum {
  private planes = new Float32Array(24);
  set(matrix: Float32Array): void {
    for (let axis = 0; axis < 3; axis++) for (let side = 0; side < 2; side++) {
      const sign = side ? -1 : 1, base = (axis * 2 + side) * 4;
      let magnitude = 0;
      for (let component = 0; component < 4; component++) {
        const value = matrix[component * 4 + 3] + sign * matrix[component * 4 + axis];
        this.planes[base + component] = value;
        if (component < 3) magnitude += value * value;
      }
      const inverse = 1 / Math.sqrt(magnitude);
      for (let component = 0; component < 4; component++) this.planes[base + component] *= inverse;
    }
  }
  intersects(sphere: BoundingSphere, matrix: Float32Array): boolean {
    const x = matrix[0] * sphere.x + matrix[4] * sphere.y + matrix[8] * sphere.z + matrix[12];
    const y = matrix[1] * sphere.x + matrix[5] * sphere.y + matrix[9] * sphere.z + matrix[13];
    const z = matrix[2] * sphere.x + matrix[6] * sphere.y + matrix[10] * sphere.z + matrix[14];
    // The Frobenius norm also bounds transforms with shear from nested TRS nodes.
    const radius = sphere.radius * Math.hypot(matrix[0], matrix[1], matrix[2], matrix[4], matrix[5], matrix[6], matrix[8], matrix[9], matrix[10]);
    for (let i = 0; i < this.planes.length; i += 4) if (this.planes[i] * x + this.planes[i + 1] * y + this.planes[i + 2] * z + this.planes[i + 3] < -radius) return false;
    return true;
  }
}
