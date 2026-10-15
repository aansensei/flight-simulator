import { AIRCRAFT_PROFILES, AircraftId } from './aircraft-specs';
import { BAY_CENTER } from './archipelago';
/**
 * AERONAUT: Wilderness Flight
 * Module: src/physics.ts
 *
 * Hệ thống Mô phỏng Vật lý Bay 6-DOF (6 Bậc Tự Do) cho Cessna 172 Skyhawk:
 * - Bước thời gian cố định FIXED_DT = 1/120 giây (8.333 ms) kèm bộ tích lũy và nội suy khung hình.
 * - Tuyệt đối không cộng trực tiếp vị trí hay ép góc xoay theo phím bấm.
 * - Tính toán đầy đủ:
 *   1. Trọng lực (Gravity).
 *   2. Động cơ Lycoming IO-360-L2A 180 HP & Lực đẩy cánh quạt (Propeller Thrust giảm theo airspeed).
 *   3. Vận tốc tương đối với không khí (V_air = V_ground - V_wind), phân biệt IAS, TAS và Groundspeed.
 *   4. Góc tấn (Angle of Attack α) và Góc trượt ngang (Sideslip β).
 *   5. Lực nâng L = 0.5 * ρ * V_air² * S * CL(α, flaps) nghiêng theo mặt phẳng đối xứng của máy bay.
 *   6. Lực cản D = 0.5 * ρ * V_air² * S * CD(α, flaps) gồm cản ký sinh, cản cảm ứng và cản sau thất tốc.
 *   7. Hiện tượng thất tốc (Stall) tự nhiên khi α vượt quá α_crit, có mô men chúi mũi phục hồi tự nhiên.
 *   8. Mô men Pitch, Roll, Yaw, độ ổn định tĩnh và giảm chấn khí động học (Aerodynamic Damping).
 *   9. Hai chế độ điều khiển: Assisted (hỗ trợ ổn định vừa phải) và Simulation (quán tính & phản hồi nguyên bản).
 *  10. Hệ thống 3 bánh tiếp đất (Tricycle Gear), giảm xóc, ma sát lăn, phanh bánh, điều hướng taxi và phát hiện va chạm.
 */

import { airDensity, angularAcceleration, liftCoefficient, propellerThrust } from './flight-math';
import { Euler, MathUtils, Quaternion, Vector3 } from './webgl2-three';
import {
  ControlInputs, FlightMode, SpawnLocation, TelemetryData, UserSettings
} from './types';
import {
  getSurfaceHeight, getTerrainNormal, isPointOnRunway, LAKE_LEVEL, RUNWAY_CONFIG, VALLEY_DATUM_FEET, WORLD_SIZE
} from './terrain';

export const FIXED_DT = 1 / 120; // 120 Hz fixed physics step
const MAX_SUBSTEPS = 24;
const GRAVITY = 9.80665; // m/s²
const RHO_SEA_LEVEL = 1.225; // kg/m³

export class FlightPhysicsEngine {
  // Trạng thái bước hiện tại & bước trước (phục vụ nội suy hiển thị mượt ở mọi FPS)
  position = new Vector3();
  prevPosition = new Vector3();
  renderPosition = new Vector3();

  quaternion = new Quaternion();
  prevQuaternion = new Quaternion();
  renderQuaternion = new Quaternion();

  velocity = new Vector3();     // Vận tốc trong hệ tọa độ thế giới (m/s)
  angularVel = new Vector3();   // Vận tốc góc trong hệ tọa độ thân máy bay: x = pitch rate (q), y = yaw rate (r), z = roll rate (p)

  // Trạng thái điều khiển & động cơ
  throttle = 0.68;
  rpm = 2150;
  flapIndex = 0;
  flapDeg = 0;
  elevatorTrim = 0.04;
  aileronDeflection = 0;  // [-1, 1]
  elevatorDeflection = 0; // [-1, 1]
  rudderDeflection = 0;   // [-1, 1]

  // Trạng thái gió & nhiễu động khí quyển
  baseWindVel = new Vector3(0, 0, 0); // Gió nhẹ vùng thung lũng (~4.2 knots)
  currentWindVel = new Vector3(0, 0, 0);
  simTime = 0;
  private accumulator = 0;

  // Trạng thái tiếp đất & hạ cánh
  wasOnGround = false;
  touchdownChecked = false;
  telemetry: TelemetryData;

  // Scratch vectors (tránh cấp phát bộ nhớ trong vòng lặp 120Hz)
  private tmpForward = new Vector3();
  private tmpUp = new Vector3();
  private tmpRight = new Vector3();
  private tmpAirVelWorld = new Vector3();
  private tmpAirVelBody = new Vector3();
  private tmpForceWorld = new Vector3();
  private tmpMomentBody = new Vector3();
  private tmpLiftDir = new Vector3();
  private tmpDragDir = new Vector3();
  private tmpSideDir = new Vector3();
  private tmpInvQuat = new Quaternion();
  private tmpDeltaQuat = new Quaternion();
  private tmpEuler = new Euler();
  private tmpWheelWorld = new Vector3();
  private tmpWheelVel = new Vector3();
  private tmpGroundNormal = new Vector3();
  private tmpContactForce = new Vector3();
  private tmpContactMoment = new Vector3();
  private tmpAngularAccel = new Vector3();
  aircraftId: AircraftId = 'skyhawk';
  get profile() { return AIRCRAFT_PROFILES[this.aircraftId]; }
  get specs() { return this.profile.specs; }
  private readonly bodyInertia = new Vector3(this.specs.inertia.iyy, this.specs.inertia.izz, this.specs.inertia.ixx);
  gustStrength = 0;
  forces = { liftN: 0, dragN: 0, thrustN: 0, shaftPowerW: 0, mechanicalEnergyJ: 0 };
  private readonly wheelOffsets = [new Vector3(0, -1.32, -1.95), new Vector3(-1.35, -1.32, 0.24), new Vector3(1.35, -1.32, 0.24)];

  constructor(aircraftId: AircraftId = 'skyhawk') {
    this.aircraftId = aircraftId;
    this.bodyInertia.set(this.specs.inertia.iyy, this.specs.inertia.izz, this.specs.inertia.ixx);
    this.telemetry = this.createEmptyTelemetry();
    this.reset('airborne');
  }

  private createEmptyTelemetry(): TelemetryData {
    return {
      iasKnots: 95,
      tasKnots: 96,
      groundSpeedKnots: 95,
      verticalSpeedFpm: 0,
      altitudeMslFeet: 2500,
      altitudeAglFeet: 700,
      pitchDeg: 2,
      rollDeg: 0,
      headingDeg: 0,
      aoaDeg: 3.2,
      sideslipDeg: 0,
      gForce: 1.0,
      throttle: 0.68,
      rpm: 2150,
      flapIndex: 0,
      flapDeg: 0,
      elevatorTrim: 0.04,
      aileronNorm: 0,
      elevatorNorm: 0,
      rudderNorm: 0,
      isStallWarning: false,
      isStalling: false,
      onGround: false,
      brakesActive: false,
      inCloudDensity: 0,
      crashed: false,
      crashReason: '',
      landingMessage: '',
      landingTimer: 0,
      windSpeedKnots: 4.2,
      windDirDeg: 235
    };
  }

  /**
   * Đặt lại trạng thái máy bay:
   * - 'airborne': Đang bay ổn định trên hồ xanh ở độ cao an toàn (~210m trên mặt hồ = ~2,490 ft MSL), hướng về phía thung lũng & núi thông phía Bắc.
   * - 'runway': Đứng ở đầu phía Nam đường băng Alpine Airfield, sẵn sàng nhả phanh và tăng ga cất cánh.
   */
  reset(spawn: SpawnLocation): void {
    this.accumulator = 0;
    this.simTime = 0;
    this.telemetry = this.createEmptyTelemetry();
    this.angularVel.set(0, 0, 0);
    this.aileronDeflection = 0;
    this.elevatorDeflection = 0;
    this.rudderDeflection = 0;
    this.telemetry.crashed = false;
    this.telemetry.crashReason = '';
    this.telemetry.landingMessage = '';
    this.telemetry.landingTimer = 0;

    if (spawn === 'airborne' || spawn === 'approach' || spawn === 'archipelago') {
      // Khoảnh khắc mở đầu: bay ổn định trên mặt hồ xanh trong thung lũng rộng, hướng Bắc (-Z)
      this.position.set(-180, 460, 760);
      this.tmpEuler.set(MathUtils.degToRad(2.2), 0.0, 0.0, 'YXZ');
      this.quaternion.setFromEuler(this.tmpEuler);
      // Vận tốc ban đầu ~50 m/s (~97 knots), cân bằng lực nâng
      this.velocity.set(0, 0, -50.0);
      this.throttle = 0.72;
      this.rpm = 2240;
      this.flapIndex = 0;
      this.flapDeg = 0;
      this.elevatorTrim = 0.004;
      this.wasOnGround = false;
      this.touchdownChecked = true;
      if (spawn === 'archipelago') {
        this.position.set(BAY_CENTER.x, 650, 9600);
        this.velocity.set(0, 0, -55);
        this.throttle = 0.85;
      }
      if (spawn === 'approach') {
        this.position.set(RUNWAY_CONFIG.centerX, RUNWAY_CONFIG.elevation + 142, RUNWAY_CONFIG.length / 2 + 2640);
        const approachScale = Math.sqrt((this.specs.mass / this.specs.wingArea) / (1040 / 16.17));
        this.velocity.set(0, -2 * approachScale, -34 * approachScale);
        this.tmpEuler.set(MathUtils.degToRad(2.5), 0, 0, 'YXZ');
        this.quaternion.setFromEuler(this.tmpEuler);
        this.throttle = 0.32;
        this.rpm = 1700;
        this.flapIndex = 2;
        this.flapDeg = 20;
      }
    } else {
      // Đứng ở ngưỡng đường băng phía Nam (Runway 36, hướng Bắc -Z)
      const rwyY = getSurfaceHeight(RUNWAY_CONFIG.centerX, RUNWAY_CONFIG.centerZ + RUNWAY_CONFIG.length / 2 - 120);
      this.position.set(RUNWAY_CONFIG.centerX, rwyY + 1.32, RUNWAY_CONFIG.centerZ + RUNWAY_CONFIG.length / 2 - 120);
      this.tmpEuler.set(MathUtils.degToRad(1.2), 0.0, 0.0, 'YXZ');
      this.quaternion.setFromEuler(this.tmpEuler);
      this.velocity.set(0, 0, 0);
      this.throttle = 0.0;
      this.rpm = this.specs.idleRpm;
      this.flapIndex = 1; // Hạ sẵn Flap 10° hỗ trợ cất cánh đường băng ngắn/tiêu chuẩn
      this.flapDeg = 10;
      this.elevatorTrim = 0.004;
      this.wasOnGround = true;
      this.touchdownChecked = true;
    }

    this.prevPosition.copy(this.position);
    this.renderPosition.copy(this.position);
    this.prevQuaternion.copy(this.quaternion);
    this.renderQuaternion.copy(this.quaternion);
    this.stepSubframe(FIXED_DT, {
      pitchUp: false, pitchDown: false, rollLeft: false, rollRight: false,
      yawLeft: false, yawRight: false, throttleUp: false, throttleDown: false,
      brakes: false, trimUp: false, trimDown: false
    }, 'assisted', 1.0, false);
  }

  cycleFlaps(): number {
    this.flapIndex = (this.flapIndex + 1) % this.specs.flapAnglesDeg.length;
    return this.specs.flapAnglesDeg[this.flapIndex];
  }

  /**
   * Cập nhật vật lý với bước cố định 1/120s và nội suy trạng thái hiển thị
   */
  update(
    frameDt: number,
    inputs: ControlInputs,
    settings: UserSettings,
    cloudDensity: number
  ): void {
    this.telemetry.inCloudDensity = cloudDensity;
    if (this.telemetry.crashed) return;

    // Kẹp khoảng thời gian quá lớn (ví dụ sau khi chuyển tab) để tránh mất ổn định
    const safeDt = MathUtils.clamp(frameDt, 0, 0.2);
    this.accumulator += safeDt;

    let steps = 0;
    while (this.accumulator + 1e-9 >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.prevPosition.copy(this.position);
      this.prevQuaternion.copy(this.quaternion);
      this.stepSubframe(
        FIXED_DT,
        inputs,
        settings.flightMode,
        settings.controlSensitivity,
        settings.invertPitch
      );
      this.accumulator -= FIXED_DT;
      steps++;
      if (this.telemetry.crashed) {
        this.prevPosition.copy(this.position);
        this.prevQuaternion.copy(this.quaternion);
        break;
      }
    }

    if (steps === MAX_SUBSTEPS) {
      this.accumulator %= FIXED_DT;
    }

    // Nội suy mượt giữa bước trước và bước hiện tại
    const alpha = MathUtils.clamp(this.accumulator / FIXED_DT, 0, 1);
    this.renderPosition.lerpVectors(this.prevPosition, this.position, alpha);
    this.renderQuaternion.slerpQuaternions(this.prevQuaternion, this.quaternion, alpha);

    if (this.telemetry.landingTimer > 0) {
      this.telemetry.landingTimer = Math.max(0, this.telemetry.landingTimer - safeDt);
      if (this.telemetry.landingTimer === 0) {
        this.telemetry.landingMessage = '';
      }
    }
  }

  /**
   * Một bước tích phân vật lý 6-DOF cố định (dt = 1/120s)
   */
  private stepSubframe(
    dt: number,
    inputs: ControlInputs,
    mode: FlightMode,
    sensitivity: number,
    invertPitch: boolean
  ): void {
    this.simTime += dt;

    // 1. Đọc và làm mượt các bề mặt điều khiển (Control Surface Actuators)
    if (inputs.throttleUp) this.throttle = MathUtils.clamp(this.throttle + 0.42 * dt, 0, 1);
    if (inputs.throttleDown) this.throttle = MathUtils.clamp(this.throttle - 0.42 * dt, 0, 1);
    if (inputs.trimUp) this.elevatorTrim = MathUtils.clamp(this.elevatorTrim + 0.18 * dt, -0.5, 0.5);
    if (inputs.trimDown) this.elevatorTrim = MathUtils.clamp(this.elevatorTrim - 0.18 * dt, -0.5, 0.5);

    const targetFlapDeg = this.specs.flapAnglesDeg[this.flapIndex];
    const flapSpeed = 12.0; // độ/giây (motor điện hạ flap thực tế)
    if (this.flapDeg < targetFlapDeg) this.flapDeg = Math.min(targetFlapDeg, this.flapDeg + flapSpeed * dt);
    if (this.flapDeg > targetFlapDeg) this.flapDeg = Math.max(targetFlapDeg, this.flapDeg - flapSpeed * dt);

    // Xác định mục tiêu độ lệch của Elevator, Aileron, Rudder
    let rawPitchCmd = inputs.pitchAxis ?? ((inputs.pitchUp ? 1 : 0) - (inputs.pitchDown ? 1 : 0));
    if (invertPitch) rawPitchCmd = -rawPitchCmd;
    const rawRollCmd = inputs.rollAxis ?? ((inputs.rollRight ? 1 : 0) - (inputs.rollLeft ? 1 : 0));
    const rawYawCmd = inputs.yawAxis ?? ((inputs.yawLeft ? 1 : 0) - (inputs.yawRight ? 1 : 0));

    this.tmpForward.set(0, 0, -1).applyQuaternion(this.quaternion).normalize();
    this.tmpUp.set(0, 1, 0).applyQuaternion(this.quaternion).normalize();
    this.tmpRight.set(1, 0, 0).applyQuaternion(this.quaternion).normalize();
    this.tmpEuler.setFromQuaternion(this.quaternion, 'YXZ');
    const pitchRad = this.tmpEuler.x;
    const rollRad = this.tmpEuler.z;

    let pitchTarget = rawPitchCmd * sensitivity;
    let rollTarget = rawRollCmd * sensitivity;
    let yawTarget = rawYawCmd * sensitivity;
    if (mode === 'assisted') {
      const ground = this.wasOnGround;
      let desiredPitch = ground ? rawPitchCmd * 0.18 : 0.045 + rawPitchCmd * 0.16 * sensitivity;
      if (!ground && rawPitchCmd > 0.6 && this.flapIndex === 0) {
        // Elevator feedback trades airspeed for height while respecting available engine power.
        const climbPitch = MathUtils.clamp(0.10 + (this.telemetry.iasKnots - this.profile.bestClimbKnots) * 0.018, -0.06, 0.38);
        desiredPitch = MathUtils.lerp(desiredPitch, climbPitch, MathUtils.clamp((rawPitchCmd - 0.6) / 0.4, 0, 1));
      }
      const desiredBank = -rawRollCmd * 0.48 * sensitivity;
      pitchTarget = (desiredPitch - pitchRad) * 2.5 - this.angularVel.x * 0.65;
      rollTarget = -(desiredBank - rollRad) * 1.8 + this.angularVel.z * 0.5;
      const desiredYawRate = Math.sin(rollRad) * GRAVITY / Math.max(20, this.velocity.length());
      yawTarget += (desiredYawRate - this.angularVel.y) * 0.5;
    }
    const response = 1 - Math.exp(-5 * dt);
    this.elevatorDeflection = MathUtils.lerp(this.elevatorDeflection, MathUtils.clamp(pitchTarget, -1, 1), response);
    this.aileronDeflection = MathUtils.lerp(this.aileronDeflection, MathUtils.clamp(rollTarget, -1, 1), response);
    this.rudderDeflection = MathUtils.lerp(this.rudderDeflection, MathUtils.clamp(yawTarget, -1, 1), response);

    // 3. Mô hình Khí quyển ISA & Gió liên tục theo thời gian
    const altMetersMsl = (VALLEY_DATUM_FEET / 3.28084) + this.position.y;
    const rho = airDensity(altMetersMsl);

    // Nhiễu động gió liên tục nhẹ nhàng (Dryden-like continuous wind gust)
    const gustX = Math.sin(this.simTime * 0.43 + this.position.x * 0.001) * 0.85;
    const gustY = Math.sin(this.simTime * 0.91 + this.position.z * 0.0015) * 0.28;
    const gustZ = Math.cos(this.simTime * 0.37 + this.position.z * 0.001) * 0.85;
    this.currentWindVel.set(
      this.baseWindVel.x + gustX * this.gustStrength,
      this.baseWindVel.y + gustY * this.gustStrength,
      this.baseWindVel.z + gustZ * this.gustStrength
    );

    // Vận tốc tương đối với không khí: V_air = V_ground - V_wind
    this.tmpAirVelWorld.subVectors(this.velocity, this.currentWindVel);
    const tasMs = this.tmpAirVelWorld.length();
    const iasMs = tasMs * Math.sqrt(rho / RHO_SEA_LEVEL);

    // Chuyển V_air sang hệ tọa độ thân máy bay (Body Frame: x = sang phải, y = lên trên, z = ra phía đuôi)
    this.tmpInvQuat.copy(this.quaternion).invert();
    this.tmpAirVelBody.copy(this.tmpAirVelWorld).applyQuaternion(this.tmpInvQuat);

    const uRight = this.tmpAirVelBody.x;
    const vUp = this.tmpAirVelBody.y;
    const uFwd = -this.tmpAirVelBody.z; // Vận tốc tiến về phía mũi (+ khi bay tới)

    // 4. Góc tấn (Angle of Attack α) và Góc trượt ngang (Sideslip β)
    const forwardSpeed = Math.max(0.5, Math.sqrt(uFwd * uFwd + vUp * vUp));
    const alpha = tasMs > 1.2 ? Math.atan2(-vUp, uFwd) : 0.0;
    const beta = tasMs > 1.2 ? Math.atan2(uRight, forwardSpeed) : 0.0;

    // 5. Hệ số Lực nâng CL(α, flaps) & Mô phỏng Thất tốc (Stall) tự nhiên
    const flapRatio = this.flapDeg / 30;
    const aero = liftCoefficient(alpha, this.flapDeg);
    const cl = aero.cl;
    const alphaCrit = aero.critical;
    const stallSeverity = aero.severity;
    const isStalling = stallSeverity > 0 && tasMs > 8;

    // Cảnh báo Stall phản ánh đúng trạng thái khí động học (khi α tiến sát hoặc vượt ngưỡng tới hạn khi đang bay)
    const terrainY = getSurfaceHeight(this.position.x, this.position.z);
    const groundSurfaceY = Math.max(terrainY, LAKE_LEVEL);
    const aglMeters = this.position.y - groundSurfaceY;
    const isAirborne = aglMeters > 1.65;
    const isStallWarning = isAirborne && iasMs > 9.0 && alpha > alphaCrit * this.specs.alphaWarnRatio;

    // 6. Hệ số Lực cản CD(α, flaps) và Lực ngang CY(β)
    const cdInduced = (cl * cl) / (Math.PI * this.specs.aspectRatio * this.specs.oswaldEfficiency);
    const cdFlaps = flapRatio * flapRatio * 0.042;
    const cdStall = stallSeverity * stallSeverity * 0.38 + (Math.abs(alpha) > alphaCrit ? Math.pow(Math.sin(alpha), 2) * 0.65 : 0);
    const cdSideslip = 0.24 * beta * beta;
    const cd = this.specs.cd0 + cdFlaps + cdInduced + cdStall + cdSideslip;

    const cy = -0.58 * beta + 0.14 * this.rudderDeflection;

    // 7. Tính Độ lớn Lực Khí động học: Áp suất động q = 0.5 * ρ * V_air²
    const qDyn = 0.5 * rho * tasMs * tasMs;
    const liftMag = qDyn * this.specs.wingArea * cl;
    const dragMag = qDyn * this.specs.wingArea * cd;
    const sideMag = qDyn * this.specs.wingArea * cy;

    // Hướng của Lực cản (ngược chiều dòng khí tương đối) và Lực nâng (vuông góc dòng khí và nằm trong mặt phẳng đối xứng máy bay)
    if (tasMs > 0.5) {
      this.tmpDragDir.copy(this.tmpAirVelWorld).multiplyScalar(-1 / tasMs);
      this.tmpLiftDir.crossVectors(this.tmpRight, this.tmpAirVelWorld);
      if (this.tmpLiftDir.lengthSq() > 1e-6) {
        this.tmpLiftDir.normalize();
      } else {
        this.tmpLiftDir.copy(this.tmpUp);
      }
    } else {
      this.tmpDragDir.copy(this.tmpForward).multiplyScalar(-1);
      this.tmpLiftDir.copy(this.tmpUp);
    }
    this.tmpSideDir.copy(this.tmpRight);

    // 8. Động cơ Lycoming 180 HP & Lực đẩy cánh quạt McCauley
    const airflowRpmBonus = MathUtils.clamp(tasMs / 65.0, 0, 1) * 180 * this.throttle;
    const targetRpm = this.specs.idleRpm +
      Math.pow(this.throttle, 0.88) * (this.specs.maxRpm - this.specs.idleRpm - 180) +
      airflowRpmBonus;
    this.rpm = MathUtils.lerp(this.rpm, targetRpm, Math.min(1, 6.5 * dt));

    const rpmNorm = Math.max(0, (this.rpm - this.specs.idleRpm * 0.85) / (this.specs.maxRpm - this.specs.idleRpm * 0.85));
    const densityFactor = rho / RHO_SEA_LEVEL;
    const shaftPower = this.specs.maxPowerWatts * this.throttle * densityFactor * MathUtils.clamp(this.rpm / this.specs.maxRpm, 0, 1);
    const thrustMag = this.profile.engines * propellerThrust(shaftPower * 0.82 / this.profile.engines, uFwd, rho, this.specs.propDiameter);
    this.forces.liftN = liftMag;
    this.forces.dragN = dragMag;
    this.forces.thrustN = thrustMag;
    this.forces.shaftPowerW = shaftPower;

    // Tổng hợp Lực trong hệ tọa độ thế giới
    this.tmpForceWorld.set(0, -this.specs.mass * GRAVITY, 0);
    this.tmpForceWorld.addScaledVector(this.tmpForward, thrustMag);
    this.tmpForceWorld.addScaledVector(this.tmpLiftDir, liftMag);
    this.tmpForceWorld.addScaledVector(this.tmpDragDir, dragMag);
    this.tmpForceWorld.addScaledVector(this.tmpSideDir, sideMag);

    // 9. Mô men Khí động học (Pitch, Roll, Yaw) trong hệ tọa độ thân máy bay
    // Hiệu lực của mặt điều khiển tỷ lệ với áp suất động + dòng khí thổi từ cánh quạt qua đuôi (propwash)
    const propwashDyn = 0.5 * rho * Math.pow(rpmNorm * 22.0, 2);
    const controlQ = qDyn + propwashDyn * 0.45;
    const speed = Math.max(1, tasMs);
    const span = this.specs.wingspan;
    const chord = this.specs.meanChord;
    const area = this.specs.wingArea;
    const pitchCoefficient = -0.8 * (alpha - 0.042) + 1.1 * (1 - 0.52 * stallSeverity) * (this.elevatorDeflection + this.elevatorTrim) - 0.3 * stallSeverity;
    const rollCoefficient = -0.08 * this.aileronDeflection + 0.08 * beta;
    const yawCoefficient = -0.12 * beta + 0.1 * this.rudderDeflection - 0.008 * this.aileronDeflection;
    const pitchMoment = controlQ * area * chord * pitchCoefficient - qDyn * area * chord * 12 * this.angularVel.x * chord / (2 * speed);
    const rollMoment = qDyn * area * span * (rollCoefficient - 0.5 * this.angularVel.z * span / (2 * speed));
    const yawMoment = controlQ * area * span * yawCoefficient - qDyn * area * span * 0.22 * this.angularVel.y * span / (2 * speed);
    this.tmpMomentBody.set(pitchMoment, yawMoment, rollMoment);

    // 10. Tương tác Mặt đất (3 bánh xe càng cố định: Nose Wheel + Left/Right Main Wheels)
    let wheelsOnGround = 0;
    const wheelOffsets = this.wheelOffsets;

    for (let i = 0; i < wheelOffsets.length; i++) {
      const wLocal = wheelOffsets[i];
      this.tmpWheelWorld.copy(wLocal).applyQuaternion(this.quaternion).add(this.position);
      const groundH = getSurfaceHeight(this.tmpWheelWorld.x, this.tmpWheelWorld.z);

      // Kiểm tra nếu bánh xe chạm mặt nước hồ
      if (groundH < LAKE_LEVEL - 0.5 && this.tmpWheelWorld.y <= LAKE_LEVEL + 0.08) {
        this.triggerCrash('Máy bay đã chạm mặt nước hồ (Cessna 172 sử dụng bộ càng bánh cố định trên bộ).');
        return;
      }

      const penetration = groundH - this.tmpWheelWorld.y;
      if (penetration > 0) {
        wheelsOnGround++;
        // Kiểm tra tiếp đất quá mạnh (Hard landing)
        if (penetration > 1.15 || this.velocity.y < -6.8) {
          this.triggerCrash('Tiếp đất với tốc độ hạ quá lớn vượt giới hạn chịu lực của càng đáp.');
          return;
        }

        // Vận tốc tại điểm bánh xe
        this.tmpWheelVel.crossVectors(this.angularVel, wLocal).applyQuaternion(this.quaternion).add(this.velocity);
        getTerrainNormal(this.tmpWheelWorld.x, this.tmpWheelWorld.z, this.tmpGroundNormal);
        const normalSpeed = this.tmpWheelVel.dot(this.tmpGroundNormal);
        const normalForce = Math.max(0, (penetration * 65000 - normalSpeed * 5000) * this.specs.mass / 1040);
        const onRunway = isPointOnRunway(this.tmpWheelWorld.x, this.tmpWheelWorld.z);
        const muRoll = (onRunway ? 0.022 : 0.075) + (inputs.brakes && i > 0 ? 0.55 : 0);
        const wheelForward = this.tmpForward.clone();
        if (i === 0) {
          const steering = this.rudderDeflection * 0.35;
          wheelForward.multiplyScalar(Math.cos(steering)).addScaledVector(this.tmpRight, -Math.sin(steering));
        }
        wheelForward.addScaledVector(this.tmpGroundNormal, -wheelForward.dot(this.tmpGroundNormal)).normalize();
        const wheelRight = new Vector3().crossVectors(wheelForward, this.tmpGroundNormal).normalize();
        const forwardSpeed = this.tmpWheelVel.dot(wheelForward);
        const lateralSpeed = this.tmpWheelVel.dot(wheelRight);
        let rollingForce = -MathUtils.clamp(forwardSpeed * 1600, -normalForce * muRoll, normalForce * muRoll);
        let lateralForce = -lateralSpeed * 2600;
        const frictionMagnitude = Math.hypot(rollingForce, lateralForce);
        const frictionLimit = normalForce * (onRunway ? 0.75 : 0.5);
        if (frictionMagnitude > frictionLimit && frictionMagnitude > 0) {
          rollingForce *= frictionLimit / frictionMagnitude;
          lateralForce *= frictionLimit / frictionMagnitude;
        }
        this.tmpContactForce.copy(this.tmpGroundNormal).multiplyScalar(normalForce)
          .addScaledVector(wheelForward, rollingForce).addScaledVector(wheelRight, lateralForce);
        this.tmpForceWorld.add(this.tmpContactForce);
        this.tmpContactForce.applyQuaternion(this.tmpInvQuat);
        this.tmpContactMoment.crossVectors(wLocal, this.tmpContactForce);
        this.tmpMomentBody.add(this.tmpContactMoment);
      }
    }

    const onGroundNow = wheelsOnGround > 0;
    if (onGroundNow) {
      // Kiểm tra sự kiện chạm đất (Touchdown) & Hạ cánh thành công
      if (!this.wasOnGround && !this.touchdownChecked && this.simTime > 2.0) {
        const vsiFpm = Math.abs(this.velocity.y * 196.85);
        if (Math.abs(rollRad) > MathUtils.degToRad(24) || pitchRad < MathUtils.degToRad(-14)) {
          this.triggerCrash('Tư thế máy bay khi chạm đất bị nghiêng hoặc chúi mũi quá giới hạn an toàn.');
          return;
        }
        const onRwy = isPointOnRunway(this.position.x, this.position.z);
        this.telemetry.landingMessage = onRwy
          ? `Chạm đường băng êm ái! (${Math.round(iasMs * 1.9438)} kt, -${Math.round(vsiFpm)} fpm)`
          : `Hạ cánh dã chiến thành công! (${Math.round(iasMs * 1.9438)} kt, -${Math.round(vsiFpm)} fpm)`;
        this.telemetry.landingTimer = 6.0;
        this.touchdownChecked = true;
      }
    } else if (aglMeters > 6.0) {
      this.touchdownChecked = false;
    }
    this.wasOnGround = onGroundNow;

    // 11. Kiểm tra va chạm của Khung thân / Mút cánh / Mũi / Đuôi với địa hình và mặt nước
    const bodyCheckPoints = [
      { pt: new Vector3(0, 0.1, -3.35), label: 'Mũi máy bay và cánh quạt đã va chạm địa hình.' },
      { pt: new Vector3(-this.specs.wingspan / 2 + 0.05, 0.85, -0.15), label: 'Đầu mút cánh trái đã va chạm địa hình.' },
      { pt: new Vector3(this.specs.wingspan / 2 - 0.05, 0.85, -0.15), label: 'Đầu mút cánh phải đã va chạm địa hình.' },
      { pt: new Vector3(0, 0.65, 0.0), label: 'Khung cabin đã va chạm địa hình.' },
      { pt: new Vector3(0, 0.42, 4.45), label: 'Đuôi máy bay đã đập mạnh xuống mặt đất.' }
    ];
    for (let i = 0; i < bodyCheckPoints.length; i++) {
      const cp = bodyCheckPoints[i];
      this.tmpWheelWorld.copy(cp.pt).applyQuaternion(this.quaternion).add(this.position);
      const hGround = getSurfaceHeight(this.tmpWheelWorld.x, this.tmpWheelWorld.z);
      const hSurf = Math.max(hGround, LAKE_LEVEL);
      if (this.tmpWheelWorld.y <= hSurf + 0.05) {
        if (hGround < LAKE_LEVEL && this.tmpWheelWorld.y <= LAKE_LEVEL + 0.05) {
          this.triggerCrash('Máy bay đã lao xuống mặt nước hồ.');
        } else {
          this.triggerCrash(cp.label);
        }
        return;
      }
    }

    // 12. Tích phân Vận tốc Dọc & Vị trí (Semi-Implicit Euler)
    const accelX = this.tmpForceWorld.x / this.specs.mass;
    const accelY = this.tmpForceWorld.y / this.specs.mass;
    const accelZ = this.tmpForceWorld.z / this.specs.mass;

    this.velocity.x += accelX * dt;
    this.velocity.y += accelY * dt;
    this.velocity.z += accelZ * dt;

    this.position.addScaledVector(this.velocity, dt);
    angularAcceleration(this.angularVel, this.tmpMomentBody, this.bodyInertia, this.tmpAngularAccel);
    this.angularVel.addScaledVector(this.tmpAngularAccel, dt);
    this.forces.mechanicalEnergyJ = 0.5 * this.specs.mass * this.velocity.lengthSq() + this.specs.mass * GRAVITY * this.position.y;

    const omegaLen = this.angularVel.length();
    if (omegaLen > 1e-6) {
      const halfAngle = 0.5 * omegaLen * dt;
      const sinHalf = Math.sin(halfAngle) / omegaLen;
      this.tmpDeltaQuat.set(
        this.angularVel.x * sinHalf,
        this.angularVel.y * sinHalf,
        this.angularVel.z * sinHalf,
        Math.cos(halfAngle)
      );
      this.quaternion.multiply(this.tmpDeltaQuat).normalize();
    }

    // 14. Cập nhật Telemetry phục vụ HUD, Buồng lái và Âm thanh
    this.tmpEuler.setFromQuaternion(this.quaternion, 'YXZ');
    const headingRaw = (-MathUtils.radToDeg(this.tmpEuler.y) % 360 + 360) % 360;
    const gsMs = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    const gLoad = (this.tmpForceWorld.dot(this.tmpUp) + this.specs.mass * GRAVITY * this.tmpUp.y) / (this.specs.mass * GRAVITY);

    const t = this.telemetry;
    t.iasKnots = iasMs * 1.943844;
    t.tasKnots = tasMs * 1.943844;
    t.groundSpeedKnots = gsMs * 1.943844;
    t.verticalSpeedFpm = this.velocity.y * 196.8504;
    t.altitudeMslFeet = VALLEY_DATUM_FEET + this.position.y * 3.28084;
    t.altitudeAglFeet = Math.max(0, aglMeters * 3.28084);
    t.pitchDeg = MathUtils.radToDeg(this.tmpEuler.x);
    t.rollDeg = -MathUtils.radToDeg(this.tmpEuler.z);
    t.headingDeg = headingRaw;
    t.aoaDeg = MathUtils.radToDeg(alpha);
    t.sideslipDeg = MathUtils.radToDeg(beta);
    t.gForce = gLoad;
    t.throttle = this.throttle;
    t.rpm = this.rpm;
    t.flapIndex = this.flapIndex;
    t.flapDeg = this.flapDeg;
    t.elevatorTrim = this.elevatorTrim;
    t.aileronNorm = this.aileronDeflection;
    t.elevatorNorm = this.elevatorDeflection;
    t.rudderNorm = this.rudderDeflection;
    t.isStallWarning = isStallWarning;
    t.isStalling = isStalling;
    t.onGround = onGroundNow;
    t.brakesActive = inputs.brakes;
    t.windSpeedKnots = this.currentWindVel.length() * 1.943844;
    t.windDirDeg = (MathUtils.radToDeg(Math.atan2(-this.currentWindVel.x, -this.currentWindVel.z)) + 360) % 360;
  }

  private triggerCrash(reason: string): void {
    this.telemetry.crashed = true;
    this.telemetry.crashReason = reason;
    this.velocity.set(0, 0, 0);
    this.angularVel.set(0, 0, 0);
  }
}
