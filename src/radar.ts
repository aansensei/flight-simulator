import { getTerrainHeight, RUNWAY_CONFIG } from './terrain';
import { Vector3 } from './webgl2-three';

export class FlightRadar {
  private canvas = document.getElementById('radar-canvas') as HTMLCanvasElement;
  private ctx = this.canvas.getContext('2d')!;
  private background = document.createElement('canvas');
  private centerX = Infinity;
  private centerZ = Infinity;
  private range = 6000;

  constructor() {
    this.background.width = this.background.height = 96;
    document.getElementById('radar-zoom-in')?.addEventListener('click', () => this.zoom(0.5));
    document.getElementById('radar-zoom-out')?.addEventListener('click', () => this.zoom(2));
  }

  private zoom(factor: number): void {
    this.range = Math.max(1500, Math.min(24000, this.range * factor));
    this.centerX = Infinity;
  }

  update(position: Vector3, heading: number): void {
    if (Math.hypot(position.x - this.centerX, position.z - this.centerZ) > this.range * 0.12) {
      this.centerX = position.x;
      this.centerZ = position.z;
      const b = this.background.getContext('2d')!;
      const pixels = b.createImageData(96, 96);
      for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
        const h = getTerrainHeight(this.centerX + (x / 95 * 2 - 1) * this.range, this.centerZ + (y / 95 * 2 - 1) * this.range);
        const color = h <= 0 ? [15, 61, 80] : h < 160 ? [55, 90, 67] : h < 600 ? [96, 111, 84] : [156, 159, 144];
        const i = (y * 96 + x) * 4;
        pixels.data.set([...color, 255], i);
      }
      b.putImageData(pixels, 0, 0);
    }
    const c = this.ctx, size = this.canvas.width, scale = size / (2 * this.range);
    const sx = (x: number) => size / 2 + (x - position.x) * scale;
    const sy = (z: number) => size / 2 + (z - position.z) * scale;
    c.fillStyle = '#0f3d50'; c.fillRect(0, 0, size, size);
    c.drawImage(this.background, (this.centerX - position.x) * scale, (this.centerZ - position.z) * scale, size, size);
    c.strokeStyle = '#cee8ea38'; c.lineWidth = 1;
    for (const radius of [size / 4, size / 2 - 8]) {
      c.beginPath(); c.arc(size / 2, size / 2, radius, 0, Math.PI * 2); c.stroke();
    }
    c.setLineDash([3, 5]); c.beginPath(); c.moveTo(size / 2, 0); c.lineTo(size / 2, size); c.moveTo(0, size / 2); c.lineTo(size, size / 2); c.stroke(); c.setLineDash([]);
    const r = RUNWAY_CONFIG;
    c.strokeStyle = '#fff4ab'; c.lineWidth = 4; c.beginPath();
    c.moveTo(sx(r.centerX), sy(r.centerZ - r.length / 2)); c.lineTo(sx(r.centerX), sy(r.centerZ + r.length / 2)); c.stroke();
    c.fillStyle = '#fff4ab'; c.font = '11px sans-serif'; c.fillText('RWY 36', sx(r.centerX) + 7, sy(r.centerZ));
    c.fillStyle = '#d8edf0'; c.textAlign = 'center'; c.fillText('N', size / 2, 13);
    c.save(); c.translate(size / 2, size / 2); c.rotate(heading * Math.PI / 180);
    c.fillStyle = '#71e2ff'; c.strokeStyle = '#061e2c'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -12); c.lineTo(9, 9); c.lineTo(0, 5); c.lineTo(-9, 9); c.closePath(); c.fill(); c.stroke(); c.restore();
    const label = document.getElementById('radar-range');
    if (label) label.textContent = `${this.range / 1000} km · ${Math.round(heading).toString().padStart(3, '0')}°`;
  }
}
