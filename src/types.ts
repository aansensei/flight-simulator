/**
 * AERONAUT: Wilderness Flight
 * Module: src/types.ts
 * Định nghĩa các kiểu dữ liệu, hằng số nguyên mẫu Cessna 172 Skyhawk và cấu hình hệ thống.
 */

export type FlightMode = 'assisted' | 'simulation';
export type CameraMode = 'chase' | 'cockpit';
export type QualityPresetName = 'low' | 'medium' | 'high' | 'ultra';
export type TimeOfDayPreset = 'dawn' | 'morning' | 'noon' | 'sunset' | 'dusk';
export type WeatherPreset = 'clear' | 'haze' | 'overcast' | 'rain';
export type SpawnLocation = 'airborne' | 'runway' | 'approach' | 'archipelago';

export interface QualityConfig {
  label: string;
  renderScale: number;
  maxPixelRatio: number;
  shadowMapSize: number;
  terrainSegments: number;
  treeCount: number;
  rockCount: number;
  cloudClusters: number;
  waterWaveLayers: number;
  enableParticles: boolean;
  enablePostGrading: boolean;
}

export const QUALITY_PRESETS: Record<QualityPresetName, QualityConfig> = {
  low: {
    label: 'Thấp (Low)',
    renderScale: 0.65,
    maxPixelRatio: 1.0,
    shadowMapSize: 512,
    terrainSegments: 180,
    treeCount: 8000,
    rockCount: 180,
    cloudClusters: 35,
    waterWaveLayers: 1,
    enableParticles: false,
    enablePostGrading: false
  },
  medium: {
    label: 'Trung bình (Medium)',
    renderScale: 0.85,
    maxPixelRatio: 1.5,
    shadowMapSize: 1024,
    terrainSegments: 240,
    treeCount: 20000,
    rockCount: 350,
    cloudClusters: 65,
    waterWaveLayers: 2,
    enableParticles: true,
    enablePostGrading: true
  },
  high: {
    label: 'Cao (High)',
    renderScale: 1.0,
    maxPixelRatio: 2.0,
    shadowMapSize: 2048,
    terrainSegments: 360,
    treeCount: 40000,
    rockCount: 600,
    cloudClusters: 105,
    waterWaveLayers: 4,
    enableParticles: true,
    enablePostGrading: true
  },
  ultra: {
    label: 'Ultra (Hỗ trợ 4K)',
    renderScale: 1.0,
    maxPixelRatio: 3.0,
    shadowMapSize: 4096,
    terrainSegments: 480,
    treeCount: 100000,
    rockCount: 1000,
    cloudClusters: 150,
    waterWaveLayers: 4,
    enableParticles: true,
    enablePostGrading: true
  }
};

/**
 * Thông số kỹ thuật tham chiếu từ nguyên mẫu Cessna 172S Skyhawk (Textron Aviation)
 * Nguồn: https://cessna.txtav.com/en/piston/cessna-skyhawk
 * - Sải cánh (Wingspan): 11.00 m (36 ft 1 in)
 * - Chiều dài (Length): 8.28 m (27 ft 2 in)
 * - Chiều cao (Height): 2.72 m (8 ft 11 in)
 * - Diện tích cánh (Wing Area): 16.17 m² (174 sq ft)
 * - Khối lượng rỗng (Basic Empty Weight): 762 kg (1,680 lb)
 * - Khối lượng cất cánh tối đa (MTOW): 1,157 kg (2,550 lb)
 * - Động cơ: Lycoming IO-360-L2A, 180 HP (134 kW) @ 2,700 RPM
 * - Cánh quạt: McCauley 2 lá kim loại bước cố định, đường kính 1.905 m
 * - Vận tốc hành trình tối đa: 124 KTAS (~63.8 m/s)
 * - Vận tốc giới hạn (Vne): 163 KIAS (~83.8 m/s)
 * - Vận tốc thất tốc (Stall speed Vs0, full flaps): 48 KCAS (~24.7 m/s)
 */
export const CESSNA_172_SPECS = {
  wingspan: 11.0,         // m
  length: 8.28,           // m
  height: 2.72,           // m
  wingArea: 16.17,        // m²
  aspectRatio: 7.48,      // b² / S
  meanChord: 1.47,        // m
  mass: 1040.0,           // kg (Trọng lượng bay tiêu chuẩn với 1 phi công + nhiên liệu)
  emptyMass: 762.0,       // kg
  mtow: 1157.0,           // kg
  maxPowerHp: 180.0,      // HP
  maxPowerWatts: 134226,  // W
  idleRpm: 680,           // RPM
  maxRpm: 2700,           // RPM
  propDiameter: 1.90,     // m
  staticThrustMax: 4250,  // N (xấp xỉ lực kéo tĩnh của cánh quạt McCauley 180 HP)
  cl0: 0.28,              // Hệ số nâng tại góc tấn α = 0 (cánh NACA 2412 có độ cong camber + góc lắp cánh +1.5°)
  clAlpha: 5.15,          // Độ dốc đường cong lực nâng dCL/dα (per radian, hiệu chỉnh cánh hữu hạn)
  clMaxClean: 1.44,       // CL tối đa khi Flap = 0°
  clMaxFlaps: 1.94,       // CL tối đa khi Flap = 30°
  cd0: 0.029,             // Hệ số cản ký sinh (càng đáp cố định + thanh chống cánh)
  oswaldEfficiency: 0.78, // Hệ số hiệu suất Oswald e
  alphaStallClean: 0.279, // ~16.0° (rad)
  alphaStallFlaps: 0.253, // ~14.5° (rad)
  alphaWarnRatio: 0.84,   // Cảnh báo stall kích hoạt từ 84% góc tấn tới hạn
  flapAnglesDeg: [0, 10, 20, 30] as const,
  // Momen quán tính xấp xỉ theo phân bố khối lượng Cessna 172 (kg·m²)
  inertia: {
    ixx: 1285.0, // Roll inertia
    iyy: 1825.0, // Pitch inertia
    izz: 2667.0  // Yaw inertia
  }
};

export interface ControlInputs {
  pitchAxis?: number;
  rollAxis?: number;
  yawAxis?: number;
  pitchUp: boolean;
  pitchDown: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  throttleUp: boolean;
  throttleDown: boolean;
  brakes: boolean;
  trimUp: boolean;
  trimDown: boolean;
}

export interface TelemetryData {
  // Vận tốc
  iasKnots: number;         // Indicated Airspeed (knots)
  tasKnots: number;         // True Airspeed (knots)
  groundSpeedKnots: number; // Ground Speed (knots)
  verticalSpeedFpm: number; // Vertical Speed (feet/min)
  // Độ cao & Tư thế
  altitudeMslFeet: number;  // Độ cao so với mực nước biển (ft)
  altitudeAglFeet: number;  // Độ cao so với địa hình hoặc mặt nước (ft)
  pitchDeg: number;         // Góc chúc/ngóc mũi (độ)
  rollDeg: number;          // Góc nghiêng cánh (độ)
  headingDeg: number;       // Hướng mũi (0 - 360 độ)
  aoaDeg: number;           // Góc tấn α (độ)
  sideslipDeg: number;      // Góc trượt ngang β (độ)
  gForce: number;           // Hệ số quá tải G
  // Động cơ & Bề mặt điều khiển
  throttle: number;         // 0.0 -> 1.0
  rpm: number;              // 680 -> 2700
  flapIndex: number;        // 0, 1, 2, 3
  flapDeg: number;          // 0, 10, 20, 30 (hiện tại đã nội suy)
  elevatorTrim: number;     // -1.0 -> +1.0
  aileronNorm: number;      // -1.0 -> +1.0
  elevatorNorm: number;     // -1.0 -> +1.0
  rudderNorm: number;       // -1.0 -> +1.0
  // Trạng thái cảnh báo & Mặt đất
  isStallWarning: boolean;
  isStalling: boolean;
  onGround: boolean;
  brakesActive: boolean;
  inCloudDensity: number;   // 0.0 -> 1.0
  crashed: boolean;
  crashReason: string;
  landingMessage: string;
  landingTimer: number;
  windSpeedKnots: number;
  windDirDeg: number;
}

export interface UserSettings {
  aircraftId?: import('./aircraft-specs').AircraftId;
  showRadar?: boolean;
  renderPriority?: 'balanced' | 'quality';
  weather?: WeatherPreset;
  sharpen?: boolean;
  output4k?: boolean;
  cinematic?: boolean;
  mouseFlight?: boolean;
  flightMode: FlightMode;
  quality: QualityPresetName;
  timeOfDay: TimeOfDayPreset;
  invertPitch: boolean;
  controlSensitivity: number;
  fov: number;
  cockpitVibration: boolean;
  soundEnabled: boolean;
  showHud: boolean;
  showHelp: boolean;
  showPerf: boolean;
}
