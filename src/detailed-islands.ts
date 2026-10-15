import { ParsedGLBResult } from './gltf-loader';
import { Group, Mesh, Object3D, Vector3 } from './webgl2-three';

export const DETAILED_ISLAND_PLACEMENTS = [
  { x: 16600, z: 11600 }, { x: 18500, z: 11000 }, { x: 20500, z: 11600 },
  { x: 17300, z: 8800 }, { x: 19300, z: 8800 }, { x: 21500, z: 9600 }
];

interface Triangle { ax: number; az: number; ay: number; bx: number; bz: number; by: number; cx: number; cz: number; cy: number; denominator: number }
const CELL_SIZE = 80;

// Vertical contact uses the full resolution visible surface, independently of display LOD.
export class IslandSurface {
  private cells = new Map<string, Triangle[]>();
  constructor(meshes: Mesh[]) {
    const point = new Vector3();
    for (const mesh of meshes) {
      const { positions, indices } = mesh.geometry;
      const vertex = (index: number): Vector3 => point.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]).applyMatrix4(mesh.matrixWorld);
      for (let i = 0; i < (indices?.length || mesh.geometry.vertexCount); i += 3) {
        const a = vertex(indices ? indices[i] : i).clone(), b = vertex(indices ? indices[i + 1] : i + 1).clone(), c = vertex(indices ? indices[i + 2] : i + 2).clone();
        const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(denominator) < 1e-7) continue;
        const triangle: Triangle = { ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, cx: c.x, cy: c.y, cz: c.z, denominator };
        for (let z = Math.floor(Math.min(a.z, b.z, c.z) / CELL_SIZE); z <= Math.floor(Math.max(a.z, b.z, c.z) / CELL_SIZE); z++) {
          for (let x = Math.floor(Math.min(a.x, b.x, c.x) / CELL_SIZE); x <= Math.floor(Math.max(a.x, b.x, c.x) / CELL_SIZE); x++) {
            const key = `${x},${z}`;
            if (!this.cells.has(key)) this.cells.set(key, []);
            this.cells.get(key)!.push(triangle);
          }
        }
      }
    }
  }
  heightAt(x: number, z: number): number {
    let height = -60;
    for (const t of this.cells.get(`${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`) || []) {
      const a = ((t.bz - t.cz) * (x - t.cx) + (t.cx - t.bx) * (z - t.cz)) / t.denominator;
      const b = ((t.cz - t.az) * (x - t.cx) + (t.ax - t.cx) * (z - t.cz)) / t.denominator;
      if (a >= -1e-7 && b >= -1e-7 && a + b <= 1 + 1e-7) height = Math.max(height, a * t.ay + b * t.by + (1 - a - b) * t.cy);
    }
    return height;
  }
}

let surface: IslandSurface | null = null;
export const detailedIslandsRoot = new Group();
const clusters: Array<{ root: Object3D; levels: Object3D[] }> = [];

export function installDetailedIslands(models: ParsedGLBResult[]): void {
  if (models.length !== DETAILED_ISLAND_PLACEMENTS.length) throw new Error('Six island models are required');
  for (const child of [...detailedIslandsRoot.children]) detailedIslandsRoot.remove(child);
  clusters.length = 0;
  const contactMeshes: Mesh[] = [];
  models.forEach((model, index) => {
    const location = DETAILED_ISLAND_PLACEMENTS[index];
    model.root.position.set(location.x, 0, location.z);
    detailedIslandsRoot.add(model.root);
    const levels = [0, 1, 2].map(lod => {
      const node = model.nodesByName.get(`LOD${lod}`);
      if (!node) throw new Error('Island LOD is missing');
      return node;
    });
    const collect = (node: Object3D): void => {
      if (node instanceof Mesh) contactMeshes.push(node);
      node.children.forEach(collect);
    };
    collect(levels[0]);
    clusters.push({ root: model.root, levels });
    levels.forEach((level, i) => level.visible = i === 0);
  });
  detailedIslandsRoot.updateMatrixWorld();
  surface = new IslandSurface(contactMeshes);
}

export function getDetailedIslandHeight(x: number, z: number): number { return surface?.heightAt(x, z) ?? -60; }

export function updateDetailedIslandLOD(focus: Vector3): void {
  for (const cluster of clusters) {
    const distance = Math.hypot(focus.x - cluster.root.position.x, focus.z - cluster.root.position.z);
    const lod = distance < 3500 ? 0 : distance < 8000 ? 1 : 2;
    cluster.levels.forEach((level, i) => level.visible = i === lod);
  }
}
