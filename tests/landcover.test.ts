import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { worldToImageryTile } from '../src/landcover';

test('satellite projection preserves the Alps origin and geographic directions', () => {
  const [x, y] = worldToImageryTile(0, 0);
  assert.ok(Math.abs(x - 4271.217777777778) < 1e-8);
  assert.ok(Math.abs(y - 2893.6441759646323) < 1e-8);
  assert.ok(worldToImageryTile(1113.2, 0)[1] < y);
  assert.ok(worldToImageryTile(0, 620)[0] < x);
});

test('every declared satellite tile is bundled as a complete JPEG', () => {
  const base = new URL('../public/assets/landcover/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', base), 'utf8'));
  assert.equal(manifest.zoom, 13);
  assert.equal(manifest.license, 'CC BY 4.0');
  const origin = worldToImageryTile(0, 0);
  assert.ok(origin[0] > manifest.startX && origin[0] < manifest.startX + manifest.columns);
  assert.ok(origin[1] > manifest.startY && origin[1] < manifest.startY + manifest.rows);
  for (let row = 0; row < manifest.rows; row++) for (let col = 0; col < manifest.columns; col++) {
    const name = `${manifest.startY + row}_${manifest.startX + col}.jpg`;
    const image = readFileSync(new URL(name, base));
    assert.equal(image.readUInt16BE(0), 0xffd8, name);
    assert.equal(image.readUInt16BE(image.length - 2), 0xffd9, name);
  }
});
