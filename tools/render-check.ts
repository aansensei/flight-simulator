import { getLandcoverAtlas, loadLandcover } from '../src/landcover';
import { loadAlpineElevationData } from '../src/elevation-data';
import { WildernessEnvironment, getTerrainHeight } from '../src/terrain';
import { Scene, WebGLRenderer, PerspectiveCamera, Vector3 } from '../src/webgl2-three';
import { QUALITY_PRESETS, QualityPresetName } from '../src/types';

const canvas = document.querySelector('#check-canvas') as HTMLCanvasElement;
const status = document.querySelector('#status')!, result = document.querySelector('#result')!;
await loadAlpineElevationData();
await loadLandcover((loaded, total) => status.textContent = `Loading imagery ${loaded}/${total}`);
const renderer = new WebGLRenderer(canvas), scene = new Scene(), camera = new PerspectiveCamera(60, 16 / 9, 0.18, 180000);
renderer.setSize(1280, 720, 1, 1);
const atlas = getLandcoverAtlas();
if (atlas) renderer.setLandcoverMap(atlas.canvas, atlas.manifest);
const environment = new WildernessEnvironment(scene, QUALITY_PRESETS.high, renderer.gl);
renderer.setTerrainHeightField(getTerrainHeight);
renderer.setForestGeometry(environment.forestGeometry!);
renderer.elapsedTime = 12;
renderer.cinematic = false; renderer.sharpen = true;
const views = {
  overview: { eye: new Vector3(-500, 650, 900), target: new Vector3(850, 16, 0) },
  far: { eye: new Vector3(-1400, 480, 1450), target: new Vector3(850, 16, 0) },
  approach: { eye: new Vector3(850, 150, 3600), target: new Vector3(850, 16, 0) },
  ground: { eye: new Vector3(850, 18, 1050), target: new Vector3(850, 18, 500) },
  away: { eye: new Vector3(-180, 460, 760), target: new Vector3(-2500, 550, -500) }
};
type View = keyof typeof views;
let current: View = 'far', frame = 0, paused = false, running = false, measureFrame = 0;
let draws = 0, triangles = 0, previous = performance.now();
let samples: Array<{ cpu: number; gpu: number; frame: number; draws: number; triangles: number }> = [];
const results: unknown[] = [];
const gl = renderer.gl;
for (const method of ['drawArrays', 'drawElements', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
  const draw = gl[method].bind(gl);
  (gl as any)[method] = (...args: number[]) => {
    draws++;
    const count = method.includes('Elements') ? args[1] : args[2];
    const instances = method.endsWith('Instanced') ? args[method.includes('Elements') ? 4 : 3] : 1;
    triangles += count / 3 * instances;
    return (draw as any)(...args);
  };
}
const selectView = (name: View) => { current = name; frame = 0; measureFrame = 0; samples = []; paused = false; };
for (const name of Object.keys(views) as View[]) document.getElementById(name)!.onclick = () => { running = false; selectView(name); };
document.getElementById('pause')!.onclick = () => { paused = !paused; };
document.getElementById('quality')!.onchange = event => {
  const quality = QUALITY_PRESETS[(event.target as HTMLSelectElement).value as QualityPresetName];
  environment.rebuildScalableAssets(quality);
  renderer.setForestGeometry(environment.forestGeometry!);
  renderer.setShadowMapSize(quality.shadowMapSize);
  renderer.waterWaveLayers = quality.waterWaveLayers;
  frame = 0;
};
document.getElementById('run')!.onclick = () => { results.length = 0; result.textContent = ''; running = true; selectView('far'); };
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
function tick(now: number): void {
  const elapsed = now - previous; previous = now;
  if (!paused) {
    const view = views[current];
    camera.position.copy(view.eye);
    // Subpixel camera motion reproduces distant depth conflicts without moving the runway.
    camera.position.x += Math.sin(frame * 0.11) * (current === 'ground' ? 0 : 1.5);
    camera.lookAt(view.target);
    environment.update(12, 0, 0, camera.position);
    draws = 0; triangles = 0;
    const start = performance.now(); renderer.render(scene, camera, camera.position); const cpu = performance.now() - start;
    frame++;
    if (running) {
      measureFrame++;
      if (measureFrame > 120) samples.push({ cpu, gpu: renderer.gpuTimer.milliseconds, frame: elapsed, draws, triangles });
      if (measureFrame === 360) {
        results.push({ view: current, quality: (document.getElementById('quality') as HTMLSelectElement).value, size: '1280x720', cpuMs: median(samples.map(s => s.cpu)), gpuMs: median(samples.map(s => s.gpu)), frameMs: median(samples.map(s => s.frame)), draws: median(samples.map(s => s.draws)), triangles: median(samples.map(s => s.triangles)) });
        result.textContent = JSON.stringify(results, null, 2);
        const measuredViews: View[] = ['far', 'approach', 'ground', 'away'];
        const next = measuredViews[measuredViews.indexOf(current) + 1];
        if (next) selectView(next); else { running = false; paused = true; }
      }
    }
    if (frame % 30 === 0) status.textContent = `${running ? 'Measuring' : 'Ready'}: ${current}, ${frame} frames, ${draws} draws, ${Math.round(triangles).toLocaleString()} triangles, GPU ${renderer.gpuTimer.milliseconds.toFixed(2)} ms, CPU ${cpu.toFixed(2)} ms, ${renderer.backendName}, eye ${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)}, target ${camera.target.x}, ${camera.target.y}, ${camera.target.z}`;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
