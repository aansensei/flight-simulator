/**
 * AERONAUT: Wilderness Flight
 * Module: src/camera.ts
 *
 * Hệ thống Camera kép:
 * 1. Camera đuổi (Chase Camera):
 *    - Mặc định nằm sau và hơi cao hơn máy bay, nhìn thấy máy bay cùng phần lớn cảnh quan phía trước.
 *    - Bám theo bằng spring damping có độ trễ quán tính nhẹ.
 *    - Ổn định trục Up theo chân trời để không bị lật mất kiểm soát khi máy bay nghiêng mạnh.
 *    - Có xử lý chống xuyên địa hình/mặt nước và cho phép chỉnh khoảng cách bằng bánh xe chuột.
 * 2. Camera buồng lái (Cockpit Camera):
 *    - Đặt tại vị trí mắt phi công ghế trái hợp lý, nhìn rõ qua kính chắn gió và thấy rõ bảng đồng hồ 3D.
 *    - Có rung động cơ và turbulence nhẹ (tùy chọn bật/tắt trong menu).
 *    - Cho phép nhìn quanh bằng chuột và quay về hướng chuẩn phía trước bằng một thao tác rõ ràng.
 */

import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from './webgl2-three';
import { CameraMode, TelemetryData, UserSettings } from './types';
import { getSurfaceHeight, LAKE_LEVEL } from './terrain';

export class FlightCameraController {
  camera: PerspectiveCamera;
  mode: CameraMode = 'chase';

  private smoothedEye = new Vector3();
  private smoothedTarget = new Vector3();
  private smoothedUp = new Vector3(0, 1, 0);
  private initialized = false;
  private simTime = 0;

  // Scratch vectors
  private tmpForward = new Vector3();
  private tmpUp = new Vector3();
  private tmpRight = new Vector3();
  private tmpDesiredEye = new Vector3();
  private tmpDesiredTarget = new Vector3();
  private tmpLookOffsetQuat = new Quaternion();
  private tmpLookEuler = new Euler();

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(60, aspect, 0.18, 180000);
  }

  toggleMode(): CameraMode {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    this.initialized = false;
    return this.mode;
  }

  resetSnap(aircraftPos: Vector3, aircraftQuat: Quaternion): void {
    this.initialized = false;
    this.update(
      1 / 60,
      aircraftPos,
      aircraftQuat,
      new Vector3(0, 0, -50),
      0,
      0,
      14.5,
      {
        flightMode: 'assisted',
        quality: 'high',
        timeOfDay: 'morning',
        invertPitch: false,
        controlSensitivity: 1.0,
        fov: 60,
        cockpitVibration: true,
        soundEnabled: true,
        showHud: true,
        showHelp: true,
        showPerf: true
      },
      {
        rpm: 2150,
        iasKnots: 95,
        isStalling: false
      } as TelemetryData
    );
  }

  update(
    dt: number,
    aircraftPos: Vector3,
    aircraftQuat: Quaternion,
    aircraftVel: Vector3,
    mouseYaw: number,
    mousePitch: number,
    chaseDist: number,
    settings: UserSettings,
    telemetry: TelemetryData
  ): void {
    this.simTime += dt;
    if (Math.abs(this.camera.fov - settings.fov) > 0.1) {
      this.camera.fov = settings.fov;
      this.camera.updateProjectionMatrix();
    }

    this.tmpForward.set(0, 0, -1).applyQuaternion(aircraftQuat).normalize();
    this.tmpUp.set(0, 1, 0).applyQuaternion(aircraftQuat).normalize();
    this.tmpRight.set(1, 0, 0).applyQuaternion(aircraftQuat).normalize();

    if (this.mode === 'chase') {
      // Camera đuổi: vị trí mong muốn ở phía sau và cao hơn máy bay, xoay theo góc nhìn chuột nếu người chơi kéo chuột
      const orbitYaw = mouseYaw;
      const orbitPitch = mousePitch + 0.16; // Mặc định nhìn từ góc cao ~9.2 độ xuống

      // Tính hướng ngang ổn định của máy bay để camera không bị lật ngược khi máy bay nghiêng cánh gắt
      const flatForward = new Vector3(this.tmpForward.x, this.tmpForward.y * 0.42, this.tmpForward.z).normalize();
      const horizRight = new Vector3().crossVectors(flatForward, new Vector3(0, 1, 0)).normalize();
      if (horizRight.lengthSq() < 0.01) horizRight.set(1, 0, 0);
      const stabilizedUp = new Vector3().crossVectors(horizRight, flatForward).normalize();

      const cosP = Math.cos(orbitPitch);
      const sinP = Math.sin(orbitPitch);
      const cosY = Math.cos(orbitYaw);
      const sinY = Math.sin(orbitYaw);

      // Vector từ máy bay tới camera
      const backDir = new Vector3()
        .addScaledVector(flatForward, -cosP * cosY)
        .addScaledVector(horizRight, -cosP * sinY)
        .addScaledVector(stabilizedUp, sinP)
        .normalize();

      this.tmpDesiredEye.copy(aircraftPos)
        .addScaledVector(backDir, chaseDist)
        .addScaledVector(new Vector3(0, 1, 0), 1.05);

      // Xử lý va chạm của camera với địa hình và mặt nước (giữ tối thiểu 1.8m trên bề mặt)
      const groundH = Math.max(getSurfaceHeight(this.tmpDesiredEye.x, this.tmpDesiredEye.z), LAKE_LEVEL);
      if (this.tmpDesiredEye.y < groundH + 1.8) {
        this.tmpDesiredEye.y = groundH + 1.8;
      }

      // Điểm nhìn của camera nằm hơi cao và phía trước tâm máy bay để thấy rộng cảnh quan phía trước
      this.tmpDesiredTarget.copy(aircraftPos)
        .addScaledVector(this.tmpForward, 3.8)
        .addScaledVector(new Vector3(0, 1, 0), 0.75)
        .addScaledVector(aircraftVel, 0.035);

      // Trục Up của camera pha trộn nhẹ góc nghiêng máy bay (18%) với phương thẳng đứng thế giới (82%) để cảm nhận roll mà không bị chóng mặt/lật hình
      const desiredUp = new Vector3(0, 1, 0).lerp(this.tmpUp, 0.18).normalize();

      if (!this.initialized) {
        this.smoothedEye.copy(this.tmpDesiredEye);
        this.smoothedTarget.copy(this.tmpDesiredTarget);
        this.smoothedUp.copy(desiredUp);
        this.initialized = true;
      } else {
        // Spring damping mượt mà, không phụ thuộc FPS
        const posDamper = 1.0 - Math.exp(-10.5 * dt);
        const targetDamper = 1.0 - Math.exp(-16.0 * dt);
        const upDamper = 1.0 - Math.exp(-8.5 * dt);
        this.smoothedEye.lerp(this.tmpDesiredEye, posDamper);
        this.smoothedTarget.lerp(this.tmpDesiredTarget, targetDamper);
        this.smoothedUp.lerp(desiredUp, upDamper).normalize();
      }

      this.camera.position.copy(this.smoothedEye);
      this.camera.lookAt(this.smoothedTarget, this.smoothedUp);
    } else {
      // Camera buồng lái (Cockpit Camera): Đặt tại vị trí mắt phi công ghế trái (x = -0.24m, y = 0.27m, z = -0.34m)
      const pilotEyeLocal = new Vector3(-0.18, 0.25, -0.20);

      // Hiệu ứng rung động cơ nhẹ + turbulence (có thể tắt trong cài đặt)
      if (settings.cockpitVibration) {
        const rpmFreq = (telemetry.rpm / 60.0) * Math.PI * 2;
        const engineAmp = 0.0008 + (telemetry.rpm / 2700) * 0.0012;
        const stallBuffetAmp = telemetry.isStalling ? 0.0055 : 0.0;
        const totalAmp = engineAmp + stallBuffetAmp;
        pilotEyeLocal.x += Math.sin(this.simTime * rpmFreq * 0.5) * totalAmp;
        pilotEyeLocal.y += Math.cos(this.simTime * rpmFreq) * totalAmp + Math.sin(this.simTime * 14.0) * stallBuffetAmp;
      }

      this.camera.position.copy(pilotEyeLocal).applyQuaternion(aircraftQuat).add(aircraftPos);

      // Góc nhìn trong buồng lái kết hợp hướng máy bay + góc xoay đầu phi công bằng chuột (mặc định hơi nhìn xuống -4.5 độ để vừa thấy bầu trời vừa thấy rõ bảng đồng hồ)
      this.tmpLookEuler.set(mousePitch - 0.14, mouseYaw, 0, 'YXZ');
      this.tmpLookOffsetQuat.setFromEuler(this.tmpLookEuler);
      const combinedQuat = aircraftQuat.clone().multiply(this.tmpLookOffsetQuat);

      const lookDir = new Vector3(0, 0, -1).applyQuaternion(combinedQuat);
      const upDir = new Vector3(0, 1, 0).applyQuaternion(combinedQuat);
      this.tmpDesiredTarget.copy(this.camera.position).addScaledVector(lookDir, 50.0);

      this.camera.lookAt(this.tmpDesiredTarget, upDir);
      this.initialized = true;
    }
  }
}
