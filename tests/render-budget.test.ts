import { readFileSync } from 'node:fs';
import { setAlpineElevationData } from '../src/elevation-data';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRenderScale } from '../src/render-budget';
import { WildernessEnvironment } from '../src/terrain';
import { QUALITY_PRESETS } from '../src/types';
import { InstancedMesh, Scene, Vector3 } from '../src/webgl2-three';

setAlpineElevationData(readFileSync(new URL('../public/assets/terrain/alps.dem', import.meta.url)).buffer as ArrayBuffer);

test('render budget reduces overload and recovers detail with hysteresis', () => {
  assert.ok(nextRenderScale(1, 30) < 1);
  assert.ok(nextRenderScale(0.7, 8) > 0.7);
  assert.equal(nextRenderScale(0.8, 16.6), 0.8);
  assert.equal(nextRenderScale(0.55, 100), 0.55);
  assert.equal(nextRenderScale(1, 2), 1);
  assert.equal(nextRenderScale(0.7, NaN), 0.7);
});

test('distant forest uses a two triangle impostor covering the full tree height', () => {
  const environment = new WildernessEnvironment(new Scene(), { ...QUALITY_PRESETS.low, treeCount: 0, rockCount: 0 });
  const meshes = environment.root.children.filter(child => child instanceof InstancedMesh) as InstancedMesh[];
  const detailed = meshes.find(mesh => mesh.material.foliage)!;
  const distant = meshes.find(mesh => mesh.material.treeBillboard)!;
  assert.equal(distant.geometry.indexCount, 6);
  assert.ok(detailed.geometry.indexCount > distant.geometry.indexCount * 30);
  const heights = (positions: Float32Array) => Array.from(positions).filter((_, index) => index % 3 === 1);
  assert.ok(Math.max(...heights(distant.geometry.positions)) >= Math.max(...heights(detailed.geometry.positions)));
  assert.ok(Math.min(...heights(distant.geometry.positions)) <= 0);
});

test('tree LOD restores the full population when the camera returns', () => {
  const environment = new WildernessEnvironment(new Scene(), { ...QUALITY_PRESETS.low, treeCount: 300, rockCount: 0 });
  environment.update(0, 0, 0, new Vector3(0, 400, 0));
  const population = environment.treeLod.near + environment.treeLod.far;
  assert.equal(population, 300);
  environment.update(0, 0, 0, new Vector3(20000, 400, 0));
  assert.equal(environment.treeLod.near + environment.treeLod.far, 0);
  environment.update(0, 0, 0, new Vector3(0, 400, 0));
  assert.equal(environment.treeLod.near + environment.treeLod.far, population);
});
