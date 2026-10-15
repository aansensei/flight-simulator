const SIZE = 1025;
let elevations: DataView | null = null;

export function setAlpineElevationData(buffer: ArrayBuffer): void {
  if (buffer.byteLength !== SIZE * SIZE * 2) throw new Error('Dữ liệu địa hình Alps không đúng định dạng.');
  elevations = new DataView(buffer);
}

export async function loadAlpineElevationData(): Promise<void> {
  const response = await fetch(new URL('assets/terrain/alps.dem', document.baseURI));
  if (!response.ok) throw new Error(`Không tải được địa hình Alps (${response.status}).`);
  setAlpineElevationData(await response.arrayBuffer());
}

export function sampleAlpineElevation(x: number, z: number): number {
  if (!elevations) throw new Error('Địa hình Alps chưa được tải.');
  const longitude = 7.70 - z / 62000;
  const latitude = 46.63 + x / 111320;
  const gx = Math.max(0, Math.min(SIZE - 1.0001, (longitude - 7) * (SIZE - 1)));
  const gz = Math.max(0, Math.min(SIZE - 1.0001, (47 - latitude) * (SIZE - 1)));
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const sample = (col: number, row: number) => elevations!.getInt16((row * SIZE + col) * 2, true);
  return (sample(ix, iz) * (1 - fx) + sample(ix + 1, iz) * fx) * (1 - fz) + (sample(ix, iz + 1) * (1 - fx) + sample(ix + 1, iz + 1) * fx) * fz;
}
