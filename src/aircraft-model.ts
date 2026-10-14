/**
 * AERONAUT: Wilderness Flight
 * Module: src/aircraft-model.ts
 *
 * Mô hình 3D chi tiết theo nguyên mẫu Cessna 172S Skyhawk (Textron Aviation):
 * - Sải cánh 11.00 m, chiều dài 8.28 m, chiều cao 2.72 m.
 * - Thân máy bay tiết diện cong đa điểm (Lofted Fuselage), cửa sổ hậu Omni-Vision.
 * - Cánh cao tiết diện khí động học NACA 2412 có góc dihedral +1.75° và thanh chống cánh đôi (Wing Struts).
 * - Bộ càng 3 bánh cố định (Tricycle Landing Gear) có ốp bánh khí động học (Wheel Fairings).
 * - Đuôi đứng swept-back, đuôi ngang và các mặt điều khiển gắn đúng trục bản lề:
 *   + Aileron trái/phải phản ứng ngược chiều theo Roll.
 *   + Flap trong cánh phản ứng theo nấc điều khiển (0°, 10°, 20°, 30°).
 *   + Elevator phản ứng theo Pitch.
 *   + Rudder phản ứng theo Yaw.
 *   + Cánh quạt 2 lá McCauley quay theo RPM, tự động chuyển mượt sang đĩa mờ (Propeller Blur Disc) ở RPM cao.
 * - Buồng lái 3D với bảng đồng hồ hoạt động thời gian thực (Airspeed, Attitude/Horizon, Altimeter, Heading, RPM, VSI) và cần lái (Yoke).
 *
 * Ghi chú tài nguyên: Đây là mô hình hình học 3D tự dựng chi tiết theo bản vẽ kích thước nguyên mẫu Cessna 172 Skyhawk,
 * được tổ chức theo cấu trúc Scene Graph tiêu chuẩn để có thể thay thế bằng file GLB ngoài qua hàm `replaceWithExternalGLB()`.
 */

import {
  BufferGeometry, Color, GeometryBuilder, Group, Material, MathUtils, Mesh, Object3D, Vector3
} from './webgl2-three';
import { TelemetryData } from './types';

export class Cessna172Model {
  root = new Group();
  exteriorGroup = new Group();
  cockpitGroup = new Group();

  // Các khớp bản lề chuyển động (Control Surface Pivots)
  propellerSolidGroup = new Group();
  propellerBlurMesh!: Mesh;
  aileronLeftPivot = new Group();
  aileronRightPivot = new Group();
  flapLeftPivot = new Group();
  flapRightPivot = new Group();
  elevatorPivot = new Group();
  rudderPivot = new Group();
  noseWheelPivot = new Group();
  yokeLeftPivot = new Group();
  yokeRightPivot = new Group();
  throttleLeverMesh!: Mesh;

  // Hệ thống hạt bụi bánh xe khi chạy trên đường băng/đất
  dustParticlesGroup = new Group();
  private dustMeshes: Array<{ mesh: Mesh; vel: Vector3; life: number; maxLife: number }> = [];

  // Canvas & Material cho bảng đồng hồ 3D trong buồng lái
  private panelCanvas: HTMLCanvasElement;
  private panelCtx: CanvasRenderingContext2D;
  private panelMaterial: Material;
  private lastPanelRedrawTime = -1;

  constructor() {
    this.root.name = 'Cessna172_Root';
    this.root.add(this.exteriorGroup);
    this.root.add(this.cockpitGroup);
    this.root.add(this.dustParticlesGroup);

    this.panelCanvas = document.createElement('canvas');
    this.panelCanvas.width = 1024;
    this.panelCanvas.height = 384;
    this.panelCtx = this.panelCanvas.getContext('2d')!;
    this.panelMaterial = new Material({
      shaderType: 'unlit_tex',
      canvasTexture: this.panelCanvas,
      roughness: 0.3,
      metalness: 0.1
    });

    this.buildFuselageAndLivery();
    this.buildHighWingAndStruts();
    this.buildEmpennageAndTailSurfaces();
    this.buildTricycleLandingGear();
    this.buildPropellerAssembly();
    this.buildCockpitInterior();
    this.initDustParticles();
  }

  /**
   * 1. Thân máy bay (Lofted Fuselage) + Sơn trắng điểm nhấn xanh đậm + Kính buồng lái
   */
  private buildFuselageAndLivery(): void {
    // Vật liệu sơn trắng bóng vừa phải (clearcoat nhẹ, roughness 0.32, không như gương hay nhựa)
    const whitePaintMat = new Material({
      color: 0xf4f6f9,
      roughness: 0.32,
      metalness: 0.08,
      clearcoat: 0.55
    });
    // Điểm nhấn sơn xanh đậm (Deep Navy/Cobalt Livery)
    const navyAccentMat = new Material({
      color: 0x123868,
      roughness: 0.30,
      metalness: 0.15,
      clearcoat: 0.6
    });
    // Điểm nhấn viền xanh lam sáng
    const skyStripeMat = new Material({
      color: 0x2b72b8,
      roughness: 0.34,
      metalness: 0.12
    });
    // Kim loại nhôm & ống xả
    const metalMat = new Material({
      color: 0x9aa3ad,
      roughness: 0.38,
      metalness: 0.78
    });
    // Kính chắn gió & cửa sổ cabin (trong suốt, có phản chiếu nhẹ của bầu trời)
    const glassMat = new Material({
      color: 0x9ad0f5,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 0.95,
      opacity: 0.32,
      transparent: true,
      doubleSided: true
    });

    // Dựng thân máy bay bằng Lofted Sections dọc chiều dài 8.28 m (từ mũi z = -3.35 m đến đuôi z = +4.65 m)
    const fuselageGeo = GeometryBuilder.createLoftedSections([
      { z: -3.32, rx: 0.22, ryTop: 0.16, ryBot: 0.22, yOffset: -0.14, power: 0.95 }, // Mũi nắp capo động cơ
      { z: -3.05, rx: 0.46, ryTop: 0.24, ryBot: 0.40, yOffset: -0.12, power: 0.85 }, // Khoang động cơ Lycoming
      { z: -2.15, rx: 0.56, ryTop: 0.26, ryBot: 0.48, yOffset: -0.10, power: 0.78 }, // Vách ngăn lửa (Stepped Firewall)
      { z: -1.45, rx: 0.58, ryTop: 0.14, ryBot: 0.48, yOffset: -0.10, power: 0.74 }, // Chân kính chắn gió
      { z: -0.65, rx: 0.62, ryTop: 0.12, ryBot: 0.48, yOffset: -0.12, power: 0.68 }, // Thân dưới cửa sổ cabin trước
      { z: 0.45,  rx: 0.61, ryTop: 0.14, ryBot: 0.46, yOffset: -0.12, power: 0.68 }, // Thân dưới cửa sổ cabin sau
      { z: 1.25,  rx: 0.52, ryTop: 0.36, ryBot: 0.44, yOffset: -0.04, power: 0.76 }, // Sau cửa sổ hậu Omni-Vision
      { z: 2.55,  rx: 0.34, ryTop: 0.30, ryBot: 0.32, yOffset: 0.00, power: 0.85 },  // Thân đuôi giữa
      { z: 3.95,  rx: 0.16, ryTop: 0.22, ryBot: 0.18, yOffset: 0.05, power: 0.90 },  // Gốc đuôi đứng
      { z: 4.58,  rx: 0.04, ryTop: 0.12, ryBot: 0.06, yOffset: 0.08, power: 0.95 }   // Chóp đuôi (Tailcone)
    ], 24);
    const fuselageMesh = new Mesh(fuselageGeo, whitePaintMat);
    fuselageMesh.castShadow = true;
    fuselageMesh.receiveShadow = true;
    this.exteriorGroup.add(fuselageMesh);

    // Dải sơn xanh đậm chạy dọc hông dưới thân máy bay (Cheatline Livery)
    const stripeGeo = GeometryBuilder.createLoftedSections([
      { z: -3.15, rx: 0.47, ryTop: 0.06, ryBot: 0.08, yOffset: -0.22, power: 0.85 },
      { z: -2.15, rx: 0.57, ryTop: 0.08, ryBot: 0.10, yOffset: -0.24, power: 0.78 },
      { z: -0.60, rx: 0.63, ryTop: 0.08, ryBot: 0.12, yOffset: -0.26, power: 0.68 },
      { z: 0.60,  rx: 0.615, ryTop: 0.08, ryBot: 0.10, yOffset: -0.24, power: 0.70 },
      { z: 2.40,  rx: 0.35, ryTop: 0.07, ryBot: 0.08, yOffset: -0.06, power: 0.85 },
      { z: 4.10,  rx: 0.15, ryTop: 0.06, ryBot: 0.05, yOffset: 0.04, power: 0.90 }
    ], 20);
    const stripeMesh = new Mesh(stripeGeo, navyAccentMat);
    this.exteriorGroup.add(stripeMesh);

    // Dải viền xanh lam mảnh phía dưới cửa sổ cabin
    const upperAccentGeo = GeometryBuilder.createLoftedSections([
      { z: -2.90, rx: 0.465, ryTop: 0.04, ryBot: 0.02, yOffset: -0.02, power: 0.82 },
      { z: -1.45, rx: 0.595, ryTop: 0.04, ryBot: 0.02, yOffset: -0.06, power: 0.72 },
      { z: 1.25,  rx: 0.525, ryTop: 0.04, ryBot: 0.02, yOffset: -0.06, power: 0.76 },
      { z: 3.85,  rx: 0.185, ryTop: 0.04, ryBot: 0.02, yOffset: 0.05, power: 0.88 }
    ], 16);
    const upperAccentMesh = new Mesh(upperAccentGeo, skyStripeMat);
    this.exteriorGroup.add(upperAccentMesh);

    // Kính chắn gió (Windshield) và khung vòm cabin trong suốt (ryBot bao trọn xuống đáy cabin để không có mặt cắt ngang tầm mắt)
    const canopyGeo = GeometryBuilder.createLoftedSections([
      { z: -1.46, rx: 0.56, ryTop: 0.18, ryBot: 0.35, yOffset: -0.04, power: 0.76 },
      { z: -0.68, rx: 0.61, ryTop: 0.76, ryBot: 0.42, yOffset: -0.02, power: 0.70 },
      { z: 0.45,  rx: 0.60, ryTop: 0.74, ryBot: 0.42, yOffset: -0.02, power: 0.70 },
      { z: 1.24,  rx: 0.50, ryTop: 0.34, ryBot: 0.35, yOffset: -0.02, power: 0.76 }
    ], 18);
    const canopyMesh = new Mesh(canopyGeo, glassMat);
    this.exteriorGroup.add(canopyMesh);

    // Hốc hút gió làm mát động cơ Lycoming ở mũi dưới và ống xả kép
    const intakeMat = new Material({ color: 0x16191d, roughness: 0.8, metalness: 0.2 });
    const intakeL = new Mesh(GeometryBuilder.createBox(0.22, 0.11, 0.12), intakeMat);
    intakeL.position.set(-0.20, -0.14, -3.28);
    const intakeR = new Mesh(GeometryBuilder.createBox(0.22, 0.11, 0.12), intakeMat);
    intakeR.position.set(0.20, -0.14, -3.28);
    const exhaustPipe = new Mesh(GeometryBuilder.createCylinder(0.035, 0.035, 0.38, 8, 'z'), metalMat);
    exhaustPipe.position.set(0.18, -0.52, -2.35);
    exhaustPipe.rotation.x = 0.35;
    this.exteriorGroup.add(intakeL);
    this.exteriorGroup.add(intakeR);
    this.exteriorGroup.add(exhaustPipe);

    // Khe đường nối cửa cabin (Door seam lines) hai bên thân
    const seamMat = new Material({ color: 0x3a434e, roughness: 0.6 });
    for (const side of [-1, 1]) {
      const doorFrame = new Mesh(GeometryBuilder.createBox(0.015, 0.36, 0.92), seamMat);
      doorFrame.position.set(side * 0.615, -0.28, -0.22);
      this.exteriorGroup.add(doorFrame);
    }
  }

  /**
   * 2. Cánh cao NACA 2412 (sải cánh 11.00 m), Thanh chống cánh (Wing Struts), Flap & Aileron
   */
  private buildHighWingAndStruts(): void {
    const whiteWingMat = new Material({
      color: 0xf5f7fa,
      roughness: 0.30,
      metalness: 0.08,
      clearcoat: 0.55
    });
    const navyTipMat = new Material({
      color: 0x123868,
      roughness: 0.30,
      metalness: 0.15,
      clearcoat: 0.6
    });
    const strutMat = new Material({
      color: 0xeaeef4,
      roughness: 0.34,
      metalness: 0.18
    });

    // Cánh chính: Sải cánh 11.00 m, dây cung gốc 1.62 m, dây cung đầu mút 1.12 m, cao độ lắp cánh y = 0.72 m
    const mainWingGeo = GeometryBuilder.createAirfoilWing(11.0, 1.62, 1.12, 0.12, 0.17, 0.14, 16, 22);
    const mainWingMesh = new Mesh(mainWingGeo, whiteWingMat);
    mainWingMesh.position.set(0, 0.72, -0.22);
    mainWingMesh.castShadow = true;
    mainWingMesh.receiveShadow = true;
    this.exteriorGroup.add(mainWingMesh);

    // Sơn xanh đậm ở hai đầu mút cánh (Wingtip Fairings) + Đèn hàng không (Đỏ cánh trái, Xanh lá cánh phải)
    const tipGeo = GeometryBuilder.createBox(0.45, 0.08, 1.12);
    const leftTip = new Mesh(tipGeo, navyTipMat);
    leftTip.position.set(-5.32, 0.88, -0.14);
    const rightTip = new Mesh(tipGeo, navyTipMat);
    rightTip.position.set(5.32, 0.88, -0.14);
    this.exteriorGroup.add(leftTip);
    this.exteriorGroup.add(rightTip);

    const navLightRed = new Mesh(
      GeometryBuilder.createCylinder(0.04, 0.04, 0.12, 8, 'z'),
      new Material({ color: 0xff2222, emissive: 0xff1111 })
    );
    navLightRed.position.set(-5.52, 0.88, -0.35);
    const navLightGreen = new Mesh(
      GeometryBuilder.createCylinder(0.04, 0.04, 0.12, 8, 'z'),
      new Material({ color: 0x22ff44, emissive: 0x11ee33 })
    );
    navLightGreen.position.set(5.52, 0.88, -0.35);
    this.exteriorGroup.add(navLightRed);
    this.exteriorGroup.add(navLightGreen);

    // Thanh chống cánh đôi (Wing Struts) nối từ hông dưới thân máy bay (x = ±0.58, y = -0.44, z = -0.32) lên cánh (x = ±2.95, y = 0.76, z = -0.28)
    for (const side of [-1, 1]) {
      const p0 = new Vector3(side * 0.58, -0.44, -0.30);
      const p1 = new Vector3(side * 2.95, 0.76, -0.26);
      const diff = new Vector3().subVectors(p1, p0);
      const len = diff.length();
      const mid = new Vector3().lerpVectors(p0, p1, 0.5);

      const strutGroup = new Group();
      strutGroup.position.copy(mid);
      strutGroup.rotation.z = side * Math.atan2(diff.x * side, diff.y) * -1 + side * (Math.PI * 0.5);
      // Góc nghiêng thực tế của thanh chống cánh: atan2(1.20, 2.37) ≈ 26.8 độ
      strutGroup.rotation.set(0, 0, side * (-Math.PI * 0.5 + Math.atan2(1.20, 2.37)));

      const strutMesh = new Mesh(GeometryBuilder.createBox(0.045, len, 0.13), strutMat);
      strutMesh.castShadow = true;
      strutGroup.add(strutMesh);
      this.exteriorGroup.add(strutGroup);
    }

    // Các bề mặt điều khiển trên cánh (Flap trong & Aileron ngoài) gắn đúng trục bản lề (mép trước nằm tại z = 0 của Pivot)
    const controlSurfaceMat = new Material({ color: 0xdfe5ee, roughness: 0.35, metalness: 0.12 });

    // Flap trái & phải (từ x = 0.75 m đến x = 2.65 m, rộng 1.90 m, sâu 0.34 m)
    const flapGeo = GeometryBuilder.createBox(1.88, 0.045, 0.34, 0, 0, 0.17);
    this.flapLeftPivot.position.set(-1.72, 0.73, 0.48);
    this.flapRightPivot.position.set(1.72, 0.73, 0.48);
    this.flapLeftPivot.add(new Mesh(flapGeo, controlSurfaceMat));
    this.flapRightPivot.add(new Mesh(flapGeo, controlSurfaceMat));
    this.exteriorGroup.add(this.flapLeftPivot);
    this.exteriorGroup.add(this.flapRightPivot);

    // Aileron trái & phải (từ x = 2.75 m đến x = 5.05 m, rộng 2.25 m, sâu 0.30 m)
    const aileronGeo = GeometryBuilder.createBox(2.22, 0.04, 0.30, 0, 0, 0.15);
    this.aileronLeftPivot.position.set(-3.90, 0.81, 0.42);
    this.aileronRightPivot.position.set(3.90, 0.81, 0.42);
    this.aileronLeftPivot.add(new Mesh(aileronGeo, navyTipMat));
    this.aileronRightPivot.add(new Mesh(aileronGeo, navyTipMat));
    this.exteriorGroup.add(this.aileronLeftPivot);
    this.exteriorGroup.add(this.aileronRightPivot);
  }

  /**
   * 3. Cụm đuôi (Swept-back Vertical Fin, Dorsal Fin, Horizontal Stabilizer, Elevator & Rudder)
   */
  private buildEmpennageAndTailSurfaces(): void {
    const whiteMat = new Material({ color: 0xf4f6f9, roughness: 0.32, metalness: 0.08, clearcoat: 0.5 });
    const navyMat = new Material({ color: 0x123868, roughness: 0.30, metalness: 0.15, clearcoat: 0.6 });

    // Sống lưng đuôi (Dorsal Fin) và Đuôi đứng (Swept-back Vertical Fin đặc trưng của Cessna 172)
    const vFinGeo = GeometryBuilder.createLoftedSections([
      { z: 2.35, rx: 0.045, ryTop: 0.18, ryBot: 0.02, yOffset: 0.28, power: 0.9 },
      { z: 3.35, rx: 0.055, ryTop: 0.55, ryBot: 0.02, yOffset: 0.32, power: 0.85 },
      { z: 4.32, rx: 0.045, ryTop: 1.38, ryBot: 0.02, yOffset: 0.22, power: 0.85 },
      { z: 4.55, rx: 0.030, ryTop: 1.35, ryBot: 0.02, yOffset: 0.22, power: 0.9 }
    ], 12);
    const vFinMesh = new Mesh(vFinGeo, whiteMat);
    vFinMesh.castShadow = true;
    this.exteriorGroup.add(vFinMesh);

    // Chóp đuôi đứng sơn xanh đậm + đèn strobe trắng
    const finCap = new Mesh(GeometryBuilder.createBox(0.07, 0.28, 0.58), navyMat);
    finCap.position.set(0, 1.48, 4.35);
    this.exteriorGroup.add(finCap);

    // Rudder gắn đúng trục bản lề đứng tại z = 4.48 m (xoay quanh trục Y khi đạp Rudder Q/E)
    this.rudderPivot.position.set(0, 0.82, 4.48);
    const rudderMesh = new Mesh(GeometryBuilder.createBox(0.045, 1.32, 0.42, 0, 0, 0.21), navyMat);
    rudderMesh.castShadow = true;
    this.rudderPivot.add(rudderMesh);
    this.exteriorGroup.add(this.rudderPivot);

    // Đuôi ngang cố định (Horizontal Stabilizer, sải 3.45 m)
    const hStabGeo = GeometryBuilder.createAirfoilWing(3.45, 0.72, 0.48, 0.10, 0.0, 0.08, 8, 14);
    const hStabMesh = new Mesh(hStabGeo, whiteMat);
    hStabMesh.position.set(0, 0.16, 4.02);
    hStabMesh.castShadow = true;
    this.exteriorGroup.add(hStabMesh);

    // Elevator gắn đúng trục bản lề ngang tại z = 4.34 m (xoay quanh trục X khi kéo/đẩy cần lái Pitch)
    this.elevatorPivot.position.set(0, 0.16, 4.34);
    const elevLeft = new Mesh(GeometryBuilder.createBox(1.52, 0.035, 0.32, -0.84, 0, 0.16), navyMat);
    const elevRight = new Mesh(GeometryBuilder.createBox(1.52, 0.035, 0.32, 0.84, 0, 0.16), navyMat);
    this.elevatorPivot.add(elevLeft);
    this.elevatorPivot.add(elevRight);
    this.exteriorGroup.add(this.elevatorPivot);
  }

  /**
   * 4. Bộ càng 3 bánh cố định (Fixed Tricycle Landing Gear + Wheel Pants Fairings)
   */
  private buildTricycleLandingGear(): void {
    const strutMat = new Material({ color: 0xe6ebf2, roughness: 0.38, metalness: 0.25 });
    const chromeMat = new Material({ color: 0xcfd6df, roughness: 0.18, metalness: 0.88 });
    const tireMat = new Material({ color: 0x1d2024, roughness: 0.88, metalness: 0.04 });
    const fairingMat = new Material({ color: 0xf4f6f9, roughness: 0.30, metalness: 0.10, clearcoat: 0.55 });

    // Càng mũi (Nose Gear) tại z = -2.28 m, có khả năng xoay điều hướng khi chạy taxi trên mặt đất
    this.noseWheelPivot.position.set(0, -0.48, -2.28);
    const noseStrut = new Mesh(GeometryBuilder.createCylinder(0.045, 0.04, 0.68, 10, 'y'), chromeMat);
    noseStrut.position.set(0, -0.32, 0);
    const noseTire = new Mesh(GeometryBuilder.createCylinder(0.21, 0.21, 0.14, 14, 'x'), tireMat);
    noseTire.position.set(0, -0.68, 0);
    const nosePant = new Mesh(GeometryBuilder.createBox(0.20, 0.24, 0.56, 0, -0.62, 0.04), fairingMat);
    this.noseWheelPivot.add(noseStrut);
    this.noseWheelPivot.add(noseTire);
    this.noseWheelPivot.add(nosePant);
    this.exteriorGroup.add(this.noseWheelPivot);

    // Hai càng chính (Main Gear Legs) tại z = -0.05 m, vươn ra x = ±1.35 m, đáy bánh xe ở y = -1.36 m
    for (const side of [-1, 1]) {
      const legGroup = new Group();
      legGroup.position.set(side * 0.88, -0.82, -0.05);
      legGroup.rotation.z = side * 0.62;
      const legMesh = new Mesh(GeometryBuilder.createBox(0.06, 1.05, 0.14), strutMat);
      legMesh.castShadow = true;
      legGroup.add(legMesh);
      this.exteriorGroup.add(legGroup);

      const wheelGroup = new Group();
      wheelGroup.position.set(side * 1.35, -1.14, -0.05);
      const mainTire = new Mesh(GeometryBuilder.createCylinder(0.24, 0.24, 0.16, 16, 'x'), tireMat);
      const wheelPant = new Mesh(GeometryBuilder.createBox(0.24, 0.28, 0.66, 0, 0.06, 0.05), fairingMat);
      wheelGroup.add(mainTire);
      wheelGroup.add(wheelPant);
      this.exteriorGroup.add(wheelGroup);
    }
  }

  /**
   * 5. Cánh quạt 2 lá McCauley + Chóp Spinner + Đĩa mờ (Propeller Blur Disc) khi RPM cao
   */
  private buildPropellerAssembly(): void {
    const spinnerMat = new Material({ color: 0xd8dee6, roughness: 0.20, metalness: 0.85, clearcoat: 0.7 });
    const bladeMat = new Material({ color: 0x22262b, roughness: 0.42, metalness: 0.35 });
    const tipStripeMat = new Material({ color: 0xf4f6f9, roughness: 0.35 });

    this.propellerSolidGroup.position.set(0, -0.08, -3.38);

    // Chóp nón Spinner
    const spinner = new Mesh(GeometryBuilder.createCylinder(0.02, 0.21, 0.38, 16, 'z'), spinnerMat);
    spinner.position.set(0, 0, -0.16);
    this.propellerSolidGroup.add(spinner);

    // Hai lá cánh quạt đối xứng (đường kính 1.90 m -> mỗi lá dài 0.92 m) có góc xoắn pitch
    for (const dir of [-1, 1]) {
      const bladeGroup = new Group();
      bladeGroup.rotation.y = dir * 0.26;
      const blade = new Mesh(GeometryBuilder.createBox(0.13, 0.88, 0.022, 0, dir * 0.46, 0), bladeMat);
      const bladeTip = new Mesh(GeometryBuilder.createBox(0.125, 0.10, 0.024, 0, dir * 0.86, 0), tipStripeMat);
      bladeGroup.add(blade);
      bladeGroup.add(bladeTip);
      this.propellerSolidGroup.add(bladeGroup);
    }
    this.exteriorGroup.add(this.propellerSolidGroup);

    // Đĩa mờ cánh quạt (Propeller Blur Disc) hiển thị khi RPM cao để tránh hiện tượng nhấp nháy stroboscopic
    const discGeo = GeometryBuilder.createPlane(1.90, 1.90, 1, 1, true);
    const discMat = new Material({
      shaderType: 'prop_blur',
      transparent: true,
      doubleSided: true,
      opacity: 0.0
    });
    this.propellerBlurMesh = new Mesh(discGeo, discMat);
    this.propellerBlurMesh.position.set(0, -0.08, -3.42);
    this.exteriorGroup.add(this.propellerBlurMesh);
  }

  /**
   * 6. Nội thất Buồng lái 3D (Cockpit Interior, Bảng đồng hồ hoạt động thật, Cần lái Yoke & Khung cửa sổ)
   */
  private buildCockpitInterior(): void {
    const dashDarkMat = new Material({ color: 0x1c2026, roughness: 0.78, metalness: 0.12 });
    const cabinTrimMat = new Material({ color: 0x323942, roughness: 0.65, metalness: 0.10 });
    const seatLeatherMat = new Material({ color: 0x4a3b2f, roughness: 0.62, metalness: 0.05 });
    const yokeMat = new Material({ color: 0x15181c, roughness: 0.45, metalness: 0.25 });
    const chromeShaftMat = new Material({ color: 0xc5cdd6, roughness: 0.25, metalness: 0.85 });

    // Mái che nắng bảng đồng hồ (Glareshield) & Thân bảng đồng hồ trước mặt phi công
    const glareshield = new Mesh(GeometryBuilder.createBox(1.12, 0.028, 0.15), dashDarkMat);
    glareshield.position.set(0, 0.265, -0.88);
    this.cockpitGroup.add(glareshield);

    const dashHousing = new Mesh(GeometryBuilder.createBox(1.10, 0.36, 0.14), cabinTrimMat);
    dashHousing.position.set(0, 0.075, -0.92);
    this.cockpitGroup.add(dashHousing);

    // Mặt bảng đồng hồ 3D gắn CanvasTexture độ phân giải 1024x384 cập nhật theo trạng thái bay
    const panelFaceGeo = GeometryBuilder.createPlane(1.04, 0.34, 1, 1, true);
    const panelFaceMesh = new Mesh(panelFaceGeo, this.panelMaterial);
    panelFaceMesh.position.set(0, 0.08, -0.838);
    this.cockpitGroup.add(panelFaceMesh);

    // Hai cột chữ A (Windshield A-Pillars) và Trần cabin tạo cảm giác ngồi trong buồng lái thật
    for (const side of [-1, 1]) {
      const pillar = new Mesh(GeometryBuilder.createBox(0.045, 0.62, 0.055), cabinTrimMat);
      pillar.position.set(side * 0.54, 0.38, -0.82);
      pillar.rotation.x = 0.58;
      pillar.rotation.z = -side * 0.12;
      this.cockpitGroup.add(pillar);
    }
    const overheadConsole = new Mesh(GeometryBuilder.createBox(0.36, 0.04, 0.65), cabinTrimMat);
    overheadConsole.position.set(0, 0.69, -0.35);
    this.cockpitGroup.add(overheadConsole);

    // Hai cần lái (Dual Control Yokes) chuyển động theo Pitch (kéo/đẩy dọc trục Z) và Roll (xoay trục Z)
    const buildYoke = (pivot: Group, xPos: number) => {
      pivot.position.set(xPos, -0.08, -0.76);
      const shaft = new Mesh(GeometryBuilder.createCylinder(0.016, 0.016, 0.24, 10, 'z'), chromeShaftMat);
      shaft.position.set(0, 0, -0.06);
      const crossbar = new Mesh(GeometryBuilder.createBox(0.24, 0.032, 0.032), yokeMat);
      const leftHorn = new Mesh(GeometryBuilder.createBox(0.032, 0.11, 0.035, -0.105, 0.035, 0), yokeMat);
      const rightHorn = new Mesh(GeometryBuilder.createBox(0.032, 0.11, 0.035, 0.105, 0.035, 0), yokeMat);
      pivot.add(shaft);
      pivot.add(crossbar);
      pivot.add(leftHorn);
      pivot.add(rightHorn);
      this.cockpitGroup.add(pivot);
    };
    buildYoke(this.yokeLeftPivot, -0.26);
    buildYoke(this.yokeRightPivot, 0.26);

    // Cần ga (Throttle Plunger) ở giữa bảng điều khiển dưới
    this.throttleLeverMesh = new Mesh(GeometryBuilder.createCylinder(0.024, 0.018, 0.14, 10, 'z'), yokeMat);
    this.throttleLeverMesh.position.set(0.0, -0.21, -0.78);
    this.cockpitGroup.add(this.throttleLeverMesh);

    // Hai ghế phi công bọc da
    for (const side of [-1, 1]) {
      const seatBack = new Mesh(GeometryBuilder.createBox(0.42, 0.56, 0.09), seatLeatherMat);
      seatBack.position.set(side * 0.26, -0.08, -0.12);
      this.cockpitGroup.add(seatBack);
    }
  }

  private initDustParticles(): void {
    const dustGeo = GeometryBuilder.createBox(0.45, 0.45, 0.45);
    for (let i = 0; i < 18; i++) {
      const mat = new Material({
        color: 0xcbc2b4,
        roughness: 0.9,
        transparent: true,
        opacity: 0.0
      });
      const mesh = new Mesh(dustGeo, mat);
      mesh.visible = false;
      this.dustParticlesGroup.add(mesh);
      this.dustMeshes.push({
        mesh,
        vel: new Vector3(),
        life: 0,
        maxLife: 0.8
      });
    }
  }

  /**
   * Vẽ đồng hồ buồng lái thời gian thực lên CanvasTexture (Airspeed, Attitude, Altimeter, Heading, RPM, Flap/Trim)
   */
  private redrawCockpitInstruments(telemetry: TelemetryData): void {
    const ctx = this.panelCtx;
    const w = this.panelCanvas.width;
    const h = this.panelCanvas.height;

    // Nền bảng đồng hồ kim loại xám đen nhám
    ctx.fillStyle = '#181c22';
    ctx.fillRect(0, 0, w, h);

    // Đường viền khung bảng
    ctx.strokeStyle = '#2d343e';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    const drawDialFrame = (cx: number, cy: number, r: number, title: string, unit: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = '#0d1014';
      ctx.fill();
      ctx.strokeStyle = '#434c58';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#12161c';
      ctx.fill();

      ctx.fillStyle = '#9fb0c4';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, cx, cy - r * 0.46);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#738498';
      ctx.fillText(unit, cx, cy + r * 0.62);
      ctx.restore();
    };

    const drawNeedle = (cx: number, cy: number, angleRad: number, len: number, color = '#ffffff', width = 4) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angleRad);
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(len, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#d8e0ea';
      ctx.fill();
      ctx.restore();
    };

    const r = 104;
    const cy = 172;

    // 1. AIRSPEED INDICATOR (ASI - Knots) tại x = 145
    const cxAsi = 145;
    drawDialFrame(cxAsi, cy, r, 'AIRSPEED', 'KNOTS (IAS)');
    // Vòng cung màu chuẩn Cessna 172 (Green arc 48-129 kt, Yellow 129-163 kt)
    const speedToAngle = (kt: number) => -Math.PI * 0.5 + MathUtils.clamp(kt / 160, 0, 1.05) * Math.PI * 1.75;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cxAsi, cy, r - 8, speedToAngle(48), speedToAngle(129));
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cxAsi, cy, r - 8, speedToAngle(129), speedToAngle(160));
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 7;
    ctx.stroke();
    for (let kt = 0; kt <= 160; kt += 20) {
      const a = speedToAngle(kt);
      const x1 = cxAsi + Math.cos(a) * (r - 18);
      const y1 = cy + Math.sin(a) * (r - 18);
      const x2 = cxAsi + Math.cos(a) * (r - 4);
      const y2 = cy + Math.sin(a) * (r - 4);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#dbe4ee';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#dbe4ee';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(kt), cxAsi + Math.cos(a) * (r - 34), cy + Math.sin(a) * (r - 34));
    }
    drawNeedle(cxAsi, cy, speedToAngle(telemetry.iasKnots), r - 18, '#ffffff', 4);
    ctx.fillStyle = '#4ef2a1';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(telemetry.iasKnots)} KT`, cxAsi, cy + 34);
    ctx.restore();

    // 2. ATTITUDE INDICATOR (Artificial Horizon) tại x = 385
    const cxAtt = 385;
    ctx.save();
    drawDialFrame(cxAtt, cy, r, '', '');
    ctx.beginPath();
    ctx.arc(cxAtt, cy, r - 4, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(cxAtt, cy);
    ctx.rotate(MathUtils.degToRad(telemetry.rollDeg));
    const pitchOffset = MathUtils.clamp(telemetry.pitchDeg * 2.4, -r * 0.85, r * 0.85);
    // Trời xanh
    ctx.fillStyle = '#2469b3';
    ctx.fillRect(-r * 1.5, -r * 2 + pitchOffset, r * 3, r * 2);
    // Mặt đất nâu
    ctx.fillStyle = '#6e4726';
    ctx.fillRect(-r * 1.5, pitchOffset, r * 3, r * 2);
    // Đường chân trời trắng
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r, pitchOffset);
    ctx.lineTo(r, pitchOffset);
    ctx.stroke();
    // Thang độ Pitch (-20, -10, +10, +20)
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    for (const p of [-20, -10, 10, 20]) {
      const py = pitchOffset - p * 2.4;
      ctx.beginPath();
      ctx.moveTo(-24, py);
      ctx.lineTo(24, py);
      ctx.stroke();
    }
    ctx.restore();
    // Biểu tượng cánh máy bay cố định ở tâm Attitude Indicator
    ctx.save();
    ctx.strokeStyle = '#ffae00';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cxAtt - 42, cy);
    ctx.lineTo(cxAtt - 12, cy);
    ctx.lineTo(cxAtt - 12, cy + 8);
    ctx.moveTo(cxAtt + 12, cy + 8);
    ctx.lineTo(cxAtt + 12, cy);
    ctx.lineTo(cxAtt + 42, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cxAtt, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffae00';
    ctx.fill();
    ctx.restore();

    // 3. ALTIMETER (Độ cao Feet) tại x = 625
    const cxAlt = 625;
    drawDialFrame(cxAlt, cy, r, 'ALTIMETER', 'FEET MSL');
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.5 + (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cxAlt + Math.cos(a) * (r - 16), cy + Math.sin(a) * (r - 16));
      ctx.lineTo(cxAlt + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
      ctx.strokeStyle = '#dbe4ee';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#dbe4ee';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), cxAlt + Math.cos(a) * (r - 32), cy + Math.sin(a) * (r - 32));
    }
    const alt = telemetry.altitudeMslFeet;
    const angle1000 = -Math.PI * 0.5 + ((alt / 10000) % 1) * Math.PI * 2;
    const angle100 = -Math.PI * 0.5 + ((alt / 1000) % 1) * Math.PI * 2;
    drawNeedle(cxAlt, cy, angle1000, r * 0.52, '#9ec5fe', 6);
    drawNeedle(cxAlt, cy, angle100, r - 18, '#ffffff', 3.5);
    ctx.fillStyle = '#4ef2a1';
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(alt)} FT`, cxAlt, cy + 34);

    // 4. HEADING / COMPASS & ENGINE TACHOMETER tại x = 865
    const cxHdg = 865;
    drawDialFrame(cxHdg, cy, r, 'HEADING', 'DEG / RPM');
    ctx.save();
    ctx.translate(cxHdg, cy);
    ctx.rotate(-MathUtils.degToRad(telemetry.headingDeg));
    const labels: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (let deg = 0; deg < 360; deg += 30) {
      const a = -Math.PI * 0.5 + MathUtils.degToRad(deg);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 16), Math.sin(a) * (r - 16));
      ctx.lineTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
      ctx.strokeStyle = '#dbe4ee';
      ctx.lineWidth = 2;
      ctx.stroke();
      const lbl = labels[deg] || String(deg / 10);
      ctx.fillStyle = deg % 90 === 0 ? '#ffcc33' : '#dbe4ee';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, Math.cos(a) * (r - 32), Math.sin(a) * (r - 32));
    }
    ctx.restore();
    // Mũi tên chỉ hướng hiện tại ở đỉnh đồng hồ
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.moveTo(cxHdg, cy - r + 14);
    ctx.lineTo(cxHdg - 8, cy - r + 2);
    ctx.lineTo(cxHdg + 8, cy - r + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4ef2a1';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(telemetry.headingDeg).toString().padStart(3, '0')}°`, cxHdg, cy + 6);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`${Math.round(telemetry.rpm)} RPM`, cxHdg, cy + 32);

    // Thanh trạng thái kỹ thuật phía dưới bảng đồng hồ (Annunciator Bar)
    ctx.fillStyle = '#0e1217';
    ctx.fillRect(28, h - 64, w - 56, 46);
    ctx.strokeStyle = '#2d3744';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, h - 64, w - 56, 46);

    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9ec5fe';
    ctx.fillText(`VSI: ${telemetry.verticalSpeedFpm >= 0 ? '+' : ''}${Math.round(telemetry.verticalSpeedFpm)} FPM`, 48, h - 35);
    ctx.fillText(`AGL: ${Math.round(telemetry.altitudeAglFeet)} FT`, 270, h - 35);
    ctx.fillText(`FLAPS: ${Math.round(telemetry.flapDeg)}°`, 455, h - 35);
    ctx.fillText(`TRIM: ${(telemetry.elevatorTrim * 100).toFixed(0)}%`, 615, h - 35);

    if (telemetry.isStallWarning) {
      ctx.fillStyle = '#e63946';
      ctx.fillRect(795, h - 58, 190, 34);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('STALL WARNING', 890, h - 35);
    } else {
      ctx.fillStyle = '#2a9d8f';
      ctx.textAlign = 'center';
      ctx.fillText(`THR: ${Math.round(telemetry.throttle * 100)}%`, 890, h - 35);
    }

    this.panelMaterial.textureNeedsUpdate = true;
  }

  /**
   * Cập nhật vị trí/góc xoay của các bộ phận chuyển động và đồng hồ buồng lái mỗi khung hình
   */
  updateFromTelemetry(telemetry: TelemetryData, dt: number, elapsedTime: number, enableParticles: boolean): void {
    // 1. Aileron phản ứng ngược chiều nhau theo Roll (xoay quanh trục X của bản lề)
    const maxAileronRad = MathUtils.degToRad(20);
    this.aileronLeftPivot.rotation.x = telemetry.aileronNorm * maxAileronRad;
    this.aileronRightPivot.rotation.x = -telemetry.aileronNorm * maxAileronRad;

    // 2. Flap hạ xuống theo nấc (0°, 10°, 20°, 30°)
    const flapRad = MathUtils.degToRad(telemetry.flapDeg);
    this.flapLeftPivot.rotation.x = flapRad;
    this.flapRightPivot.rotation.x = flapRad;

    // 3. Elevator phản ứng theo Pitch (kéo mũi lên -> mép sau elevator nâng lên -> rotation.x âm)
    const maxElevatorRad = MathUtils.degToRad(26);
    this.elevatorPivot.rotation.x = -telemetry.elevatorNorm * maxElevatorRad;

    // 4. Rudder phản ứng theo Yaw & Bánh mũi xoay điều hướng khi trên mặt đất
    const maxRudderRad = MathUtils.degToRad(18);
    this.rudderPivot.rotation.y = telemetry.rudderNorm * maxRudderRad;
    this.noseWheelPivot.rotation.y = telemetry.onGround ? -telemetry.rudderNorm * 0.35 : 0;

    // 5. Cánh quạt quay theo RPM & chuyển mượt sang đĩa mờ (Propeller Blur Disc) khi RPM cao
    const rps = telemetry.rpm / 60.0;
    this.propellerSolidGroup.rotation.z += rps * Math.PI * 2 * dt;
    // Khi RPM > 1100, giảm dần hiển thị cánh cứng ở tốc độ cao hoặc bật đĩa mờ để không bị nhấp nháy
    const blurFactor = MathUtils.smoothstep(950, 1850, telemetry.rpm);
    this.propellerBlurMesh.material.opacity = blurFactor * 0.52;
    this.propellerBlurMesh.visible = blurFactor > 0.02;

    // 6. Cần lái (Yoke) và Cần ga (Throttle) trong buồng lái
    const yokePullZ = telemetry.elevatorNorm * 0.065;
    const yokeRollRad = -telemetry.aileronNorm * MathUtils.degToRad(42);
    this.yokeLeftPivot.position.z = -0.76 + yokePullZ;
    this.yokeRightPivot.position.z = -0.76 + yokePullZ;
    this.yokeLeftPivot.rotation.z = yokeRollRad;
    this.yokeRightPivot.rotation.z = yokeRollRad;
    this.throttleLeverMesh.position.z = -0.74 - telemetry.throttle * 0.07;

    // 7. Cập nhật bảng đồng hồ buồng lái (~30 Hz để tiết kiệm băng thông upload texture mà kim vẫn cực mượt)
    if (elapsedTime - this.lastPanelRedrawTime > 0.032) {
      this.lastPanelRedrawTime = elapsedTime;
      this.redrawCockpitInstruments(telemetry);
    }

    // 8. Hiệu ứng bụi nhẹ khi bánh xe tiếp xúc và lăn trên nền đất/đường băng
    this.updateDustEffects(telemetry, dt, enableParticles);
  }

  private updateDustEffects(telemetry: TelemetryData, dt: number, enableParticles: boolean): void {
    const shouldEmit = enableParticles && telemetry.onGround && telemetry.groundSpeedKnots > 14;
    for (let i = 0; i < this.dustMeshes.length; i++) {
      const p = this.dustMeshes[i];
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        const t = Math.max(0, p.life / p.maxLife);
        const s = 0.6 + (1.0 - t) * 2.2;
        p.mesh.scale.set(s, s * 0.7, s);
        p.mesh.material.opacity = t * 0.28;
        if (p.life <= 0) {
          p.mesh.visible = false;
        }
      } else if (shouldEmit && Math.random() < dt * 18) {
        const side = i % 2 === 0 ? -1.35 : 1.35;
        p.mesh.position.set(
          this.root.position.x + side,
          this.root.position.y - 1.25,
          this.root.position.z + 0.4
        );
        p.vel.set((Math.random() - 0.5) * 2.5, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 2.5);
        p.maxLife = 0.55 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.mesh.visible = true;
      }
    }
  }

  /**
   * Hỗ trợ thay thế mô hình tự dựng bằng mô hình GLB bên ngoài nếu có trong tương lai
   */
  replaceWithExternalGLB(externalSceneRoot: Object3D): void {
    this.root.remove(this.exteriorGroup);
    this.exteriorGroup = new Group();
    this.exteriorGroup.add(externalSceneRoot);
    this.root.add(this.exteriorGroup);
  }
}
