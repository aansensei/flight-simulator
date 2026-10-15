import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseGLB } from '../src/gltf-loader';
import { DETAILED_ISLAND_PLACEMENTS, detailedIslandsRoot, getDetailedIslandHeight, installDetailedIslands, IslandSurface, updateDetailedIslandLOD } from '../src/detailed-islands';
import { Cessna172Model } from '../src/aircraft-model';
import { Mesh, Vector3 } from '../src/webgl2-three';
import { TelemetryData } from '../src/types';
import { FlightPhysicsEngine } from '../src/physics';
import { ScenicPilot } from '../src/scenic-pilot';
import { getSurfaceHeight } from '../src/terrain';
import { setAlpineElevationData } from '../src/elevation-data';
import { UserSettings } from '../src/types';

const bytes = (name: string): ArrayBuffer => {
  const data = readFileSync(new URL(`../public/assets/models/${name}`, import.meta.url));
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
};

test('aircraft keeps embedded PBR maps, glass and true metric dimensions', () => {
  const model = parseGLB(bytes('sightseeing-aircraft.glb'));
  assert.equal(model.triangleCount, 6096);
  assert.equal(model.textures.length, 3);
  assert.ok(model.textures.every(t => t.bytes.length > 1000 && t.mimeType === 'image/jpeg'));
  const paint = model.meshes.find(m => m.material.metallicRoughnessMap)!.material;
  assert.ok(paint.baseColorMap && paint.normalMap && paint.metallicRoughnessMap);
  assert.notEqual(paint.baseColorMap, paint.normalMap);
  const glass = model.meshes.find(m => m.material.transparent)!.material;
  assert.ok(glass.opacity > 0 && glass.opacity < 1 && glass.doubleSided);
  const bounds = { min: new Vector3(Infinity, Infinity, Infinity), max: new Vector3(-Infinity, -Infinity, -Infinity) };
  for (const mesh of model.meshes) for (let i = 0; i < mesh.geometry.positions.length; i += 3) {
    const p = new Vector3(...Array.from(mesh.geometry.positions.subarray(i, i + 3)) as [number, number, number]).applyMatrix4(mesh.matrixWorld);
    for (const axis of ['x', 'y', 'z'] as const) { bounds.min[axis] = Math.min(bounds.min[axis], p[axis]); bounds.max[axis] = Math.max(bounds.max[axis], p[axis]); }
  }
  assert.ok(Math.abs(bounds.max.x - bounds.min.x - 12.1) < 0.001);
  assert.ok(bounds.max.z - bounds.min.z > 8 && bounds.max.z - bounds.min.z < 8.5);
  assert.ok(Math.abs(bounds.min.y + 0.07 + 1.32) < 0.03);
});

test('Ranger binds imported control surfaces and animates them without shifting hinges', () => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({}) }) } as unknown as Document;
  try {
    const model = new Cessna172Model('ranger'), imported = parseGLB(bytes('sightseeing-aircraft.glb'));
    model.applyParsedGLB(imported);
    const hinge = model.flapLeftPivot.position.clone();
    model.updateFromTelemetry({ aileronNorm: 0.5, elevatorNorm: -0.5, rudderNorm: 0.5, flapDeg: 20, rpm: 2400, onGround: true, throttle: 0.8, groundSpeedKnots: 0 } as TelemetryData, 1 / 60, -1, false);
    assert.ok(model.aileronLeftPivot.rotation.x > 0 && model.aileronRightPivot.rotation.x < 0);
    assert.ok(Math.abs(model.flapLeftPivot.rotation.x - Math.PI / 9) < 1e-6);
    assert.deepEqual(model.flapLeftPivot.position, hinge);
    assert.ok(model.rudderPivot.rotation.y > 0 && model.noseWheelPivot.rotation.y < 0);
    assert.ok(model.propellerSolidGroup.rotation.z > 0 && model.propellerBlurMesh.visible);
    assert.ok(model.exteriorGroup.children.includes(imported.root));
  } finally { globalThis.document = original; }
});

test('all six island collision surfaces follow transformed LOD0 triangles and remain stable across display LODs', () => {
  const models = Array.from({ length: 6 }, (_, i) => parseGLB(bytes(`islands/karst-island-0${i + 1}.glb`)));
  installDetailedIslands(models);
  models.forEach((model, index) => {
    const lod0 = model.nodesByName.get('LOD0')!;
    const meshes: Mesh[] = [];
    const collect = (node: any) => { if (node instanceof Mesh) meshes.push(node); node.children.forEach(collect); };
    collect(lod0);
    const triangles = meshes.reduce((count, mesh) => count + mesh.geometry.indexCount / 3, 0);
    assert.equal(triangles, index % 2 ? 9072 : 6048);
    assert.ok(meshes.every(mesh => mesh.material.baseColorMap));
    const surface = new IslandSurface(meshes);
    let tested = 0;
    for (const mesh of meshes) {
      const p = mesh.geometry.positions, indices = mesh.geometry.indices!;
      for (let i = 0; i < indices.length; i += 63) {
        const a = new Vector3(p[indices[i] * 3], p[indices[i] * 3 + 1], p[indices[i] * 3 + 2]).applyMatrix4(mesh.matrixWorld);
        const b = new Vector3(p[indices[i + 1] * 3], p[indices[i + 1] * 3 + 1], p[indices[i + 1] * 3 + 2]).applyMatrix4(mesh.matrixWorld);
        const c = new Vector3(p[indices[i + 2] * 3], p[indices[i + 2] * 3 + 1], p[indices[i + 2] * 3 + 2]).applyMatrix4(mesh.matrixWorld);
        const center = a.add(b).add(c).multiplyScalar(1 / 3);
        if (center.y < 0) continue;
        assert.ok(surface.heightAt(center.x, center.z) >= center.y - 0.001);
        assert.ok(Math.abs(getDetailedIslandHeight(center.x, center.z) - surface.heightAt(center.x, center.z)) < 0.001);
        tested++;
      }
    }
    assert.ok(tested > 100);
    const position = DETAILED_ISLAND_PLACEMENTS[index];
    const height = getDetailedIslandHeight(position.x, position.z);
    for (const distance of [100, 5000, 12000]) {
      updateDetailedIslandLOD(new Vector3(position.x + distance, 500, position.z));
      assert.equal([0, 1, 2].filter(i => model.nodesByName.get(`LOD${i}`)!.visible).length, 1);
      assert.equal(model.nodesByName.get(`LOD${distance === 100 ? 0 : distance === 5000 ? 1 : 2}`)!.visible, true);
      assert.equal(getDetailedIslandHeight(position.x, position.z), height);
    }
  });
  assert.equal(detailedIslandsRoot.children.length, 6);
  assert.equal(getDetailedIslandHeight(0, 0), -60);
});

test('loader rejects truncated chunks, invalid views and cyclic node graphs', () => {
  const source = bytes('sightseeing-aircraft.glb');
  assert.throws(() => parseGLB(source.slice(0, source.byteLength - 4)), /header/);
  const oversized = source.slice(0);
  new DataView(oversized).setUint32(12, oversized.byteLength, true);
  assert.throws(() => parseGLB(oversized), /chunk length/);
  const fixture = (edit: (doc: any) => void): ArrayBuffer => {
    const length = new DataView(source).getUint32(12, true);
    const doc = JSON.parse(new TextDecoder().decode(source.slice(20, 20 + length)));
    edit(doc);
    let json = JSON.stringify(doc);
    json += ' '.repeat((4 - json.length % 4) % 4);
    const encoded = new TextEncoder().encode(json), tail = new Uint8Array(source.slice(20 + length));
    const buffer = new ArrayBuffer(20 + encoded.length + tail.length), view = new DataView(buffer);
    view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
    view.setUint32(12, encoded.length, true); view.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(buffer).set(encoded, 20); new Uint8Array(buffer).set(tail, 20 + encoded.length);
    return buffer;
  };
  assert.throws(() => parseGLB(fixture(doc => doc.bufferViews[3].byteLength = 1)), /accessor/);
  assert.throws(() => parseGLB(fixture(doc => doc.nodes[0].children = [doc.scenes[0].nodes[0]])), /hierarchy/);
});

test('all three aircraft complete a five minute bay tour with imported island contacts installed', () => {
  const elevation = readFileSync(new URL('../public/assets/terrain/alps.dem', import.meta.url));
  setAlpineElevationData(elevation.buffer.slice(elevation.byteOffset, elevation.byteOffset + elevation.byteLength) as ArrayBuffer);
  installDetailedIslands(Array.from({ length: 6 }, (_, i) => parseGLB(bytes(`islands/karst-island-0${i + 1}.glb`))));
  const settings = { flightMode: 'assisted', invertPitch: false, controlSensitivity: 1 } as UserSettings;
  for (const id of ['skyhawk', 'ranger', 'coastal'] as const) {
    const engine = new FlightPhysicsEngine(id), pilot = new ScenicPilot();
    engine.reset('archipelago'); pilot.reset(true);
    let clearance = Infinity;
    for (let frame = 0; frame < 300 * 60 && !engine.telemetry.crashed; frame++) {
      engine.update(1 / 60, pilot.controls(engine), settings, 0);
      clearance = Math.min(clearance, engine.position.y - getSurfaceHeight(engine.position.x, engine.position.z));
    }
    assert.equal(engine.telemetry.crashed, false, `${id}: ${engine.telemetry.crashReason}`);
    assert.ok(clearance > 100, `${id}: clearance ${clearance}`);
    assert.ok(engine.telemetry.iasKnots > 55 && engine.telemetry.iasKnots < 150);
  }
});
