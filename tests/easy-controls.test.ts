import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { flightMouseAxis } from '../src/control-response';
import { FlightPhysicsEngine } from '../src/physics';
import { setAlpineElevationData } from '../src/elevation-data';
import { ControlInputs, UserSettings } from '../src/types';

const elevation = readFileSync(new URL('../public/assets/terrain/alps.dem', import.meta.url));
setAlpineElevationData(elevation.buffer.slice(elevation.byteOffset, elevation.byteOffset + elevation.byteLength) as ArrayBuffer);
const idle: ControlInputs = { pitchUp: false, pitchDown: false, rollLeft: false, rollRight: false, yawLeft: false, yawRight: false, throttleUp: false, throttleDown: false, brakes: false, trimUp: false, trimDown: false };

test('mouse center drift is neutral while fine input remains symmetric and full authority remains available', () => {
  for (const input of [-0.04, -0.001, 0, 0.001, 0.04]) assert.equal(flightMouseAxis(input), 0);
  assert.equal(flightMouseAxis(1), 1); assert.equal(flightMouseAxis(-1), -1);
  assert.ok(flightMouseAxis(0.3) > 0 && flightMouseAxis(0.3) < 0.3);
  assert.equal(flightMouseAxis(0.3), -flightMouseAxis(-0.3));
});

test('held assisted turns remain gentle at maximum sensitivity and recover level after release', () => {
  for (const id of ['skyhawk', 'ranger', 'coastal'] as const) {
    const engine = new FlightPhysicsEngine(id);
    engine.position.set(30000, 1500, 10000); engine.throttle = 0.85;
    const settings = { flightMode: 'assisted', invertPitch: false, controlSensitivity: 2 } as UserSettings;
    let peakBank = 0;
    for (let frame = 0; frame < 12 * 120; frame++) {
      engine.update(1 / 120, frame < 5 * 120 ? { ...idle, rollRight: true } : idle, settings, 0);
      peakBank = Math.max(peakBank, Math.abs(engine.telemetry.rollDeg));
    }
    assert.equal(engine.telemetry.crashed, false, id);
    assert.ok(peakBank > 10 && peakBank < 30, `${id}: ${peakBank} degrees`);
    assert.ok(Math.abs(engine.telemetry.rollDeg) < 2, `${id}: ${engine.telemetry.rollDeg} degrees after release`);
    assert.ok(engine.telemetry.iasKnots > 60);
  }
});
