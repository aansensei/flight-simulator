interface LandcoverManifest { zoom: number; tileSize: number; columns: number; rows: number; startX: number; startY: number }
let manifest: LandcoverManifest | null = null;
let atlas: HTMLCanvasElement | null = null;
let density: Uint8ClampedArray | null = null;
const DENSITY_SIZE = 384;

export function worldToImageryTile(x: number, z: number, zoom = 13): [number, number] {
  const longitude = 7.70 - z / 62000, latitude = 46.63 + x / 111320;
  const radians = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180;
  const scale = 2 ** zoom;
  return [(longitude + 180) / 360 * scale, (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * scale];
}

export async function loadLandcover(progress: (loaded: number, total: number) => void): Promise<void> {
  const base = new URL('assets/landcover/', document.baseURI);
  const response = await fetch(new URL('manifest.json', base));
  if (!response.ok) throw new Error('Không tải được thông tin ảnh địa hình.');
  const info: LandcoverManifest = await response.json();
  const canvas = document.createElement('canvas');
  canvas.width = info.columns * info.tileSize; canvas.height = info.rows * info.tileSize;
  const ctx = canvas.getContext('2d')!;
  const jobs: Array<() => Promise<void>> = [];
  let loaded = 0;
  for (let row = 0; row < info.rows; row++) for (let col = 0; col < info.columns; col++) {
    jobs.push(() => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => { ctx.drawImage(image, col * info.tileSize, row * info.tileSize); progress(++loaded, info.rows * info.columns); resolve(); };
      image.onerror = () => reject(new Error('Không tải được một ô ảnh địa hình. Tải lại trang để thử lại.'));
      image.src = new URL(`${row + info.startY}_${col + info.startX}.jpg`, base).href;
    }));
  }
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < jobs.length) await jobs[next++]();
  }));
  const small = document.createElement('canvas'); small.width = small.height = DENSITY_SIZE;
  const smallCtx = small.getContext('2d', { willReadFrequently: true })!;
  smallCtx.drawImage(canvas, 0, 0, DENSITY_SIZE, DENSITY_SIZE);
  density = smallCtx.getImageData(0, 0, DENSITY_SIZE, DENSITY_SIZE).data;
  manifest = info; atlas = canvas;
}

export function getLandcoverAtlas() { return atlas && manifest ? { canvas: atlas, manifest } : null; }

export function forestDensityAt(x: number, z: number): number {
  if (!density || !manifest) return 1;
  const [tx, ty] = worldToImageryTile(x, z, manifest.zoom);
  const u = (tx - manifest.startX) / manifest.columns, v = (ty - manifest.startY) / manifest.rows;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return 1;
  const i = (Math.floor(v * DENSITY_SIZE) * DENSITY_SIZE + Math.floor(u * DENSITY_SIZE)) * 4;
  const r = density[i] / 255, g = density[i + 1] / 255, b = density[i + 2] / 255;
  const greenness = Math.max(0, Math.min(1, (g - Math.max(r, b) + 0.015) * 22));
  const brightness = (r + g + b) / 3;
  return greenness * Math.max(0.05, Math.min(1, (0.48 - brightness) * 4));
}
