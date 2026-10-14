/**
 * AERONAUT: Wilderness Flight
 * Module: src/audio.ts
 *
 * Hệ thống Âm thanh Tổng hợp Thời gian thực bằng Web Audio API:
 * - Chỉ khởi tạo và phát âm thanh sau thao tác người dùng (tuân thủ chính sách Autoplay của trình duyệt).
 * - Ghi chú minh bạch: Toàn bộ âm thanh được tổng hợp trực tiếp bằng Web Audio API (không dùng file MP3/WAV ngoài):
 *   1. Tiếng động cơ piston 4 xi-lanh Lycoming IO-360 thay đổi theo RPM và tải (Throttle).
 *   2. Lớp tiếng cánh quạt 2 lá chém gió (Blade-pass modulation).
 *   3. Tiếng gió khí động học tăng theo tốc độ tương đối với không khí (IAS).
 *   4. Khác biệt âm học giữa Camera Buồng lái (lọc thông thấp ấm và giảm âm lượng ngoài) và Camera Đuổi.
 *   5. Âm thanh bánh xe tiếp đất, tiếng lăn trên đường băng, tiếng phanh và còi cảnh báo thất tốc (Stall Horn).
 */

import { CameraMode, TelemetryData } from './types';
import { MathUtils } from './webgl2-three';

export class FlightAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private cockpitFilter: BiquadFilterNode | null = null;

  // Engine & Propeller nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private propModOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private propModGain: GainNode | null = null;

  // Airflow wind & Ground rumble noise nodes
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private groundGain: GainNode | null = null;

  // Stall Warning Horn
  private stallOsc: OscillatorNode | null = null;
  private stallGain: GainNode | null = null;

  private isInitialized = false;
  private isMuted = false;
  private wasOnGround = false;

  initOnUserGesture(): void {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0.0 : 0.45;

      // Bộ lọc mô phỏng cách âm buồng lái (Cockpit Acoustic Low-pass Filter)
      this.cockpitFilter = ctx.createBiquadFilter();
      this.cockpitFilter.type = 'lowpass';
      this.cockpitFilter.frequency.value = 3800;

      this.cockpitFilter.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      // 1. Động cơ Piston 4 kỳ + Cánh quạt 2 lá
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0.0;

      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;

      this.engineOsc1 = ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 45;

      this.engineOsc2 = ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 90;

      // Điều biến biên độ theo tần số cánh quạt 2 lá chém gió
      this.propModOsc = ctx.createOscillator();
      this.propModOsc.type = 'sine';
      this.propModOsc.frequency.value = 70;

      this.propModGain = ctx.createGain();
      this.propModGain.gain.value = 0.08;

      this.propModOsc.connect(this.propModGain);
      this.propModGain.connect(this.engineGain.gain);

      this.engineOsc1.connect(engineFilter);
      this.engineOsc2.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.cockpitFilter);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.propModOsc.start();

      // 2. Buffer nhiễu trắng (White Noise) dùng cho tiếng gió khí động học và tiếng bánh xe lăn
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;

      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 520;
      this.windFilter.Q.value = 0.9;

      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0.0;

      windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.cockpitFilter);
      windSource.start();

      // Tiếng lăn đường băng & phanh
      const groundSource = ctx.createBufferSource();
      groundSource.buffer = noiseBuffer;
      groundSource.loop = true;

      const groundFilter = ctx.createBiquadFilter();
      groundFilter.type = 'lowpass';
      groundFilter.frequency.value = 165;

      this.groundGain = ctx.createGain();
      this.groundGain.gain.value = 0.0;

      groundSource.connect(groundFilter);
      groundFilter.connect(this.groundGain);
      this.groundGain.connect(this.cockpitFilter);
      groundSource.start();

      // 3. Còi cảnh báo thất tốc (Stall Warning Horn ~ 880 Hz)
      this.stallOsc = ctx.createOscillator();
      this.stallOsc.type = 'square';
      this.stallOsc.frequency.value = 880;
      this.stallGain = ctx.createGain();
      this.stallGain.gain.value = 0.0;

      const stallFilter = ctx.createBiquadFilter();
      stallFilter.type = 'bandpass';
      stallFilter.frequency.value = 880;
      stallFilter.Q.value = 4.0;

      this.stallOsc.connect(stallFilter);
      stallFilter.connect(this.stallGain);
      this.stallGain.connect(this.masterGain); // Còi báo phát trực tiếp trong cabin
      this.stallOsc.start();

      this.isInitialized = true;
    } catch {
      // Nếu trình duyệt chặn hoặc không có thiết bị âm thanh, bỏ qua an toàn
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0.0 : 0.45, this.ctx.currentTime, 0.05);
    }
  }

  update(telemetry: TelemetryData, cameraMode: CameraMode, isPaused: boolean, rain = 0): void {
    if (!this.isInitialized || !this.ctx) return;

    const now = this.ctx.currentTime;
    if (isPaused || telemetry.crashed || this.isMuted) {
      this.engineGain?.gain.setTargetAtTime(0.0, now, 0.06);
      this.windGain?.gain.setTargetAtTime(0.0, now, 0.06);
      this.groundGain?.gain.setTargetAtTime(0.0, now, 0.06);
      this.stallGain?.gain.setTargetAtTime(0.0, now, 0.04);
      return;
    }

    // 1. Lọc tần số và âm lượng khác nhau giữa trong Cockpit và Camera ngoài
    const targetCutoff = cameraMode === 'cockpit' ? 760 : 4200;
    const cabinAtten = cameraMode === 'cockpit' ? 0.68 : 1.0;
    this.cockpitFilter?.frequency.setTargetAtTime(targetCutoff, now, 0.08);

    // 2. Tần số nổ động cơ Lycoming 4 xi-lanh theo RPM & tải Throttle
    const firingFreq = Math.max(20, (telemetry.rpm / 60.0) * 2.0);
    const bladePassFreq = Math.max(20, (telemetry.rpm / 60.0) * 2.0);
    this.engineOsc1?.frequency.setTargetAtTime(firingFreq * 0.5, now, 0.05);
    this.engineOsc2?.frequency.setTargetAtTime(firingFreq, now, 0.05);
    this.propModOsc?.frequency.setTargetAtTime(bladePassFreq, now, 0.05);

    const engineVol = (0.09 + telemetry.throttle * 0.16 + (telemetry.rpm / 2700) * 0.08) * cabinAtten;
    this.engineGain?.gain.setTargetAtTime(engineVol, now, 0.06);

    // 3. Tiếng gió rít tăng theo tốc độ tương đối với không khí (IAS)
    const speedRatio = MathUtils.clamp(telemetry.iasKnots / 135.0, 0, 1.4);
    const windVol = Math.pow(speedRatio, 1.7) * 0.24 * cabinAtten;
    const windFreq = 320 + speedRatio * 780;
    this.windGain?.gain.setTargetAtTime(windVol + rain * 0.11, now, 0.08);
    this.windFilter?.frequency.setTargetAtTime(windFreq, now, 0.08);

    // 4. Âm thanh bánh xe tiếp đất (Touchdown chirp), lăn trên đường băng & phanh
    if (telemetry.onGround && !this.wasOnGround && telemetry.groundSpeedKnots > 18) {
      this.triggerTouchdownChirp();
    }
    this.wasOnGround = telemetry.onGround;

    const groundRollVol = telemetry.onGround
      ? MathUtils.clamp(telemetry.groundSpeedKnots / 65.0, 0, 1) * (telemetry.brakesActive ? 0.25 : 0.14)
      : 0.0;
    this.groundGain?.gain.setTargetAtTime(groundRollVol, now, 0.06);

    // 5. Còi báo thất tốc (Stall Horn)
    const stallVol = telemetry.isStallWarning ? 0.085 : 0.0;
    this.stallGain?.gain.setTargetAtTime(stallVol, now, 0.03);
  }

  private triggerTouchdownChirp(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);

    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }
}
