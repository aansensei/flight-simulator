import { FlightPhysicsEngine } from './physics';
import { getSurfaceHeight } from './terrain';
import { ControlInputs } from './types';
import { MathUtils } from './webgl2-three';

export class ScenicPilot {
  private waypoint = 0;
  private route = [
    { x: -650, z: -1200 }, { x: 350, z: -1200 },
    { x: 500, z: 950 }, { x: -800, z: 1500 }, { x: -1050, z: 0 }
  ];

  private bay = false;
  reset(bay = false): void {
    this.waypoint = 0; this.bay = bay;
    this.route = bay
      ? [{ x: 17200, z: 4500 }, { x: 16000, z: -1000 }, { x: 19200, z: -4500 }, { x: 22000, z: 0 }, { x: 20400, z: 5000 }]
      : [{ x: -650, z: -1200 }, { x: 350, z: -1200 }, { x: 500, z: 950 }, { x: -800, z: 1500 }, { x: -1050, z: 0 }];
  }

  controls(engine: FlightPhysicsEngine): ControlInputs {
    let target = this.route[this.waypoint];
    if (Math.hypot(target.x - engine.position.x, target.z - engine.position.z) < 350) {
      this.waypoint = (this.waypoint + 1) % this.route.length;
      target = this.route[this.waypoint];
    }
    const desiredHeading = Math.atan2(target.x - engine.position.x, engine.position.z - target.z) * 180 / Math.PI;
    const headingError = ((desiredHeading - engine.telemetry.headingDeg + 540) % 360) - 180;
    const targetAltitude = Math.max(this.bay ? 650 : 420, getSurfaceHeight(target.x, target.z) + 260, getSurfaceHeight(engine.position.x, engine.position.z) + 180);
    const pitch = MathUtils.clamp((targetAltitude - engine.position.y) * 0.003 - engine.velocity.y * 0.035, -0.35, 0.65);
    const cruise = Math.max(95, engine.profile.bestClimbKnots + 20);
    return {
      pitchAxis: pitch, rollAxis: MathUtils.clamp(headingError / 38, -0.85, 0.85),
      pitchUp: false, pitchDown: false, rollLeft: false, rollRight: false,
      yawLeft: false, yawRight: false, throttleUp: engine.telemetry.iasKnots < cruise - 5 && engine.throttle < 0.9,
      throttleDown: engine.telemetry.iasKnots > cruise + 5 && engine.throttle > 0.4,
      brakes: false, trimUp: false, trimDown: false
    };
  }
}
