import { readFileSync } from 'node:fs';
import { setAlpineElevationData } from '../src/elevation-data';
import { AIRCRAFT_PROFILES, AircraftId } from '../src/aircraft-specs';
import { getIslandHeight, islands } from '../src/archipelago';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { airDensity, angularAcceleration, liftCoefficient, propellerThrust } from '../src/flight-math';
import { FlightPhysicsEngine } from '../src/physics';
import { ScenicPilot } from '../src/scenic-pilot';
import { Euler, Mesh, Scene, Vector3 } from '../src/webgl2-three';
import { ControlInputs, QUALITY_PRESETS, UserSettings } from '../src/types';
import { getSurfaceHeight, getTerrainHeight, RUNWAY_CONFIG, WildernessEnvironment } from '../src/terrain';

setAlpineElevationData(readFileSync(new URL('../public/assets/terrain/alps.dem', import.meta.url)).buffer as ArrayBuffer);

const idle: ControlInputs = { pitchUp: false, pitchDown: false, rollLeft: false, rollRight: false, yawLeft: false, yawRight: false, throttleUp: false, throttleDown: false, brakes: false, trimUp: false, trimDown: false };
const settings: UserSettings = { flightMode: 'assisted', quality: 'high', timeOfDay: 'morning', invertPitch: false, controlSensitivity: 1, fov: 60, cockpitVibration: false, soundEnabled: false, showHud: true, showHelp: false, showPerf: false };
const simulate = (engine: FlightPhysicsEngine, seconds: number, fps = 60, inputs = idle) => {
  for (let i = 0; i < seconds * fps; i++) engine.update(1 / fps, inputs, settings, 0);
};

test('propeller useful power never exceeds supplied power, including zero airspeed', () => {
  for (const speed of [0, 1, 20, 50, 100]) {
    for (const density of [1.225, 0.8]) {
      const thrust = propellerThrust(100000, speed, density, 1.9);
      assert.ok(Number.isFinite(thrust) && thrust > 0);
      assert.ok(thrust * speed <= 100000);
    }
  }
  assert.equal(propellerThrust(0, 50, 1.225, 1.9), 0);
  assert.ok(propellerThrust(100000, 70, 1.225, 1.9) < propellerThrust(100000, 20, 1.225, 1.9));
});

test('free rigid body preserves rotational energy and world angular momentum', () => {
  const inertia = new Vector3(1825, 2667, 1285);
  const omega = new Vector3(0.4, 0.3, 0.6);
  const moment = new Vector3();
  const acceleration = angularAcceleration(omega, moment, inertia);
  const energyDerivative = inertia.x * omega.x * acceleration.x + inertia.y * omega.y * acceleration.y + inertia.z * omega.z * acceleration.z;
  assert.ok(Math.abs(energyDerivative) < 1e-10);
  const momentumBody = new Vector3(inertia.x * omega.x, inertia.y * omega.y, inertia.z * omega.z);
  const transport = new Vector3().crossVectors(omega, momentumBody);
  const worldDerivative = new Vector3(inertia.x * acceleration.x, inertia.y * acceleration.y, inertia.z * acceleration.z).add(transport);
  assert.ok(worldDerivative.length() < 1e-10);
});

test('air density decreases with altitude and lift is continuous at stall', () => {
  assert.equal(airDensity(0), 1.225);
  assert.ok(airDensity(2000) < airDensity(500));
  for (const flaps of [0, 10, 20, 30]) {
    const critical = liftCoefficient(0, flaps).critical;
    const left = liftCoefficient(critical - 1e-7, flaps).cl;
    const right = liftCoefficient(critical + 1e-7, flaps).cl;
    assert.ok(Math.abs(left - right) < 1e-5);
    assert.ok(liftCoefficient(critical + 0.3, flaps).cl < left);
  }
});

test('calm assisted departure holds runway heading without left drift', () => {
  const engine = new FlightPhysicsEngine();
  engine.reset('runway');
  engine.throttle = 1;
  simulate(engine, 14);
  assert.equal(engine.telemetry.crashed, false, engine.telemetry.crashReason);
  const headingError = Math.min(engine.telemetry.headingDeg, 360 - engine.telemetry.headingDeg);
  assert.ok(headingError < 2, `heading ${engine.telemetry.headingDeg}`);
  assert.ok(Math.abs(engine.position.x - RUNWAY_CONFIG.centerX) < 2);
  assert.ok(engine.telemetry.iasKnots > 35);
});

test('fixed physics is consistent at 30, 60, 144 FPS and 10 FPS', () => {
  const engines = [10, 30, 60, 144].map(fps => {
    const engine = new FlightPhysicsEngine();
    simulate(engine, 5, fps);
    assert.equal(engine.telemetry.crashed, false);
    return engine;
  });
  for (const engine of engines.slice(1)) {
    assert.ok(engine.position.clone().sub(engines[0].position).length() < 1e-5);
    assert.ok(Math.abs(engine.simTime - engines[0].simTime) < 1e-8);
  }
});

test('airborne assisted flight stays finite and does not turn left in calm weather', () => {
  const engine = new FlightPhysicsEngine();
  simulate(engine, 15);
  assert.equal(engine.telemetry.crashed, false, engine.telemetry.crashReason);
  assert.ok(engine.position.y > 80);
  assert.ok(engine.angularVel.length() < 1);
  assert.ok(Math.abs(engine.position.x + 180) < 1);
});

test('idle brakes settle the aircraft and approach spawn clears terrain', () => {
  const ground = new FlightPhysicsEngine();
  ground.reset('runway');
  simulate(ground, 8, 60, { ...idle, brakes: true });
  assert.equal(ground.telemetry.crashed, false, ground.telemetry.crashReason);
  assert.ok(ground.velocity.length() < 0.1, `speed ${ground.velocity.length()}`);
  const approach = new FlightPhysicsEngine();
  approach.reset('approach');
  assert.ok(approach.position.y > getTerrainHeight(approach.position.x, approach.position.z) + 50);
  simulate(approach, 3);
  assert.equal(approach.telemetry.crashed, false, approach.telemetry.crashReason);
});

test('map edge does not inject velocity', () => {
  const a = new FlightPhysicsEngine(), b = new FlightPhysicsEngine();
  a.position.set(0, 3000, 0);
  b.position.set(29000, 3000, 0);
  a.update(1 / 120, idle, settings, 0);
  b.update(1 / 120, idle, settings, 0);
  assert.ok(a.velocity.clone().sub(b.velocity).length() < 1e-8);
});

test('rotate, climb and complete a flared landing using control surfaces', () => {
  const departure = new FlightPhysicsEngine();
  departure.reset('runway');
  departure.throttle = 1;
  simulate(departure, 14);
  simulate(departure, 7, 60, { ...idle, pitchUp: true });
  assert.equal(departure.telemetry.crashed, false);
  assert.equal(departure.telemetry.onGround, false);
  assert.ok(departure.position.y > RUNWAY_CONFIG.elevation + 15);

  const landing = new FlightPhysicsEngine();
  landing.reset('approach');
  for (let i = 0; i < 130 * 120 && !landing.telemetry.crashed; i++) {
    if (landing.position.z < RUNWAY_CONFIG.length / 2 + 200) landing.throttle = 0;
    const flare = landing.position.y < 22 && landing.position.z < RUNWAY_CONFIG.length / 2 + 190;
    landing.update(1 / 120, { ...idle, pitchAxis: flare ? 0.25 : 0, brakes: landing.telemetry.onGround }, settings, 0);
  }
  assert.equal(landing.telemetry.crashed, false, landing.telemetry.crashReason);
  assert.equal(landing.telemetry.onGround, true);
  assert.ok(landing.velocity.length() < 0.1);
  assert.ok(Math.abs(landing.position.x - RUNWAY_CONFIG.centerX) < 2);
  assert.ok(Math.abs(landing.position.z) < RUNWAY_CONFIG.length / 2);
});

test('visible terrain and contacts agree at Low and Ultra detail', () => {
  for (const quality of [QUALITY_PRESETS.low, QUALITY_PRESETS.ultra]) {
    const environment = new WildernessEnvironment(new Scene(), { ...quality, treeCount: 0, rockCount: 0, cloudClusters: 0 });
    const terrain = environment.root.children.find(child => child.name === 'Mainland') as Mesh;
    const positions = terrain.geometry.positions;
    for (let i = 0; i < positions.length; i += 501) {
      assert.ok(Math.abs(getSurfaceHeight(positions[i], positions[i + 2]) - Math.max(positions[i + 1], getIslandHeight(positions[i], positions[i + 2]))) < 0.001);
    }
    const landing = new FlightPhysicsEngine();
    landing.reset('approach');
    for (let i = 0; i < 130 * 120 && !landing.telemetry.crashed; i++) {
      if (landing.position.z < RUNWAY_CONFIG.length / 2 + 200) landing.throttle = 0;
      const flare = landing.position.y < 22 && landing.position.z < RUNWAY_CONFIG.length / 2 + 190;
      landing.update(1 / 120, { ...idle, pitchAxis: flare ? 0.25 : 0, brakes: landing.telemetry.onGround }, settings, 0);
    }
    assert.equal(landing.telemetry.crashed, false, landing.telemetry.crashReason);
    assert.ok(landing.telemetry.onGround && landing.velocity.length() < 0.1);
  }
});

test('scenic pilot completes five minutes without terrain impact or stall', () => {
  const engine = new FlightPhysicsEngine();
  engine.position.set(-220, 460, 1200);
  const pilot = new ScenicPilot();
  let minimumClearance = Infinity;
  for (let i = 0; i < 300 * 60 && !engine.telemetry.crashed; i++) {
    engine.update(1 / 60, pilot.controls(engine), settings, 0);
    minimumClearance = Math.min(minimumClearance, engine.position.y - getSurfaceHeight(engine.position.x, engine.position.z));
  }
  assert.equal(engine.telemetry.crashed, false, engine.telemetry.crashReason);
  assert.ok(minimumClearance > 40, `clearance ${minimumClearance}`);
  assert.ok(engine.telemetry.iasKnots > 55 && engine.telemetry.iasKnots < 130);
  assert.ok(engine.angularVel.length() < 1);
});

test('all aircraft sustain an assisted climb with bounded propulsive power', () => {
  const climbRates: number[] = [];
  for (const id of Object.keys(AIRCRAFT_PROFILES) as AircraftId[]) {
    const engine = new FlightPhysicsEngine(id);
    engine.position.set(30000, 650, 10000);
    engine.throttle = 1;
    let peakPowerRatio = 0;
    for (let i = 0; i < 120 * 120; i++) {
      engine.update(1 / 120, { ...idle, pitchUp: true }, settings, 0);
      peakPowerRatio = Math.max(peakPowerRatio, engine.forces.thrustN * engine.velocity.length() / engine.forces.shaftPowerW);
    }
    assert.equal(engine.telemetry.crashed, false);
    assert.equal(engine.telemetry.isStalling, false);
    assert.ok(engine.position.y > 1000);
    assert.ok(engine.telemetry.iasKnots >= engine.profile.bestClimbKnots - 8);
    assert.ok(peakPowerRatio <= 1, `${id}: useful power ${peakPowerRatio}`);
    climbRates.push(engine.telemetry.verticalSpeedFpm);
  }
  assert.ok(climbRates[1] > climbRates[0] && climbRates[2] > climbRates[1]);
});

test('bay spawn clears karst islands and their visible summit vertices match contact heights', () => {
  const engine = new FlightPhysicsEngine();
  engine.reset('archipelago');
  assert.ok(engine.position.y - getSurfaceHeight(engine.position.x, engine.position.z) > 200);
  assert.ok(islands.length > 50);
  for (const island of islands) {
    const terrain = getSurfaceHeight(island.x, island.z);
    assert.ok(terrain > 50 && terrain <= 400);
    assert.ok(Math.abs(terrain - getIslandHeight(island.x, island.z)) < 0.01);
  }
});

test('all aircraft depart the enlarged airport and complete the bay sightseeing route', () => {
  for (const id of Object.keys(AIRCRAFT_PROFILES) as AircraftId[]) {
    const departure = new FlightPhysicsEngine(id);
    departure.reset('runway'); departure.throttle = 1;
    simulate(departure, 18);
    simulate(departure, 10, 60, { ...idle, pitchUp: true });
    assert.equal(departure.telemetry.crashed, false, `${id}: ${departure.telemetry.crashReason}`);
    assert.equal(departure.telemetry.onGround, false);
    assert.ok(departure.position.y > RUNWAY_CONFIG.elevation + 20);

    const engine = new FlightPhysicsEngine(id);
    engine.reset('archipelago');
    const pilot = new ScenicPilot(); pilot.reset(true);
    let minimumClearance = Infinity;
    for (let i = 0; i < 300 * 60 && !engine.telemetry.crashed; i++) {
      engine.update(1 / 60, pilot.controls(engine), settings, 0);
      minimumClearance = Math.min(minimumClearance, engine.position.y - getSurfaceHeight(engine.position.x, engine.position.z));
    }
    assert.equal(engine.telemetry.crashed, false, `${id}: ${engine.telemetry.crashReason}`);
    assert.equal(engine.telemetry.isStalling, false, id);
    assert.ok(minimumClearance > 80, `${id}: clearance ${minimumClearance}`);
  }
});

test('wide twin wingtip contacts use its actual span while narrow wings remain clear', () => {
  for (const id of ['skyhawk', 'coastal'] as AircraftId[]) {
    const engine = new FlightPhysicsEngine(id);
    engine.position.set(RUNWAY_CONFIG.centerX, RUNWAY_CONFIG.elevation + 2.7, 0);
    engine.quaternion.setFromEuler(new Euler(0, 0, Math.PI / 6));
    engine.velocity.set(0, 0, 0); engine.throttle = 0;
    engine.update(1 / 120, idle, settings, 0);
    assert.equal(engine.telemetry.crashed, id === 'coastal');
    if (id === 'coastal') assert.match(engine.telemetry.crashReason, /mút cánh/);
  }
});
