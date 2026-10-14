import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRenderScale } from '../src/render-budget';
import { spruceCrown } from '../src/nature-geometry';
import { WildernessEnvironment } from '../src/terrain';
import { QUALITY_PRESETS } from '../src/types';
import { Scene, Vector3 } from '../src/webgl2-three';

test('render budget reduces overload and recovers detail with hysteresis', () => {
  assert.ok(nextRenderScale(1, 30) < 1);
  assert.ok(nextRenderScale(0.7, 8) > 0.7);
  assert.equal(nextRenderScale(0.8, 16.6), 0.8);
  assert.equal(nextRenderScale(0.55, 100), 0.55);
  assert.equal(nextRenderScale(1, 2), 1);
  assert.equal(nextRenderScale(0.7, NaN), 0.7);
});

test('distant spruce keeps its silhouette with fewer triangles', () => {
  const detailed = spruceCrown(), distant = spruceCrown(5, 8);
  assert.ok(distant.indexCount < detailed.indexCount / 3);
  const height = (positions: Float32Array) => {
    let value = -Infinity;
    for (let i = 1; i < positions.length; i += 3) value = Math.max(value, positions[i]);
    return value;
  };
  assert.ok(Math.abs(height(detailed.positions) - height(distant.positions)) < 0.01);
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
