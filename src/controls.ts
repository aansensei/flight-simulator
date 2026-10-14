/**
 * AERONAUT: Wilderness Flight
 * Module: src/controls.ts
 *
 * Hệ thống đọc bàn phím PC và chuột:
 * - Đọc trạng thái nhấn/thả phím liên tục bằng KeyboardEvent.code (không phụ thuộc tốc độ lặp keydown).
 * - Cho phép giữ đồng thời nhiều phím cùng lúc.
 * - Chỉ chặn hành vi mặc định của phím khi vùng bay đang nhận điều khiển (không nuốt phím khi mở menu).
 * - Xóa toàn bộ phím đang giữ và kích hoạt tạm dừng khi cửa sổ mất focus hoặc chuyển tab.
 * - Chuột dùng để nhìn quanh buồng lái hoặc xoay camera ngoài, bánh xe chuột chỉnh khoảng cách camera đuổi.
 */

import { ControlInputs } from './types';
import { MathUtils } from './webgl2-three';

export interface InputActionCallbacks {
  onCycleFlaps: () => void;
  onToggleCamera: () => void;
  onToggleHelp: () => void;
  onToggleHud: () => void;
  onTogglePause: () => void;
  onRestartFlight: () => void;
  onToggleFullscreen: () => void;
  onToggleMute: () => void;
  onOpenMenuOrEscape: () => void;
  onRecenterCamera: () => void;
  onWindowBlur: () => void;
}

export class InputController {
  private pressedCodes = new Set<string>();
  private callbacks: InputActionCallbacks;
  isGameActive = false;

  // Góc nhìn chuột (Yaw / Pitch offset tính bằng radian) và khoảng cách Camera đuổi
  mouseYawOffset = 0;
  mousePitchOffset = 0;
  chaseDistance = 14.5;
  mouseFlight = false;
  private mousePitch = 0;
  private mouseRoll = 0;
  private isDraggingMouse = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: InputActionCallbacks) {
    this.callbacks = callbacks;
    this.bindEvents(canvas);
  }

  private bindEvents(canvas: HTMLCanvasElement): void {
    const flightControlCodes = new Set([
      'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract',
      'KeyG', 'KeyB', 'KeyT', 'KeyY', 'KeyC', 'KeyH',
      'ShiftLeft', 'ControlLeft', 'KeyV', 'KeyP', 'KeyR', 'KeyF', 'KeyM', 'KeyX', 'Space'
    ]);

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isFormElement = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
      if (isFormElement) return;

      if (e.code === 'Escape') {
        this.pressedCodes.clear();
        this.isDraggingMouse = false;
        this.callbacks.onOpenMenuOrEscape();
        return;
      }

      if (!this.isGameActive) {
        // Cho phép bấm P hoặc H ngay cả khi đang tạm dừng
        if (e.code === 'KeyP' && !e.repeat) this.callbacks.onTogglePause();
        if (e.code === 'KeyH' && !e.repeat) this.callbacks.onToggleHelp();
        if (e.code === 'KeyM' && !e.repeat) this.callbacks.onToggleMute();
        return;
      }

      if (flightControlCodes.has(e.code)) {
        e.preventDefault();
      }

      this.pressedCodes.add(e.code);

      if (!e.repeat) {
        switch (e.code) {
          case 'KeyG':
            this.callbacks.onCycleFlaps();
            break;
          case 'KeyC':
            this.callbacks.onToggleCamera();
            break;
          case 'KeyH':
            this.callbacks.onToggleHelp();
            break;
          case 'KeyV':
            this.callbacks.onToggleHud();
            break;
          case 'KeyP':
            this.callbacks.onTogglePause();
            break;
          case 'KeyR':
            this.callbacks.onRestartFlight();
            break;
          case 'KeyF':
            this.callbacks.onToggleFullscreen();
            break;
          case 'KeyM':
            this.callbacks.onToggleMute();
            break;
          case 'KeyX':
          case 'Space':
            this.recenterLook();
            this.callbacks.onRecenterCamera();
            break;
        }
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.pressedCodes.delete(e.code);
    });

    // Khi mất focus hoặc chuyển tab: xóa toàn bộ phím đang giữ và tạm dừng mô phỏng để tránh kẹt điều khiển
    const handleLoseFocus = () => {
      this.pressedCodes.clear();
      this.mousePitch = 0;
      this.mouseRoll = 0;
      this.isDraggingMouse = false;
      if (this.isGameActive) {
        this.callbacks.onWindowBlur();
      }
    };
    window.addEventListener('blur', handleLoseFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handleLoseFocus();
      }
    });

    // Điều khiển xoay góc nhìn bằng chuột (Kéo giữ chuột trái/phải hoặc di chuột khi Pointer Lock)
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.isGameActive) return;
      if (e.button === 1) {
        e.preventDefault();
        this.recenterLook();
        this.callbacks.onRecenterCamera();
        return;
      }
      if ((e.button === 0 && !this.mouseFlight) || e.button === 2) {
        this.isDraggingMouse = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    canvas.addEventListener('dblclick', () => {
      if (!this.isGameActive) return;
      this.recenterLook();
      this.callbacks.onRecenterCamera();
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingMouse = false;
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isGameActive) return;
      if (this.mouseFlight && !this.isDraggingMouse) {
        const rect = canvas.getBoundingClientRect();
        this.mouseRoll = MathUtils.clamp((e.clientX - rect.left - rect.width / 2) / (rect.width * 0.3), -1, 1);
        this.mousePitch = MathUtils.clamp((e.clientY - rect.top - rect.height / 2) / (rect.height * 0.3), -1, 1);
        return;
      }
      if (document.pointerLockElement === canvas) {
        this.applyMouseDelta(e.movementX, e.movementY);
      } else if (this.isDraggingMouse) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.applyMouseDelta(dx, dy);
      }
    });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      if (!this.isGameActive) return;
      e.preventDefault();
      this.chaseDistance = MathUtils.clamp(this.chaseDistance + Math.sign(e.deltaY) * 1.35, 7.5, 34.0);
    }, { passive: false });
  }

  private applyMouseDelta(dx: number, dy: number): void {
    const sens = 0.0038;
    this.mouseYawOffset = MathUtils.clamp(this.mouseYawOffset - dx * sens, -Math.PI * 0.88, Math.PI * 0.88);
    this.mousePitchOffset = MathUtils.clamp(this.mousePitchOffset - dy * sens, -Math.PI * 0.44, Math.PI * 0.44);
  }

  recenterLook(): void {
    this.mouseYawOffset = 0;
    this.mousePitchOffset = 0;
  }

  clearAllKeys(): void {
    this.pressedCodes.clear();
    this.mousePitch = 0;
    this.mouseRoll = 0;
    this.isDraggingMouse = false;
  }

  /**
   * Trả về trạng thái các phím điều khiển bay liên tục tại khung hình hiện tại
   */
  getControlInputs(): ControlInputs {
    const p = this.pressedCodes;
    return {
      pitchAxis: this.mouseFlight && !p.has('KeyS') && !p.has('KeyW') && !p.has('ArrowUp') && !p.has('ArrowDown') ? this.mousePitch : undefined,
      rollAxis: this.mouseFlight && !p.has('KeyA') && !p.has('KeyD') && !p.has('ArrowLeft') && !p.has('ArrowRight') ? this.mouseRoll : undefined,
      // W hoặc Mũi tên Lên: chúi mũi xuống (pitch down); S hoặc Mũi tên Xuống: kéo mũi lên (pitch up)
      pitchDown: p.has('KeyW') || p.has('ArrowUp'),
      pitchUp: p.has('KeyS') || p.has('ArrowDown'),
      rollLeft: p.has('KeyA') || p.has('ArrowLeft'),
      rollRight: p.has('KeyD') || p.has('ArrowRight'),
      yawLeft: p.has('KeyQ'),
      yawRight: p.has('KeyE'),
      throttleUp: p.has('Equal') || p.has('NumpadAdd') || p.has('ShiftLeft'),
      throttleDown: p.has('Minus') || p.has('NumpadSubtract') || p.has('ControlLeft'),
      brakes: p.has('KeyB'),
      trimUp: p.has('KeyT'),
      trimDown: p.has('KeyY')
    };
  }
}
