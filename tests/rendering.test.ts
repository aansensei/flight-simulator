import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AIRFIELD_PAVEMENT, isAirfieldPavement, RUNWAY_CONFIG } from '../src/airfield-surface';
import { geometrySphere, RenderFrustum } from '../src/render-culling';
import { setAlpineElevationData } from '../src/elevation-data';
import { WildernessEnvironment, getSurfaceHeight } from '../src/terrain';
import { QUALITY_PRESETS } from '../src/types';
import { GeometryBuilder, InstancedMesh, Material, Matrix4, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from '../src/webgl2-three';

const elevation = readFileSync(new URL('../public/assets/terrain/alps.dem', import.meta.url));
setAlpineElevationData(elevation.buffer.slice(elevation.byteOffset, elevation.byteOffset + elevation.byteLength) as ArrayBuffer);

test('runway, taxiway and apron share the physical terrain elevation at Low and Ultra', () => {
  for (const quality of [QUALITY_PRESETS.low, QUALITY_PRESETS.ultra]) {
    new WildernessEnvironment(new Scene(), { ...quality, treeCount: 0, rockCount: 0 });
    for (const rect of AIRFIELD_PAVEMENT) for (const x of [-0.49, 0, 0.49]) for (const z of [-0.49, 0, 0.49]) {
      const worldX = rect.x + x * rect.width, worldZ = rect.z + z * rect.length;
      assert.ok(isAirfieldPavement(worldX, worldZ));
      assert.ok(Math.abs(getSurfaceHeight(worldX, worldZ) - RUNWAY_CONFIG.elevation) < 0.01, `${worldX}, ${worldZ}`);
    }
  }
});

test('airport pavement and both runway ends remain free of generated boulders', () => {
  const environment = new WildernessEnvironment(new Scene(), { ...QUALITY_PRESETS.low, treeCount: 0, rockCount: 1000 });
  const rocks = environment.root.children.find(child => child instanceof InstancedMesh && Math.abs(child.material.color.r - 0x67 / 255) < 1e-6) as InstancedMesh;
  assert.ok(rocks.count > 100);
  for (let i = 0; i < rocks.count; i++) assert.equal(isAirfieldPavement(rocks.instanceMatrices[i * 16 + 12], rocks.instanceMatrices[i * 16 + 14], 10), false);
});

test('view and reflection frusta reject hidden meshes independently without clipping boundary spheres', () => {
  const camera = new PerspectiveCamera(60, 1, 0.18, 1000);
  camera.lookAt(new Vector3(0, 0, -1));
  const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.viewMatrix);
  const view = new RenderFrustum(); view.set(matrix.elements);
  const object = new Matrix4();
  assert.equal(view.intersects({ x: 0, y: 0, z: -10, radius: 1 }, object.elements), true);
  assert.equal(view.intersects({ x: 0, y: 0, z: 10, radius: 1 }, object.elements), false);
  assert.equal(view.intersects({ x: 0, y: 0, z: -1200, radius: 1 }, object.elements), false);
  assert.equal(view.intersects({ x: 100, y: 0, z: -10, radius: 1 }, object.elements), false);
  assert.equal(view.intersects({ x: 6, y: 0, z: -10, radius: 1 }, object.elements), true);
  const reflection = new RenderFrustum();
  camera.lookAt(new Vector3(0, 0, 1));
  reflection.set(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.viewMatrix).elements);
  assert.equal(reflection.intersects({ x: 0, y: 0, z: 10, radius: 1 }, object.elements), true);
  assert.equal(view.intersects({ x: 0, y: 0, z: 10, radius: 1 }, object.elements), false);
  const sphere = geometrySphere(new Float32Array([-2, -1, -3, 4, 5, 3]));
  assert.deepEqual({ x: sphere.x, y: sphere.y, z: sphere.z }, { x: 1, y: 2, z: 0 });
  assert.ok(sphere.radius >= Math.sqrt(27));
});

test('reflection trees use independent VAOs and shared active CPU arrays', () => {
  const environment = new WildernessEnvironment(new Scene(), { ...QUALITY_PRESETS.low, treeCount: 300, rockCount: 0 });
  const near = environment.root.children.find(child => child instanceof InstancedMesh && child.material.foliage) as InstancedMesh;
  const far = environment.root.children.find(child => child instanceof InstancedMesh && child.material.treeBillboard) as InstancedMesh;
  assert.ok(near.reflectionProxy?.material.treeBillboard);
  assert.notEqual(near.reflectionProxy!.geometry, far.geometry);
  assert.equal(near.reflectionProxy!.instanceMatrices, near.instanceMatrices);
  assert.equal(near.reflectionProxy!.geometry.indexCount, 6);
});

test('instance updates reuse GPU storage and upload only active instances', () => {
  let allocations = 0;
  const uploads: number[] = [];
  const gl = {
    bindVertexArray() {}, createBuffer: () => ({}), bindBuffer() {}, bufferData: () => allocations++,
    bufferSubData: (_target: number, _offset: number, _data: Float32Array, _source: number, length: number) => uploads.push(length),
    enableVertexAttribArray() {}, vertexAttribPointer() {}, vertexAttribDivisor() {}, ARRAY_BUFFER: 1, DYNAMIC_DRAW: 2, FLOAT: 3
  };
  const renderer = Object.create(WebGLRenderer.prototype) as any; renderer.gl = gl;
  const mesh = new InstancedMesh(GeometryBuilder.createPlane(2, 2, 1, 1, true), new Material(), 1000);
  mesh.geometry.needsUpload = false; mesh.geometry.vao = {} as WebGLVertexArrayObject;
  mesh.count = 25;
  renderer.ensureGeometryVAO(mesh.geometry, mesh);
  assert.equal(allocations, 2); assert.deepEqual(uploads, [25 * 16, 25 * 3]);
  mesh.count = 40; mesh.needsInstanceUpload = true;
  renderer.ensureGeometryVAO(mesh.geometry, mesh);
  assert.equal(allocations, 2); assert.deepEqual(uploads.slice(2), [40 * 16, 40 * 3]);
});
