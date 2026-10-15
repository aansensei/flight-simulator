import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputController, InputActionCallbacks } from '../src/controls';

test('M toggles radar, N toggles sound, paused shortcuts work and held keys do not retrigger', () => {
  const keyboard = new EventTarget();
  Object.assign(globalThis, { window: keyboard, document: Object.assign(new EventTarget(), { hidden: false }) });
  const actions: string[] = [];
  const callbacks: InputActionCallbacks = {
    onToggleRadar: () => actions.push('radar'), onToggleMute: () => actions.push('sound'),
    onCycleFlaps() {}, onToggleCamera() {}, onToggleHelp() {}, onToggleHud() {}, onTogglePause() {},
    onRestartFlight() {}, onToggleFullscreen() {}, onOpenMenuOrEscape() {}, onRecenterCamera() {}, onWindowBlur() {}
  };
  const controller = new InputController(new EventTarget() as HTMLCanvasElement, callbacks);
  const key = (code: string, repeat = false): void => {
    keyboard.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat }));
  };
  controller.isGameActive = true;
  key('KeyM'); key('KeyM', true);
  assert.deepEqual(actions, ['radar']);
  key('KeyN'); key('KeyN', true);
  assert.deepEqual(actions, ['radar', 'sound']);
  controller.isGameActive = false;
  key('KeyM'); key('KeyN');
  assert.deepEqual(actions, ['radar', 'sound', 'radar', 'sound']);
});
