import { sampleAlpineElevation } from './elevation-data';
import { createIslandGeometry, getIslandHeight, islands } from './archipelago';
import { spruceCrown } from './nature-geometry';
/**
 * AERONAUT: Wilderness Flight
 * Module: src/terrain.ts
 *
 * Hệ thống Địa hình & Môi trường vùng núi Alps diện tích 120 × 120 km:
 * - Hồ lớn nằm trong thung lũng rộng + Sông uốn lượn nối các khu vực.
 * - Sân bay nhỏ (Alpine Airfield) có đường băng dài 2.200 m nằm trên khu đất bằng phẳng bên bờ đông hồ.
 * - Rừng thông phân bố tự nhiên theo cụm bằng InstancedMesh (không mọc dưới nước, trên đường băng hay vách đá dựng đứng).
 * - Các công trình nhỏ (Nhà chứa máy bay Hangar, Tháp quan sát, Nhà gỗ Chalet ven hồ, Cột gió Windsock).
 * - Hệ thống mây 3D đa tầng có chiều sâu và tính toán mật độ mây khi bay xuyên qua.
 */

import {
  BufferGeometry, Color, Euler, GeometryBuilder, Group, InstancedMesh,
  Material, MathUtils, Matrix4, Mesh, Quaternion, Scene, Vector3
} from './webgl2-three';
import { QualityConfig } from './types';

export const WORLD_SIZE = 120000; // 120 km × 120 km
export const LAKE_LEVEL = 0.0;   // Mực nước hồ (0.0 m MSL = 1,800 ft Alpine Valley datum)
export const VALLEY_DATUM_FEET = 1800; // Cao độ cơ sở của thung lũng so với mực nước biển (1,800 ft)

// Cấu hình đường băng Alpine Airfield (nằm ở bờ đông của hồ)
export const RUNWAY_CONFIG = {
  centerX: 850.0,
  centerZ: 0.0,
  width: 48.0,
  length: 2200.0,
  elevation: 16.0 // Cao hơn mặt hồ 16m trên thềm bình nguyên phẳng
};

// Hàm băm xác định (deterministic hash) phục vụ tạo địa hình và rải cây
function hash2D(ix: number, iz: number): number {
  let n = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uz = fz * fz * (3.0 - 2.0 * fz);
  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbmNoise(x: number, z: number, octaves = 5): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, z * freq);
    // Xoay nhẹ giữa các octave để tránh đường gân thẳng hàng
    const nx = x * 0.8 - z * 0.6;
    const nz = x * 0.6 + z * 0.8;
    x = nx;
    z = nz;
    freq *= 2.04;
    amp *= 0.49;
  }
  return val;
}

/**
 * Hàm độ cao địa hình liên tục để tạo lưới hiển thị 3D
 */
function getMainlandHeight(x: number, z: number): number {
  // 1. Cấu trúc thung lũng & hồ trung tâm hình bầu dục kéo dài theo trục Bắc - Nam (Z)
  const lakeCenter = -220 + Math.sin(z * 0.0011) * 125 + Math.sin(z * 0.0032) * 48;
  const lakeNormX = (x - lakeCenter) / (1020 + Math.sin(z * 0.0018) * 110);
  const lakeNormZ = (z - 150) / 1850;
  const lakeRadial = Math.sqrt(lakeNormX * lakeNormX + lakeNormZ * lakeNormZ) + (fbmNoise(x * 0.0025 + 20, z * 0.0025, 3) - 0.45) * 0.15;

  // 2. Dãy núi Alps bao quanh thung lũng (nhiều tầng: đồi thông thấp -> sườn núi đá -> đỉnh tuyết cao)
  const valleyDist = Math.sqrt((x / 1450) * (x / 1450) + ((z - 100) / 2100) * ((z - 100) / 2100));
  const mountainEnvelope = MathUtils.smoothstep(0.52, 1.65, valleyDist);

  const foothillNoise = fbmNoise(x * 0.0018, z * 0.0018, 3);
  const measuredRelief = Math.max(80, (sampleAlpineElevation(x, z) - 850) * 0.65);
  let h = MathUtils.lerp(18 + foothillNoise * 45, measuredRelief, mountainEnvelope);

  // 3. Đào lòng hồ trung tâm (sâu xuống dưới mực nước y = 0)
  const lakeDepression = 1.0 - MathUtils.smoothstep(0.55, 1.18, lakeRadial);
  h = MathUtils.lerp(h, -28.0 + foothillNoise * 8.0, lakeDepression);

  // 4. Con sông uốn lượn nối từ hồ về phía Nam và Đông Bắc
  const riverCurveX = -220 + Math.sin(z * 0.00095) * 460 + Math.cos(z * 0.0004) * 180;
  const distToRiver = Math.abs(x - riverCurveX);
  const riverWidth = 85.0 + Math.sin(z * 0.0015) * 25.0;
  if (distToRiver < riverWidth * 3.2) {
    const riverMask = 1.0 - MathUtils.smoothstep(riverWidth * 0.55, riverWidth * 2.8, distToRiver);
    h = MathUtils.lerp(h, -6.5, riverMask * 0.85);
  }

  // 5. Làm phẳng hoàn toàn khu vực Sân bay (Alpine Airfield) ở bờ đông hồ (x ≈ 850, z ∈ [-1.100, 1.100])
  const dxRunway = Math.abs(x - RUNWAY_CONFIG.centerX);
  const dzRunway = Math.abs(z - RUNWAY_CONFIG.centerZ);
  if (dxRunway < 420 && dzRunway < 1450) {
    const blendX = 1.0 - MathUtils.smoothstep(260.0, 410.0, dxRunway);
    const blendZ = 1.0 - MathUtils.smoothstep(1180.0, 1440.0, dzRunway);
    const runwayFlatten = blendX * blendZ;
    h = MathUtils.lerp(h, RUNWAY_CONFIG.elevation, runwayFlatten);
  }

  // The airfield sits in a continuous valley with clear runway approaches.
  if (dxRunway < 420 && dzRunway < 6000) {
    const corridor = (1 - MathUtils.smoothstep(70, 420, dxRunway)) * (1 - MathUtils.smoothstep(4500, 6000, dzRunway));
    const corridorHeight = RUNWAY_CONFIG.elevation + Math.max(0, dzRunway - 1100) * 0.025;
    h = MathUtils.lerp(h, Math.min(h, corridorHeight), corridor);
  }
  const coast = MathUtils.smoothstep(6200, 9000, x + Math.sin(z * 0.00035) * 650);
  return MathUtils.lerp(h, -55, coast);
}

export function getTerrainHeight(x: number, z: number): number {
  return Math.max(getMainlandHeight(x, z), getIslandHeight(x, z));
}

let surfaceCoordinates: Float32Array | null = null;
let surfaceHeights: Float32Array | null = null;

// Barycentric interpolation matches the triangles submitted to the GPU.
export function getSurfaceHeight(x: number, z: number): number {
  if (!surfaceCoordinates || !surfaceHeights) return getTerrainHeight(x, z);
  const coordinates = surfaceCoordinates, heights = surfaceHeights;
  const count = coordinates.length;
  const cell = (value: number): number => {
    let low = 0, high = count - 1;
    while (high - low > 1) {
      const middle = (low + high) >>> 1;
      if (coordinates[middle] > value) high = middle;
      else low = middle;
    }
    return Math.min(count - 2, low);
  };
  const ix = cell(x), iz = cell(z);
  const fx = MathUtils.clamp((x - coordinates[ix]) / (coordinates[ix + 1] - coordinates[ix]), 0, 1);
  const fz = MathUtils.clamp((z - coordinates[iz]) / (coordinates[iz + 1] - coordinates[iz]), 0, 1);
  const a = heights[iz * count + ix], b = heights[(iz + 1) * count + ix];
  const c = heights[(iz + 1) * count + ix + 1], d = heights[iz * count + ix + 1];
  const mainland = fx + fz <= 1 ? a + (d - a) * fx + (b - a) * fz : c + (b - c) * (1 - fx) + (d - c) * (1 - fz);
  return Math.max(mainland, getIslandHeight(x, z));
}

export function getTerrainNormal(x: number, z: number, outNormal = new Vector3()): Vector3 {
  const eps = 2.0;
  const hL = getSurfaceHeight(x - eps, z);
  const hR = getSurfaceHeight(x + eps, z);
  const hD = getSurfaceHeight(x, z - eps);
  const hU = getSurfaceHeight(x, z + eps);
  return outNormal.set(hL - hR, 2.0 * eps, hD - hU).normalize();
}

export function isPointOnRunway(x: number, z: number): boolean {
  return (
    Math.abs(x - RUNWAY_CONFIG.centerX) <= RUNWAY_CONFIG.width * 0.65 &&
    Math.abs(z - RUNWAY_CONFIG.centerZ) <= RUNWAY_CONFIG.length * 0.52
  );
}

export class WildernessEnvironment {
  root = new Group();
  private terrainMesh: Mesh | null = null;
  private waterMesh: Mesh | null = null;
  private nearWaterMesh: Mesh | null = null;
  private treeInstancedMesh: InstancedMesh | null = null;
  private farTreeMesh: InstancedMesh | null = null;
  private treeMatrices = new Float32Array();
  private treeColors = new Float32Array();
  private lastTreeFocus = new Vector3(Infinity, Infinity, Infinity);
  treeLod = { near: 0, far: 0 };
  private rockInstancedMesh: InstancedMesh | null = null;
  private windsockCone: Mesh | null = null;

  constructor(scene: Scene, quality: QualityConfig, private gl?: WebGL2RenderingContext) {
    scene.add(this.root);
    this.buildSkyAndWater();
    this.buildAirfieldAndStructures();
    const karstMaterial = new Material({ shaderType: 'terrain' });
    const karst = new Mesh(GeometryBuilder.mergeWithColors(islands.map(island => ({ geo: createIslandGeometry(island), color: new Color(0xffffff) }))), karstMaterial);
    karst.receiveShadow = true; this.root.add(karst);
    this.rebuildScalableAssets(quality);
    this.buildKarstVegetation();
  }

  private buildKarstVegetation(): void {
    const foliage = GeometryBuilder.createLoftedSections([
      { z: -1, rx: 0.3, ryTop: 0.2, ryBot: 0.2, yOffset: 0, power: 1 },
      { z: -0.4, rx: 0.95, ryTop: 0.8, ryBot: 0.3, yOffset: 0, power: 0.8 },
      { z: 0.4, rx: 1, ryTop: 0.7, ryBot: 0.3, yOffset: 0, power: 0.8 },
      { z: 1, rx: 0.25, ryTop: 0.15, ryBot: 0.15, yOffset: 0, power: 1 }
    ], 8);
    const canopy = new InstancedMesh(foliage, new Material({ color: 0x486a38, roughness: 0.95 }), islands.length * 56);
    const transform = new Matrix4(), position = new Vector3(), scale = new Vector3(), rotation = new Quaternion(), tint = new Color();
    let count = 0;
    for (const island of islands) for (let i = 0; i < 56; i++) {
      const x = island.x + (hash2D(island.seed, i * 3) * 2 - 1) * island.rx * 0.78;
      const z = island.z + (hash2D(island.seed, i * 3 + 1) * 2 - 1) * island.rz * 0.78;
      const y = getIslandHeight(x, z);
      if (y < 25) continue;
      const normal = getTerrainNormal(x, z);
      if (normal.y < 0.65) continue;
      const size = 4 + hash2D(island.seed + 70, i) * 8;
      position.set(x, y + size * 0.12, z); scale.set(size, size * 0.8, size);
      transform.compose(position, rotation, scale); canopy.setMatrixAt(count, transform);
      const shade = 0.72 + hash2D(island.seed + 90, i) * 0.5;
      tint.setRGB(shade * 0.85, shade, shade * 0.8); canopy.setColorAt(count++, tint);
    }
    canopy.count = count; this.root.add(canopy);
  }

  get forestGeometry(): BufferGeometry | null { return this.treeInstancedMesh?.geometry || null; }

  private releaseMesh(mesh: Mesh): void {
    if (!this.gl) return;
    for (const buffer of mesh.geometry.gpuBuffers) this.gl.deleteBuffer(buffer);
    mesh.geometry.gpuBuffers = [];
    this.gl.deleteVertexArray(mesh.geometry.vao);
    if (mesh instanceof InstancedMesh) {
      this.gl.deleteBuffer(mesh.instanceMatrixBuffer);
      this.gl.deleteBuffer(mesh.instanceColorBuffer);
    }
  }

  private buildSkyAndWater(): void {
    // 1. Vòm bầu trời (Sky Dome)
    const skyGeo = GeometryBuilder.createBox(180000, 180000, 180000);
    const skyMat = new Material({ shaderType: 'sky', doubleSided: true });
    const skyMesh = new Mesh(skyGeo, skyMat);
    this.root.add(skyMesh);

    // 2. Mặt nước hồ và sông vùng Alps
    const waterGeo = GeometryBuilder.createPlane(WORLD_SIZE, WORLD_SIZE, 64, 64, false);
    const waterMat = new Material({
      shaderType: 'water',
      roughness: 1,
      transparent: true,
      opacity: 0.94
    });
    this.waterMesh = new Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = LAKE_LEVEL;
    this.root.add(this.waterMesh);
    this.nearWaterMesh = new Mesh(GeometryBuilder.createPlane(8000, 8000, 256, 256, false), new Material({ shaderType: 'water', roughness: 0.1, transparent: true }));
    this.root.add(this.nearWaterMesh);
  }

  private buildAirfieldAndStructures(): void {
    const airfieldGroup = new Group();
    const rx = RUNWAY_CONFIG.centerX;
    const ry = RUNWAY_CONFIG.elevation;
    const rz = RUNWAY_CONFIG.centerZ;

    // 1. Nền đường băng nhựa đường (Asphalt Runway)
    const rwyGeo = GeometryBuilder.createPlane(RUNWAY_CONFIG.width, RUNWAY_CONFIG.length, 4, 32, false);
    const rwyMat = new Material({ color: 0x2b2e33, roughness: 0.82, metalness: 0.04 });
    const rwyMesh = new Mesh(rwyGeo, rwyMat);
    rwyMesh.position.set(rx, ry + 0.08, rz);
    rwyMesh.receiveShadow = true;
    airfieldGroup.add(rwyMesh);

    // 2. Vạch kẻ đường băng trắng (Centerline, Thresholds & Aiming Point Markers)
    const stripeMat = new Material({ color: 0xefefef, roughness: 0.6, metalness: 0.02 });
    const dashGeo = GeometryBuilder.createPlane(0.85, 22.0, 1, 1, false);
    for (let z = -RUNWAY_CONFIG.length / 2 + 100; z <= RUNWAY_CONFIG.length / 2 - 100; z += 44) {
      const dash = new Mesh(dashGeo, stripeMat);
      dash.position.set(rx, ry + 0.12, rz + z);
      airfieldGroup.add(dash);
    }
    const threshGeo = GeometryBuilder.createPlane(1.4, 26.0, 1, 1, false);
    for (const endZ of [-RUNWAY_CONFIG.length / 2 + 35, RUNWAY_CONFIG.length / 2 - 35]) {
      for (let ix = -12; ix <= 12; ix += 3.2) {
        if (Math.abs(ix) < 2) continue;
        const bar = new Mesh(threshGeo, stripeMat);
        bar.position.set(rx + ix, ry + 0.12, rz + endZ);
        airfieldGroup.add(bar);
      }
    }

    // 3. Đường lăn (Taxiway) & Sân đỗ (Apron) + Nhà chứa máy bay (Hangar) + Tháp điều khiển nhỏ
    const apronGeo = GeometryBuilder.createPlane(180, 320, 2, 2, false);
    const apronMesh = new Mesh(apronGeo, rwyMat);
    apronMesh.position.set(rx + 130, ry + 0.07, rz + 120);
    airfieldGroup.add(apronMesh);

    const taxiway = new Mesh(GeometryBuilder.createPlane(20, RUNWAY_CONFIG.length - 120, 1, 12, false), rwyMat);
    taxiway.position.set(rx + 65, ry + 0.07, rz); airfieldGroup.add(taxiway);
    for (const z of [-850, 0, 850]) {
      const connector = new Mesh(GeometryBuilder.createPlane(90, 24, 1, 1, false), rwyMat);
      connector.position.set(rx + 35, ry + 0.07, rz + z); airfieldGroup.add(connector);
    }
    const hangarWallMat = new Material({ color: 0xd8dde4, roughness: 0.55, metalness: 0.25 });
    const hangarRoofMat = new Material({ color: 0x264b73, roughness: 0.48, metalness: 0.35 });
    const woodMat = new Material({ color: 0x6b472c, roughness: 0.78, metalness: 0.02 });
    const chaletRoofMat = new Material({ color: 0x7a2f24, roughness: 0.68, metalness: 0.08 });

    // Hangar chính
    const hangarBody = new Mesh(GeometryBuilder.createBox(42, 11, 52, 0, 5.5, 0), hangarWallMat);
    hangarBody.position.set(rx + 210, ry, rz + 110);
    hangarBody.castShadow = true;
    airfieldGroup.add(hangarBody);

    const hangarRoof = new Mesh(GeometryBuilder.createCylinder(22.5, 22.5, 53, 16, 'z'), hangarRoofMat);
    hangarRoof.scale.set(1, 0.35, 1);
    hangarRoof.position.set(rx + 210, ry + 11, rz + 110);
    hangarRoof.castShadow = true;
    airfieldGroup.add(hangarRoof);

    // Tháp quan sát sân bay (Control Tower)
    const towerBase = new Mesh(GeometryBuilder.createBox(6.5, 12.0, 6.5, 0, 6.0, 0), hangarWallMat);
    towerBase.position.set(rx + 105, ry, rz + 62);
    towerBase.castShadow = true;
    airfieldGroup.add(towerBase);

    const towerCab = new Mesh(
      GeometryBuilder.createCylinder(4.6, 3.8, 3.4, 8, 'y'),
      new Material({ color: 0x8cc2e8, roughness: 0.15, metalness: 0.4, clearcoat: 0.8 })
    );
    towerCab.position.set(rx + 105, ry + 13.7, rz + 62);
    airfieldGroup.add(towerCab);

    const towerRoof = new Mesh(GeometryBuilder.createCylinder(0.2, 5.2, 1.8, 8, 'y'), hangarRoofMat);
    towerRoof.position.set(rx + 105, ry + 16.2, rz + 62);
    airfieldGroup.add(towerRoof);

    // Cột gió (Windsock) bên cạnh đường băng
    const pole = new Mesh(GeometryBuilder.createCylinder(0.08, 0.12, 6.5, 8, 'y'), stripeMat);
    pole.position.set(rx - 42, ry + 3.25, rz - 220);
    airfieldGroup.add(pole);

    const sockGeo = GeometryBuilder.createCylinder(0.22, 0.55, 2.4, 12, 'z');
    const sockMat = new Material({ color: 0xff5a1f, roughness: 0.65, emissive: 0x331000 });
    this.windsockCone = new Mesh(sockGeo, sockMat);
    this.windsockCone.position.set(rx - 42, ry + 6.2, rz - 220);
    airfieldGroup.add(this.windsockCone);

    // 4. Các ngôi nhà gỗ vùng Alps (Alpine Chalets) & Cầu tàu gỗ ven hồ tạo cảm giác tỷ lệ có người sinh sống
    const chaletCoords = [
      { x: 640, z: -320, rot: 0.4 },
      { x: 615, z: -265, rot: -0.2 },
      { x: 660, z: -210, rot: 0.8 },
      { x: -1150, z: -420, rot: 1.1 },
      { x: -1190, z: -360, rot: 0.6 },
      { x: -980, z: 680, rot: -0.5 },
      { x: 520, z: 890, rot: 0.3 }
    ];
    for (const c of chaletCoords) {
      const cy = getTerrainHeight(c.x, c.z);
      if (cy < 2.0) continue;
      const chalet = new Group();
      chalet.position.set(c.x, cy, c.z);
      chalet.rotation.y = c.rot;
      const base = new Mesh(GeometryBuilder.createBox(9.5, 5.2, 12.0, 0, 2.6, 0), woodMat);
      base.castShadow = true;
      const roof = new Mesh(GeometryBuilder.createCylinder(0.2, 8.2, 3.8, 4, 'y'), chaletRoofMat);
      roof.rotation.y = Math.PI * 0.25;
      roof.position.set(0, 6.9, 0);
      roof.castShadow = true;
      chalet.add(base);
      chalet.add(roof);
      airfieldGroup.add(chalet);
    }

    // Cầu tàu gỗ nhỏ vươn ra mặt hồ gần sân bay
    const pierX = 535;
    const pierZ = -180;
    const pierDeck = new Mesh(GeometryBuilder.createBox(26, 0.4, 4.2), woodMat);
    pierDeck.position.set(pierX, LAKE_LEVEL + 0.9, pierZ);
    airfieldGroup.add(pierDeck);

    this.root.add(airfieldGroup);
  }

  /**
   * Dựng hoặc cập nhật lưới địa hình, rừng thông InstancedMesh, đá và mây theo mức chất lượng đồ họa
   */
  rebuildScalableAssets(quality: QualityConfig): void {
    // 1. Lưới địa hình (Terrain Mesh 120 × 120 km với mật độ cao hơn ở vùng thung lũng trung tâm)
    if (this.terrainMesh) {
      this.releaseMesh(this.terrainMesh);
      this.root.remove(this.terrainMesh);
    }
    const segs = quality.terrainSegments;
    const vCount = (segs + 1) * (segs + 1);
    const positions = new Float32Array(vCount * 3);
    const uvs = new Float32Array(vCount * 2);
    const indices = vCount > 65535 ? new Uint32Array(segs * segs * 6) : new Uint16Array(segs * segs * 6);

    // Ánh xạ phi tuyến nhẹ từ [-1, 1] ra [-60000, 60000] để vùng trung tâm (hồ & đường băng) có độ phân giải lưới rất mịn
    const mapCoord = (t: number): number => {
      const s = Math.sign(t);
      const a = Math.abs(t);
      return s * (a * 0.08 + a * a * 0.22 + a * a * a * 0.70) * (WORLD_SIZE * 0.5);
    };

    surfaceCoordinates = new Float32Array(segs + 1);
    surfaceHeights = new Float32Array(vCount);
    let pIdx = 0, uIdx = 0;
    for (let iz = 0; iz <= segs; iz++) {
      const tz = (iz / segs) * 2.0 - 1.0;
      const wz = mapCoord(tz);
      for (let ix = 0; ix <= segs; ix++) {
        const tx = (ix / segs) * 2.0 - 1.0;
        const wx = mapCoord(tx);
        const wy = getMainlandHeight(wx, wz);
        surfaceCoordinates[ix] = wx;
        surfaceHeights[iz * (segs + 1) + ix] = wy;
        positions[pIdx] = wx;
        positions[pIdx + 1] = wy;
        positions[pIdx + 2] = wz;
        uvs[uIdx] = ix / segs;
        uvs[uIdx + 1] = iz / segs;
        pIdx += 3;
        uIdx += 2;
      }
    }

    let iIdx = 0;
    for (let iz = 0; iz < segs; iz++) {
      for (let ix = 0; ix < segs; ix++) {
        const a = ix + (segs + 1) * iz;
        const b = ix + (segs + 1) * (iz + 1);
        const c = (ix + 1) + (segs + 1) * (iz + 1);
        const d = (ix + 1) + (segs + 1) * iz;
        indices[iIdx++] = a; indices[iIdx++] = b; indices[iIdx++] = d;
        indices[iIdx++] = b; indices[iIdx++] = c; indices[iIdx++] = d;
      }
    }

    const normals = GeometryBuilder.computeVertexNormals(positions, indices);
    const terrainGeo = new BufferGeometry({ positions, normals, uvs, indices });
    const terrainMat = new Material({ shaderType: 'terrain' });
    this.terrainMesh = new Mesh(terrainGeo, terrainMat);
    this.terrainMesh.name = 'Mainland';
    this.terrainMesh.receiveShadow = true;
    this.root.add(this.terrainMesh);

    // 2. Rừng thông vùng Alps (InstancedMesh với hàng nghìn cây 3 tầng tán lá + thân gỗ)
    if (this.treeInstancedMesh) {
      this.releaseMesh(this.treeInstancedMesh);
      this.root.remove(this.treeInstancedMesh);
    }
    if (this.farTreeMesh) { this.releaseMesh(this.farTreeMesh); this.root.remove(this.farTreeMesh); }
    const crown = spruceCrown();
    const trunk = GeometryBuilder.createCylinder(0.13, 0.28, 9, 8, 'y');
    const pineGeo = GeometryBuilder.mergeWithColors([
      { geo: trunk, color: new Color(0x4a3525), offset: new Vector3(0, 4.5, 0) },
      { geo: crown, color: new Color(0x234b26) }
    ]);
    const trunkVertices = trunk.vertexCount;
    pineGeo.colors!.set(crown.colors!, trunkVertices * 3);
    const pineMat = new Material({ shaderType: 'pbr', color: 0xffffff, roughness: 0.97, metalness: 0.0, doubleSided: true, foliage: true });
    this.treeInstancedMesh = new InstancedMesh(pineGeo, pineMat, quality.treeCount);
    this.treeInstancedMesh.castShadow = false;
    this.treeInstancedMesh.receiveShadow = true;

    const dummyMat = new Matrix4();
    const posVec = new Vector3();
    const quat = new Quaternion();
    const euler = new Euler();
    const scaleVec = new Vector3();
    const treeColor = new Color();
    const normVec = new Vector3();

    let placedTrees = 0;
    let seed = 1;
    while (placedTrees < quality.treeCount && seed < quality.treeCount * 8) {
      seed++;
      const r1 = hash2D(seed, 101);
      const r2 = hash2D(seed, 202);
      // Phân bố ưu tiên trong bán kính 6.5 km quanh thung lũng để mật độ rừng dày và đẹp
      const angle = r1 * Math.PI * 2;
      const dist = 280 + Math.pow(r2, 0.68) * 4200;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist - 350;

      // Phân cụm tự nhiên bằng noise
      const cluster = valueNoise2D(tx * 0.0045, tz * 0.0045);
      if (cluster < 0.28) continue;

      // Không mọc trên đường băng và sân đỗ
      if (Math.abs(tx - RUNWAY_CONFIG.centerX) < 95 && Math.abs(tz - RUNWAY_CONFIG.centerZ) < 3400) continue;

      const ty = getSurfaceHeight(tx, tz);
      // Không mọc dưới nước (< 3.5m) hoặc cao hơn giới hạn cây (1.000 m)
      if (ty < 3.5 || ty > 1000.0) continue;

      getTerrainNormal(tx, tz, normVec);
      // Không mọc ở vách đá dựng đứng
      if (normVec.y < 0.72) continue;

      const s = 1.35 + hash2D(seed, 303) * 1.45;
      posVec.set(tx, ty - 0.2, tz);
      euler.set(
        (hash2D(seed, 404) - 0.5) * 0.08,
        hash2D(seed, 505) * Math.PI * 2,
        (hash2D(seed, 606) - 0.5) * 0.08
      );
      quat.setFromEuler(euler);
      scaleVec.set(s, s * (0.9 + hash2D(seed, 707) * 0.25), s);
      dummyMat.compose(posVec, quat, scaleVec);
      this.treeInstancedMesh.setMatrixAt(placedTrees, dummyMat);

      const shade = 0.82 + hash2D(seed, 808) * 0.36;
      treeColor.setRGB(shade * 0.95, shade, shade * 0.9);
      this.treeInstancedMesh.setColorAt(placedTrees, treeColor);
      placedTrees++;
    }
    this.treeMatrices = this.treeInstancedMesh.instanceMatrices.slice(0, placedTrees * 16);
    this.treeColors = this.treeInstancedMesh.instanceColors.slice(0, placedTrees * 3);
    const farGeo = GeometryBuilder.createPlane(15.6 * 0.5, 15.6, 1, 1, true);
    for (let i = 1; i < farGeo.positions.length; i += 3) farGeo.positions[i] += 7;
    this.farTreeMesh = new InstancedMesh(farGeo, new Material({ treeBillboard: true, doubleSided: true, roughness: 1 }), quality.treeCount);
    this.farTreeMesh.count = 0;
    this.root.add(this.farTreeMesh);
    this.lastTreeFocus.set(Infinity, Infinity, Infinity);
    this.treeInstancedMesh.count = placedTrees;
    this.root.add(this.treeInstancedMesh);

    // 3. Những mảng đá lộ thiên ven hồ và sườn núi (Instanced Boulders)
    if (this.rockInstancedMesh) {
      this.releaseMesh(this.rockInstancedMesh);
      this.root.remove(this.rockInstancedMesh);
    }
    const rockGeo = GeometryBuilder.createCylinder(1.2, 2.2, 2.4, 6, 'y');
    const rockMat = new Material({ shaderType: 'pbr', color: 0x676b70, roughness: 0.88, metalness: 0.05 });
    this.rockInstancedMesh = new InstancedMesh(rockGeo, rockMat, quality.rockCount);
    let placedRocks = 0;
    let rSeed = 50000;
    while (placedRocks < quality.rockCount && rSeed < 50000 + quality.rockCount * 6) {
      rSeed++;
      const angle = hash2D(rSeed, 11) * Math.PI * 2;
      const dist = 250 + Math.pow(hash2D(rSeed, 22), 0.8) * 5800;
      const rx = Math.cos(angle) * dist;
      const rz = Math.sin(angle) * dist;
      if (Math.abs(rx - RUNWAY_CONFIG.centerX) < 120 && Math.abs(rz - RUNWAY_CONFIG.centerZ) < 720) continue;
      const ry = getSurfaceHeight(rx, rz);
      if (ry < 0.2 || ry > 680) continue;
      const sx = 0.8 + hash2D(rSeed, 33) * 2.8;
      const sy = 0.5 + hash2D(rSeed, 44) * 1.6;
      const sz = 0.8 + hash2D(rSeed, 55) * 2.8;
      posVec.set(rx, ry + sy * 0.3, rz);
      euler.set(hash2D(rSeed, 66) * 0.5, hash2D(rSeed, 77) * 6.28, hash2D(rSeed, 88) * 0.5);
      quat.setFromEuler(euler);
      scaleVec.set(sx, sy, sz);
      dummyMat.compose(posVec, quat, scaleVec);
      this.rockInstancedMesh.setMatrixAt(placedRocks, dummyMat);
      const g = 0.75 + hash2D(rSeed, 99) * 0.4;
      treeColor.setRGB(g, g, g * 1.03);
      this.rockInstancedMesh.setColorAt(placedRocks, treeColor);
      placedRocks++;
    }
    this.rockInstancedMesh.count = placedRocks;
    this.root.add(this.rockInstancedMesh);

  }

  /**
   * Tính mật độ mây tại vị trí máy bay (0.0 -> 1.0) để làm mờ tầm nhìn mượt mà khi bay xuyên qua mây
   */
  getCloudDensityAt(pos: Vector3): number {
    const layer = MathUtils.smoothstep(1450, 1750, pos.y) * (1 - MathUtils.smoothstep(2100, 2350, pos.y));
    return layer * this.cloudCoverage;
  }

  cloudCoverage = 0.38;

  update(time: number, windDirRad: number, windSpeedMs: number, focus?: Vector3): void {
    if (focus && this.nearWaterMesh) this.nearWaterMesh.position.set(Math.round(focus.x / 500) * 500, 0, Math.round(focus.z / 500) * 500);
    if (focus && this.treeInstancedMesh && this.farTreeMesh && focus.clone().sub(this.lastTreeFocus).lengthSq() > 3600) {
      this.lastTreeFocus.copy(focus);
      let near = 0, far = 0;
      for (let i = 0; i < this.treeMatrices.length / 16; i++) {
        const dx = this.treeMatrices[i * 16 + 12] - focus.x;
        const dz = this.treeMatrices[i * 16 + 14] - focus.z;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared > 6000 * 6000) continue;
        const detailed = distanceSquared < 650 * 650;
        const mesh = detailed ? this.treeInstancedMesh : this.farTreeMesh;
        const index = detailed ? near++ : far++;
        mesh.instanceMatrices.set(this.treeMatrices.subarray(i * 16, i * 16 + 16), index * 16);
        mesh.instanceColors.set(this.treeColors.subarray(i * 3, i * 3 + 3), index * 3);
      }
      this.treeInstancedMesh.count = near; this.farTreeMesh.count = far;
      this.treeInstancedMesh.needsInstanceUpload = true; this.farTreeMesh.needsInstanceUpload = true;
      this.treeLod = { near, far };
    }
    if (this.windsockCone) {
      this.windsockCone.rotation.y = windDirRad;
      this.windsockCone.rotation.x = Math.sin(time * 3.5) * 0.08 * MathUtils.clamp(windSpeedMs * 0.2, 0.2, 1.5);
    }
  }
}
