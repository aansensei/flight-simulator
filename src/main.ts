import { nextRenderScale } from './render-budget';
/**
 * AERONAUT: Wilderness Flight
 * Module: src/main.ts
 *
 * Khởi tạo ứng dụng, quản lý trạng thái, cập nhật HUD, Menu tiếng Việt,
 * cài đặt chất lượng (Low / Medium / High / Ultra - hỗ trợ đến 4K 3840×2160)
 * và vòng lặp mô phỏng chính.
 */

import { ScenicPilot } from './scenic-pilot';
import { Scene, WebGLRenderer, MathUtils, Color } from './webgl2-three';
import {
  FlightMode, QUALITY_PRESETS, QualityPresetName, SpawnLocation, TimeOfDayPreset, UserSettings
} from './types';
import { getSurfaceHeight, RUNWAY_CONFIG, WORLD_SIZE, WildernessEnvironment } from './terrain';
import { Cessna172Model } from './aircraft-model';
import { FlightPhysicsEngine } from './physics';
import { InputController } from './controls';
import { FlightCameraController } from './camera';
import { FlightAudioEngine } from './audio';

export class AeronautWildernessApp {
  canvas: HTMLCanvasElement;
  renderer!: WebGLRenderer;
  scene!: Scene;
  environment!: WildernessEnvironment;
  aircraft!: Cessna172Model;
  physics!: FlightPhysicsEngine;
  cameraCtrl!: FlightCameraController;
  input!: InputController;
  audio!: FlightAudioEngine;

  settings: UserSettings = {
    renderPriority: 'balanced',
    weather: 'clear',
    sharpen: true,
    output4k: false,
    cinematic: true,
    mouseFlight: false,
    flightMode: 'assisted',
    quality: 'high',
    timeOfDay: 'morning',
    invertPitch: false,
    controlSensitivity: 1.0,
    fov: 60,
    cockpitVibration: true,
    soundEnabled: true,
    showHud: true,
    showHelp: false,
    showPerf: true
  };

  scenicActive = false;
  private scenicPilot = new ScenicPilot();
  isMenuOpen = true;
  isPaused = false;
  lastSpawn: SpawnLocation = 'airborne';
  private lastFrameTime = performance.now();
  private fpsFrames = 0;
  private fpsAccumTime = 0;
  currentFps = 60;
  private cpuFrameMs = 0;
  private lastHudUpdate = 0;
  private resolutionCooldown = 4;
  private startupHintTimer = 0;

  constructor() {
    this.restoreSettings();
    this.canvas = document.getElementById('flight-canvas') as HTMLCanvasElement;
    this.bootWithRealLoadingSteps();
    window.addEventListener('error', (event) => this.showRuntimeError(event.message));
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.isPaused = true;
      if (this.input) this.input.isGameActive = false;
      this.showRuntimeError('GPU đã mất kết nối. Tải lại trang và chọn chất lượng thấp hơn.');
    });
  }

  private setLoadingStatus(stepText: string): void {
    const statusEl = document.getElementById('loading-step-text');
    if (statusEl) statusEl.textContent = stepText;
  }

  private bootWithRealLoadingSteps(): void {
    this.setLoadingStatus('Đang khởi tạo WebGL 2.0 PBR Renderer & hệ thống bóng đổ...');
    requestAnimationFrame(() => {
      try {
        this.renderer = new WebGLRenderer(this.canvas);
        this.scene = new Scene();

        this.setLoadingStatus('Đang dựng hình học 3D Cessna 172 Skyhawk & bảng đồng hồ buồng lái...');
        requestAnimationFrame(() => {
          this.aircraft = new Cessna172Model();
          this.scene.add(this.aircraft.root);

          this.setLoadingStatus('Đang kiến tạo địa hình thung lũng Alps 60×60 km, hồ nước, sân bay & rừng thông...');
          requestAnimationFrame(() => {
            const q = QUALITY_PRESETS[this.settings.quality];
            this.environment = new WildernessEnvironment(this.scene, q, this.renderer.gl);
            this.physics = new FlightPhysicsEngine();
            this.cameraCtrl = new FlightCameraController(window.innerWidth / Math.max(1, window.innerHeight));
            this.audio = new FlightAudioEngine();

            this.input = new InputController(this.canvas, {
              onCycleFlaps: () => {
                this.physics.cycleFlaps();
              },
              onToggleCamera: () => {
                this.cameraCtrl.toggleMode();
                this.input.recenterLook();
                this.updateCameraBadge();
              },
              onToggleHelp: () => {
                this.settings.showHelp = !this.settings.showHelp;
                this.syncOverlays();
              },
              onToggleHud: () => {
                this.settings.showHud = !this.settings.showHud;
                this.syncOverlays();
              },
              onTogglePause: () => {
                if (this.isMenuOpen) return;
                this.isPaused = !this.isPaused;
                this.input.isGameActive = !this.isPaused;
                this.syncOverlays();
              },
              onRestartFlight: () => {
                this.startFlight(this.lastSpawn);
              },
              onToggleFullscreen: () => {
                this.toggleFullscreen();
              },
              onToggleMute: () => {
                this.settings.soundEnabled = !this.settings.soundEnabled;
                this.audio.setMuted(!this.settings.soundEnabled);
                this.syncMenuControls();
              },
              onOpenMenuOrEscape: () => {
                this.openMainMenu();
              },
              onRecenterCamera: () => {
                this.showQuickToast('Đã đưa góc nhìn camera về chính diện phía trước.');
              },
              onWindowBlur: () => {
                if (!this.isMenuOpen && !this.isPaused) {
                  this.isPaused = true;
                  this.input.isGameActive = false;
                  this.syncOverlays();
                }
              }
            });

            this.applyTimeOfDayPreset(this.settings.timeOfDay);
            this.applyQualityPreset(this.settings.quality, false);
            this.bindMenuDomEvents();
            this.syncMenuControls();

            // Đặt máy bay ở khoảnh khắc mở đầu: đang bay trên mặt hồ xanh trong thung lũng rộng
            this.physics.reset('airborne');
            this.aircraft.root.position.copy(this.physics.renderPosition);
            this.aircraft.root.quaternion.copy(this.physics.renderQuaternion);
            this.aircraft.root.useQuaternion = true;
            this.cameraCtrl.resetSnap(this.physics.renderPosition, this.physics.renderQuaternion);

            // Ẩn màn hình tải sau khi mọi tài nguyên 3D đã thực sự sẵn sàng trên GPU
            const loaderEl = document.getElementById('loading-overlay');
            if (loaderEl) loaderEl.classList.add('hidden');

            // Bắt đầu vòng lặp khung hình
            this.lastFrameTime = performance.now();
            requestAnimationFrame((t) => this.animate(t));
          });
        });
      } catch (err) {
        const statusEl = document.getElementById('loading-step-text');
        if (statusEl) {
          statusEl.textContent = `Lỗi khởi tạo đồ họa 3D: ${(err as Error).message}`;
        }
      }
    });
  }

  private bindMenuDomEvents(): void {
    window.addEventListener('resize', () => {
      this.updateViewportSize();
    });

    const btnStartAirborne = document.getElementById('btn-start-airborne');
    btnStartAirborne?.addEventListener('click', () => this.startFlight('airborne'));

    document.getElementById('btn-start-scenic')?.addEventListener('click', () => this.startScenicFlight());
    document.getElementById('btn-crash-menu')?.addEventListener('click', () => this.openMainMenu());
    document.getElementById('btn-scenic-menu')?.addEventListener('click', () => this.openMainMenu());
    document.getElementById('btn-scenic-photo')?.addEventListener('click', () => this.takePhoto());
    document.getElementById('btn-quality-max')?.addEventListener('click', () => {
      this.settings.renderPriority = 'quality';
      this.renderer.dynamicScale = 1;
      (document.getElementById('select-render-priority') as HTMLSelectElement).value = 'quality';
      this.settings.output4k = true; this.settings.cinematic = true; this.settings.sharpen = true;
      this.renderer.cinematic = true; this.renderer.sharpen = true; this.renderer.reflectionLimit = 1280;
      this.applyQualityPreset('ultra', true); this.syncMenuControls();
      (document.getElementById('select-resolution') as HTMLSelectElement).value = '4k';
      this.saveSettings();
    });
    const priority = document.getElementById('select-render-priority') as HTMLSelectElement;
    priority.value = this.settings.renderPriority || 'balanced';
    priority.addEventListener('change', () => {
      this.settings.renderPriority = priority.value as UserSettings['renderPriority'];
      this.renderer.dynamicScale = 1; this.resolutionCooldown = 4;
      this.renderer.reflectionLimit = priority.value === 'quality' ? 1280 : 768;
      this.updateViewportSize();
    });
    this.renderer.reflectionLimit = priority.value === 'quality' ? 1280 : 768;
    const weather = document.getElementById('select-weather') as HTMLSelectElement;
    weather.value = this.settings.weather || 'clear';
    weather.addEventListener('change', () => { this.settings.weather = weather.value as UserSettings['weather']; this.applyTimeOfDayPreset(this.settings.timeOfDay); });
    const sharpen = document.getElementById('chk-sharpen') as HTMLInputElement;
    sharpen.checked = this.settings.sharpen ?? true;
    this.renderer.sharpen = sharpen.checked;
    sharpen.addEventListener('change', () => { this.settings.sharpen = sharpen.checked; this.renderer.sharpen = sharpen.checked; });
    document.getElementById('btn-start-approach')?.addEventListener('click', () => this.startFlight('approach'));
    const resolution = document.getElementById('select-resolution') as HTMLSelectElement;
    resolution.value = this.settings.output4k ? '4k' : 'native';
    resolution.addEventListener('change', () => { this.settings.output4k = resolution.value === '4k'; this.updateViewportSize(); });
    const cinematic = document.getElementById('chk-cinematic') as HTMLInputElement;
    cinematic.checked = this.settings.cinematic ?? true;
    cinematic.addEventListener('change', () => { this.settings.cinematic = cinematic.checked; this.renderer.cinematic = cinematic.checked; });
    this.renderer.cinematic = cinematic.checked;
    const mouse = document.getElementById('chk-mouse-flight') as HTMLInputElement;
    mouse.checked = this.settings.mouseFlight ?? false;
    mouse.addEventListener('change', () => { this.settings.mouseFlight = mouse.checked; this.input.mouseFlight = mouse.checked; this.input.clearAllKeys(); });
    this.input.mouseFlight = mouse.checked;
    const wind = document.getElementById('select-wind') as HTMLSelectElement;
    wind.addEventListener('change', () => {
      this.physics.baseWindVel.set(wind.value === 'calm' ? 0 : 1.8, 0, wind.value === 'calm' ? 0 : 1.2);
      this.physics.gustStrength = wind.value === 'calm' ? 0 : 1;
    });
    document.getElementById('main-menu-overlay')?.addEventListener('change', () => this.saveSettings());
    const btnStartRunway = document.getElementById('btn-start-runway');
    btnStartRunway?.addEventListener('click', () => this.startFlight('runway'));

    const btnResume = document.getElementById('btn-resume-flight');
    btnResume?.addEventListener('click', () => this.resumeFlight());

    const btnCrashRestartAir = document.getElementById('btn-crash-restart-air');
    btnCrashRestartAir?.addEventListener('click', () => this.startFlight('airborne'));

    const btnCrashRestartRwy = document.getElementById('btn-crash-restart-rwy');
    btnCrashRestartRwy?.addEventListener('click', () => this.startFlight('runway'));

    const btnToggleCamHud = document.getElementById('btn-hud-camera');
    btnToggleCamHud?.addEventListener('click', () => {
      this.cameraCtrl.toggleMode();
      this.input.recenterLook();
      this.updateCameraBadge();
    });

    const btnRecenterHud = document.getElementById('btn-hud-recenter');
    btnRecenterHud?.addEventListener('click', () => {
      this.input.recenterLook();
      this.showQuickToast('Đã đưa góc nhìn camera về chính diện phía trước.');
    });

    const btnHelpHud = document.getElementById('btn-hud-help');
    btnHelpHud?.addEventListener('click', () => {
      this.settings.showHelp = !this.settings.showHelp;
      this.syncOverlays();
    });

    const btnMenuHud = document.getElementById('btn-hud-menu');
    btnMenuHud?.addEventListener('click', () => {
      this.openMainMenu();
    });

    // Cài đặt Chế độ điều khiển (Assisted vs Simulation)
    const selMode = document.getElementById('select-flight-mode') as HTMLSelectElement | null;
    selMode?.addEventListener('change', () => {
      this.settings.flightMode = selMode.value as FlightMode;
      this.updateHudElements();
    });

    // Cài đặt Chất lượng đồ họa (Low / Medium / High / Ultra)
    const selQuality = document.getElementById('select-quality') as HTMLSelectElement | null;
    selQuality?.addEventListener('change', () => {
      this.applyQualityPreset(selQuality.value as QualityPresetName, true);
    });

    // Cài đặt Thời gian & Ánh sáng (Buổi sáng / Hoàng hôn)
    const selTime = document.getElementById('select-time') as HTMLSelectElement | null;
    selTime?.addEventListener('change', () => {
      this.settings.timeOfDay = selTime.value as TimeOfDayPreset;
      this.applyTimeOfDayPreset(this.settings.timeOfDay);
    });

    // Độ nhạy điều khiển
    const rngSens = document.getElementById('range-sensitivity') as HTMLInputElement | null;
    rngSens?.addEventListener('input', () => {
      this.settings.controlSensitivity = parseFloat(rngSens.value);
      const lbl = document.getElementById('val-sensitivity');
      if (lbl) lbl.textContent = `${Math.round(this.settings.controlSensitivity * 100)}%`;
    });

    // Góc nhìn FOV
    const rngFov = document.getElementById('range-fov') as HTMLInputElement | null;
    rngFov?.addEventListener('input', () => {
      this.settings.fov = parseFloat(rngFov.value);
      const lbl = document.getElementById('val-fov');
      if (lbl) lbl.textContent = `${this.settings.fov}°`;
      this.cameraCtrl.camera.fov = this.settings.fov;
      this.cameraCtrl.camera.updateProjectionMatrix();
    });

    // Tùy chọn Đảo trục Pitch
    const chkInvert = document.getElementById('chk-invert-pitch') as HTMLInputElement | null;
    chkInvert?.addEventListener('change', () => {
      this.settings.invertPitch = chkInvert.checked;
    });

    // Tùy chọn Rung động cơ trong buồng lái
    const chkVib = document.getElementById('chk-cockpit-vib') as HTMLInputElement | null;
    chkVib?.addEventListener('change', () => {
      this.settings.cockpitVibration = chkVib.checked;
    });

    // Tùy chọn Âm thanh
    const chkSound = document.getElementById('chk-sound') as HTMLInputElement | null;
    chkSound?.addEventListener('change', () => {
      this.settings.soundEnabled = chkSound.checked;
      this.audio.setMuted(!this.settings.soundEnabled);
    });

    // Tùy chọn Bảng thông tin hiệu năng (FPS & Renderer)
    const chkPerf = document.getElementById('chk-show-perf') as HTMLInputElement | null;
    chkPerf?.addEventListener('change', () => {
      this.settings.showPerf = chkPerf.checked;
      this.syncOverlays();
    });

    // Nút mở bảng hướng dẫn phím từ Menu chính
    const btnMenuHelp = document.getElementById('btn-menu-help');
    btnMenuHelp?.addEventListener('click', () => {
      this.settings.showHelp = !this.settings.showHelp;
      this.syncOverlays();
    });

    const btnCloseHelp = document.getElementById('btn-close-help');
    btnCloseHelp?.addEventListener('click', () => {
      this.settings.showHelp = false;
      this.syncOverlays();
    });
  }

  private syncMenuControls(): void {
    const selMode = document.getElementById('select-flight-mode') as HTMLSelectElement | null;
    if (selMode) selMode.value = this.settings.flightMode;

    const selQuality = document.getElementById('select-quality') as HTMLSelectElement | null;
    if (selQuality) selQuality.value = this.settings.quality;

    const selTime = document.getElementById('select-time') as HTMLSelectElement | null;
    if (selTime) selTime.value = this.settings.timeOfDay;

    const chkInvert = document.getElementById('chk-invert-pitch') as HTMLInputElement | null;
    if (chkInvert) chkInvert.checked = this.settings.invertPitch;

    const chkVib = document.getElementById('chk-cockpit-vib') as HTMLInputElement | null;
    if (chkVib) chkVib.checked = this.settings.cockpitVibration;

    const chkSound = document.getElementById('chk-sound') as HTMLInputElement | null;
    if (chkSound) chkSound.checked = this.settings.soundEnabled;

    const chkPerf = document.getElementById('chk-show-perf') as HTMLInputElement | null;
    if (chkPerf) chkPerf.checked = this.settings.showPerf;
  }

  applyQualityPreset(presetName: QualityPresetName, rebuildGeo: boolean): void {
    this.settings.quality = presetName;
    const q = QUALITY_PRESETS[presetName];
    this.renderer.setShadowMapSize(q.shadowMapSize);
    this.renderer.waterWaveLayers = q.waterWaveLayers;
    this.renderer.enablePostGrading = q.enablePostGrading;
    this.updateViewportSize();

    if (rebuildGeo && this.environment) {
      this.environment.rebuildScalableAssets(q);
    }

    const scaleInfoEl = document.getElementById('quality-scale-info');
    if (scaleInfoEl) {
      scaleInfoEl.textContent = `Render Scale: ${Math.round(q.renderScale * 100)}% | Bóng đổ: ${q.shadowMapSize}px | Cây: ${q.treeCount.toLocaleString()}`;
    }
  }

  applyTimeOfDayPreset(preset: TimeOfDayPreset): void {
    const lighting = {
      dawn: { sun: [0.62, 0.075, -0.78], color: 0xffb070, zenith: 0x284b80, horizon: 0xf1b39e, ground: 0x344039, fog: 0xdcbbaa, density: 0.000085 },
      morning: { sun: [0.62, 0.42, -0.66], color: 0xfff3dc, zenith: 0x2866be, horizon: 0xc2def4, ground: 0x3a4d3b, fog: 0xc2def4, density: 0.000062 },
      noon: { sun: [0.2, 0.88, -0.4], color: 0xfff9ef, zenith: 0x155caa, horizon: 0xb9d4ec, ground: 0x354b34, fog: 0xc4dced, density: 0.000048 },
      sunset: { sun: [-0.5, 0.11, -0.85], color: 0xffa05b, zenith: 0x273c74, horizon: 0xe99473, ground: 0x3a3038, fog: 0xce9785, density: 0.000075 },
      dusk: { sun: [-0.6, -0.04, -0.8], color: 0x4b426e, zenith: 0x111c3b, horizon: 0x886478, ground: 0x151d2b, fog: 0x52627c, density: 0.00008 }
    }[preset];
    const r = this.renderer;
    r.sunDirection.set(lighting.sun[0], lighting.sun[1], lighting.sun[2]).normalize();
    r.sunColor.setHex(lighting.color);
    r.skyZenithColor.setHex(lighting.zenith); r.skyHorizonColor.setHex(lighting.horizon);
    r.groundAmbientColor.setHex(lighting.ground); r.fogColor.setHex(lighting.fog);
    r.fogDensity = lighting.density;
    const weather = this.settings.weather || 'clear';
    r.rain = weather === 'rain' ? 1 : 0;
    r.cloudCover = { clear: 0.34, haze: 0.4, overcast: 0.88, rain: 1 }[weather];
    if (weather === 'haze') r.fogDensity *= 2.1;
    if (weather === 'overcast' || weather === 'rain') {
      const rainy = weather === 'rain';
      r.skyZenithColor.lerp(new Color(rainy ? 0x344453 : 0x738292), 0.82);
      r.skyHorizonColor.lerp(new Color(rainy ? 0x89969d : 0xa4afb7), 0.86);
      r.fogColor.copy(r.skyHorizonColor);
      const power = rainy ? 0.24 : 0.48;
      r.sunColor.setRGB(r.sunColor.r * power, r.sunColor.g * power, r.sunColor.b * power);
      r.fogDensity *= rainy ? 3.4 : 1.6;
    }
    this.environment.cloudCoverage = r.cloudCover;
    this.scene.background.copy(r.skyHorizonColor);
  }

  private startScenicFlight(): void {
    this.settings.flightMode = 'assisted';
    this.startFlight('airborne');
    this.physics.position.set(-220, 460, 1200);
    this.physics.prevPosition.copy(this.physics.position);
    this.physics.renderPosition.copy(this.physics.position);
    this.scenicPilot.reset();
    this.scenicActive = true;
    this.settings.showHud = false; this.settings.showPerf = false;
    this.settings.showHelp = false;
    this.cameraCtrl.mode = 'chase';
    this.input.chaseDistance = 7.5;
    this.cameraCtrl.resetSnap(this.physics.position, this.physics.quaternion);
    this.startupHintTimer = 0;
    this.syncOverlays();
  }

  private takePhoto(): void {
    const scale = this.renderer.dynamicScale;
    this.renderer.dynamicScale = 1;
    this.updateViewportSize();
    this.renderer.render(this.scene, this.cameraCtrl.camera, this.physics.renderPosition);
    const photoWidth = this.canvas.width, photoHeight = this.canvas.height;
    this.canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aeronaut-${this.settings.timeOfDay}-${this.settings.weather}-${photoWidth}x${photoHeight}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 'image/png');
    this.renderer.dynamicScale = scale;
    this.updateViewportSize();
  }

  private updateViewportSize(): void {
    if (!this.renderer) return;
    const q = QUALITY_PRESETS[this.settings.quality];
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.renderer.setSize(w, h, q.renderScale, this.settings.output4k ? 4 : q.maxPixelRatio);
    if (this.cameraCtrl) {
      this.cameraCtrl.camera.aspect = w / h;
      this.cameraCtrl.camera.updateProjectionMatrix();
    }
  }

  startFlight(spawn: SpawnLocation): void {
    this.scenicActive = false;
    this.settings.showHud = true;
    this.lastSpawn = spawn;
    this.audio.initOnUserGesture();
    this.audio.setMuted(!this.settings.soundEnabled);

    this.physics.reset(spawn);
    this.lastFrameTime = performance.now();
    this.aircraft.root.position.copy(this.physics.renderPosition);
    this.aircraft.root.quaternion.copy(this.physics.renderQuaternion);
    this.input.clearAllKeys();
    this.input.recenterLook();
    this.cameraCtrl.resetSnap(this.physics.renderPosition, this.physics.renderQuaternion);

    this.isMenuOpen = false;
    this.isPaused = false;
    this.input.isGameActive = true;
    this.startupHintTimer = 7.5; // Hiện hướng dẫn gọn trong 7.5 giây đầu khi bắt đầu bay

    const btnResume = document.getElementById('btn-resume-flight');
    if (btnResume) btnResume.classList.remove('hidden');

    this.syncOverlays();
    this.updateCameraBadge();
    this.canvas.focus();
  }

  resumeFlight(): void {
    this.audio.initOnUserGesture();
    this.isMenuOpen = false;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.input.clearAllKeys();
    this.input.isGameActive = true;
    this.syncOverlays();
    this.canvas.focus();
  }

  openMainMenu(): void {
    this.isMenuOpen = true;
    this.isPaused = true;
    this.input.isGameActive = false;
    this.input.clearAllKeys();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.syncOverlays();
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  private updateCameraBadge(): void {
    const camEl = document.getElementById('hud-camera-mode');
    if (camEl) {
      camEl.textContent = this.cameraCtrl.mode === 'chase' ? 'Góc nhìn: Sau máy bay (C)' : 'Góc nhìn: Buồng lái (C)';
    }
  }

  private showQuickToast(msg: string): void {
    const toastEl = document.getElementById('quick-toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2600);
  }

  private syncOverlays(): void {
    const menuEl = document.getElementById('main-menu-overlay');
    const hudEl = document.getElementById('hud-overlay');
    const helpEl = document.getElementById('help-modal');
    const pauseBanner = document.getElementById('pause-banner');
    const crashModal = document.getElementById('crash-modal');
    const perfPanel = document.getElementById('perf-panel');

    if (menuEl) menuEl.classList.toggle('hidden', !this.isMenuOpen);
    if (hudEl) hudEl.classList.toggle('hidden', this.isMenuOpen || !this.settings.showHud);
    if (helpEl) helpEl.classList.toggle('hidden', !this.settings.showHelp);
    if (pauseBanner) pauseBanner.classList.toggle('hidden', this.isMenuOpen || !this.isPaused || this.physics.telemetry.crashed);
    if (crashModal) crashModal.classList.toggle('hidden', !this.physics.telemetry.crashed || this.isMenuOpen);
    if (perfPanel) perfPanel.classList.toggle('hidden', !this.settings.showPerf);
  }

  private updateHudElements(): void {
    const t = this.physics.telemetry;

    const setTxt = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const gpuMs = this.renderer.gpuTimer.milliseconds;
    const gpuStats = document.getElementById('perf-timing');
    if (gpuStats) gpuStats.textContent = `CPU ${this.cpuFrameMs.toFixed(1)} ms · GPU ${gpuMs ? gpuMs.toFixed(1) + ' ms' : 'n/a'} · Cây gần ${this.environment.treeLod.near.toLocaleString()} / xa ${this.environment.treeLod.far.toLocaleString()}`;
    setTxt('hud-ias', `${Math.round(t.iasKnots)}`);
    setTxt('hud-tas-gs', `TAS ${Math.round(t.tasKnots)} | GS ${Math.round(t.groundSpeedKnots)} kt`);
    setTxt('hud-msl', `${Math.round(t.altitudeMslFeet).toLocaleString()}`);
    setTxt('hud-agl', `${Math.round(t.altitudeAglFeet).toLocaleString()} ft`);
    setTxt('hud-vsi', `${t.verticalSpeedFpm >= 0 ? '+' : ''}${Math.round(t.verticalSpeedFpm / 10) * 10}`);
    setTxt('hud-hdg', `${Math.round(t.headingDeg).toString().padStart(3, '0')}°`);
    setTxt('hud-pitch-roll', `Pitch ${t.pitchDeg >= 0 ? '+' : ''}${t.pitchDeg.toFixed(1)}° | Roll ${t.rollDeg >= 0 ? '+' : ''}${t.rollDeg.toFixed(1)}°`);
    setTxt('hud-thr', `${Math.round(t.throttle * 100)}%`);
    setTxt('hud-rpm', `${Math.round(t.rpm)}`);
    setTxt('hud-flaps', `${Math.round(t.flapDeg)}°`);
    setTxt('hud-trim', `${t.elevatorTrim >= 0 ? '+' : ''}${(t.elevatorTrim * 100).toFixed(0)}%`);
    setTxt('hud-aoa-g', `AoA ${t.aoaDeg.toFixed(1)}° | ${t.gForce.toFixed(1)}G`);
    setTxt('hud-mode', this.settings.flightMode === 'assisted' ? 'Hỗ trợ ổn định (Assisted)' : 'Mô phỏng (Simulation)');

    const thrFill = document.getElementById('hud-thr-bar');
    if (thrFill) thrFill.style.width = `${Math.round(t.throttle * 100)}%`;

    const stallBanner = document.getElementById('stall-warning-banner');
    if (stallBanner) {
      stallBanner.classList.toggle('hidden', !t.isStallWarning);
    }

    const brakeBadge = document.getElementById('hud-brake-badge');
    if (brakeBadge) {
      brakeBadge.classList.toggle('hidden', !t.brakesActive);
    }

    const landingBanner = document.getElementById('landing-banner');
    if (landingBanner) {
      if (t.landingMessage) {
        landingBanner.textContent = t.landingMessage;
        landingBanner.classList.remove('hidden');
      } else {
        landingBanner.classList.add('hidden');
      }
    }

    if (t.crashed) {
      this.input.isGameActive = false;
      setTxt('crash-reason-text', t.crashReason);
      this.syncOverlays();
    }
  }

  private updatePerformanceOverlay(dt: number): void {
    this.fpsFrames++;
    this.fpsAccumTime += dt;
    if (this.fpsAccumTime >= 0.4) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccumTime);
      this.fpsFrames = 0;
      this.fpsAccumTime = 0;

      if (this.settings.showPerf) {
        const elFps = document.getElementById('perf-fps');
        const elRes = document.getElementById('perf-res');
        const elOut = document.getElementById('perf-out');
        const elGpu = document.getElementById('perf-gpu');
        if (elFps) elFps.textContent = `${this.currentFps} FPS`;
        if (elRes) elRes.textContent = `${this.renderer.renderWidth} × ${this.renderer.renderHeight}`;
        if (elOut) elOut.textContent = `${this.renderer.outputWidth} × ${this.renderer.outputHeight}`;
        if (elGpu) elGpu.textContent = this.renderer.backendName;
      }
    }
  }

  private updateLandingGuide(): void {
    const hidden = this.isMenuOpen || !this.settings.showHud;
    document.getElementById('landing-guide')?.classList.toggle('hidden', hidden);
    document.getElementById('mouse-flight-reticle')?.classList.toggle('hidden', hidden || !this.settings.mouseFlight);
    if (hidden) return;
    const p = this.physics.position;
    const t = this.physics.telemetry;
    const distance = p.z - RUNWAY_CONFIG.length / 2;
    const lateral = p.x - RUNWAY_CONFIG.centerX;
    const desiredY = RUNWAY_CONFIG.elevation + Math.max(0, distance) * Math.tan(MathUtils.degToRad(3)) + 1.5;
    const heightError = p.y - desiredY;
    const instruction = document.getElementById('landing-instruction')!;
    const path = document.getElementById('landing-path')!;
    if (t.onGround) {
      instruction.textContent = 'Giảm ga bằng Ctrl. Giữ B để phanh. Q/E căn giữa đường băng. Cất cánh: Shift tăng ga, khoảng 55 kt kéo S nhẹ.';
      path.textContent = `Tốc độ ${Math.round(t.iasKnots)} kt · Ga ${Math.round(t.throttle * 100)}%`;
    } else if (distance > 0 && distance < 3800 && Math.abs(lateral) < 600 && (t.headingDeg < 45 || t.headingDeg > 315)) {
      instruction.textContent = t.altitudeAglFeet < 30 && distance < 220
        ? 'Kéo S rất nhẹ để nâng mũi, giảm ga về 0%. Sau khi bánh chạm đường băng, giữ B.'
        : 'Giữ khoảng 65 kt, flap 20°. Ctrl giảm ga để hạ thấp, S kéo mũi nhẹ. A/D căn trục đường băng. Nếu mất ổn định: tăng ga và bay vòng lại.';
      path.textContent = `Ngưỡng đường băng ${(distance / 1000).toFixed(2)} km · ${Math.abs(lateral) < 8 ? 'Đúng trục' : `Lệch ${lateral > 0 ? 'phải' : 'trái'} ${Math.round(Math.abs(lateral))} m`} · ${Math.abs(heightError) < 8 ? 'Đúng dốc 3°' : `${heightError > 0 ? 'Cao' : 'Thấp'} ${Math.round(Math.abs(heightError))} m`}`;
    } else {
      instruction.textContent = 'Để tập đáp dễ hơn: Esc → Luyện hạ cánh. Hoặc bay về phía nam đường băng, cách 2 đến 3 km, rồi quay hướng 000°.';
      path.textContent = `Sân bay cách ${(Math.hypot(lateral, p.z) / 1000).toFixed(1)} km`;
    }
    const warnings: string[] = [];
    if (t.isStallWarning) warnings.push('STALL: hạ mũi và tăng ga');
    if (t.iasKnots > 163) warnings.push('Quá tốc độ: giảm ga');
    if (t.flapDeg > 10 && t.iasKnots > 85) warnings.push('Thu flap khi vượt 85 kt');
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) > WORLD_SIZE * 0.46) warnings.push('Gần rìa bản đồ: quay về thung lũng');
    document.getElementById('flight-envelope')!.textContent = warnings.join(' · ');
  }

  private saveSettings(): void {
    try { localStorage.setItem('aeronaut.settings.v2', JSON.stringify(this.settings)); } catch { /* Storage may be disabled by the browser. */ }
  }

  private restoreSettings(): void {
    try {
      const saved = JSON.parse(localStorage.getItem('aeronaut.settings.v2') || '{}');
      for (const key of ['sharpen', 'output4k', 'cinematic', 'mouseFlight', 'invertPitch', 'cockpitVibration', 'soundEnabled', 'showPerf'] as const) {
        if (typeof saved[key] === 'boolean') this.settings[key] = saved[key];
      }
      if (['balanced', 'quality'].includes(saved.renderPriority)) this.settings.renderPriority = saved.renderPriority;
      if (['clear', 'haze', 'overcast', 'rain'].includes(saved.weather)) this.settings.weather = saved.weather;
      if (Object.hasOwn(QUALITY_PRESETS, saved.quality)) this.settings.quality = saved.quality;
      if (['assisted', 'simulation'].includes(saved.flightMode)) this.settings.flightMode = saved.flightMode;
      if (['dawn', 'morning', 'noon', 'sunset', 'dusk'].includes(saved.timeOfDay)) this.settings.timeOfDay = saved.timeOfDay;
    } catch { /* Invalid saved settings use the defaults. */ }
  }

  private showRuntimeError(message: string): void {
    const loader = document.getElementById('loading-overlay');
    loader?.classList.remove('hidden');
    this.setLoadingStatus('Không thể tiếp tục: ' + message);
  }

  public rafPaused = false;
  public stepSingleFrame(now: number = performance.now()): void { this.animateFrame(now); }
  private animate(now: number): void {
    const start = performance.now();
    this.animateFrame(now);
    this.cpuFrameMs = this.cpuFrameMs * 0.85 + (performance.now() - start) * 0.15;
    if (!this.rafPaused) requestAnimationFrame(t => this.animate(t));
  }
  private animateFrame(now: number): void {

    const rawDt = (now - this.lastFrameTime) / 1000.0;
    this.lastFrameTime = now;
    const dt = MathUtils.clamp(rawDt, 0.001, 0.1);

    this.updatePerformanceOverlay(rawDt);

    // Ẩn thanh gợi ý khởi đầu sau vài giây
    if (this.startupHintTimer > 0 && !this.isMenuOpen && !this.isPaused) {
      this.startupHintTimer = Math.max(0, this.startupHintTimer - dt);
      const hintBar = document.getElementById('startup-hint-bar');
      if (hintBar) {
        hintBar.classList.toggle('hidden', this.startupHintTimer <= 0);
      }
    }

    const activeSim = !this.isMenuOpen && !this.isPaused && !this.physics.telemetry.crashed;

    if (activeSim) {
      this.renderer.elapsedTime += dt;
      const inputs = this.scenicActive ? this.scenicPilot.controls(this.physics) : this.input.getControlInputs();
      const cloudDensity = this.environment.getCloudDensityAt(this.physics.position);
      this.physics.update(dt, inputs, this.settings, cloudDensity);
      this.renderer.cloudImmersion = MathUtils.lerp(this.renderer.cloudImmersion, cloudDensity, 5.0 * dt);
    } else if (this.isMenuOpen && document.getElementById('btn-resume-flight')?.classList.contains('hidden')) {
      // Khi đang ở Menu chính mở đầu: máy bay bay lượn nhẹ trên mặt hồ xanh dưới ánh nắng sớm
      this.renderer.elapsedTime += dt * 0.55;
      const previewTime = this.renderer.elapsedTime;
      this.physics.renderPosition.set(
        -180 + Math.sin(previewTime * 0.18) * 18,
        215 + Math.cos(previewTime * 0.35) * 2.5,
        760 - (previewTime * 14) % 900
      );
    }

    // Đồng bộ vị trí & góc xoay của mô hình máy bay 3D
    this.aircraft.root.visible = !this.scenicActive;
    this.aircraft.root.position.copy(this.physics.renderPosition);
    this.aircraft.root.quaternion.copy(this.physics.renderQuaternion);

    const q = QUALITY_PRESETS[this.settings.quality];
    this.aircraft.updateFromTelemetry(
      this.physics.telemetry,
      activeSim ? dt : 0,
      this.renderer.elapsedTime,
      q.enableParticles
    );

    this.environment.update(
      this.renderer.elapsedTime,
      MathUtils.degToRad(this.physics.telemetry.windDirDeg),
      this.physics.telemetry.windSpeedKnots / 1.943844,
      this.physics.renderPosition
    );

    this.cameraCtrl.update(
      dt,
      this.physics.renderPosition,
      this.physics.renderQuaternion,
      this.physics.velocity,
      this.input.mouseYawOffset,
      this.input.mousePitchOffset,
      this.input.chaseDistance,
      this.settings,
      this.physics.telemetry
    );

    this.audio.update(this.physics.telemetry, this.cameraCtrl.mode, !activeSim, this.renderer.rain);

    if (!this.isMenuOpen && now - this.lastHudUpdate >= 100) {
      this.lastHudUpdate = now;
      this.updateHudElements();
      this.updateLandingGuide();
    }
    document.getElementById('scenic-toolbar')?.classList.toggle('hidden', !this.scenicActive || this.isMenuOpen);
    if (activeSim && this.settings.renderPriority !== 'quality') {
      this.resolutionCooldown -= dt;
      if (this.resolutionCooldown <= 0) {
        this.resolutionCooldown = 1.5;
        const gpu = this.renderer.gpuTimer.milliseconds;
        const measuredMs = Math.max(gpu, 1000 / Math.max(1, this.currentFps));
        const scale = nextRenderScale(this.renderer.dynamicScale, measuredMs);
        if (scale !== this.renderer.dynamicScale) {
          this.renderer.dynamicScale = scale;
          this.updateViewportSize();
        }
      }
    }

    this.renderer.render(this.scene, this.cameraCtrl.camera, this.physics.renderPosition);
  }
}

// Khởi chạy ứng dụng khi DOM sẵn sàng
window.addEventListener('DOMContentLoaded', () => {
  (window as unknown as { aeronautApp: AeronautWildernessApp }).aeronautApp = new AeronautWildernessApp();
});

// Hỗ trợ khởi chạy ngay cả khi trang được nạp động sau sự kiện DOMContentLoaded
if (document.readyState !== 'loading' && !(window as unknown as { aeronautApp?: AeronautWildernessApp }).aeronautApp) {
  (window as unknown as { aeronautApp: AeronautWildernessApp }).aeronautApp = new AeronautWildernessApp();
}
