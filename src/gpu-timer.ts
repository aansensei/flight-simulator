interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

// Query results are read only after the GPU signals availability.
export class GpuTimer {
  milliseconds = 0;
  private extension: TimerExtension | null;
  private pending: WebGLQuery | null = null;
  private active = false;

  constructor(private gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }

  begin(): void {
    const gl = this.gl, ext = this.extension;
    if (!ext) return;
    if (this.pending) {
      if (!gl.getQueryParameter(this.pending, gl.QUERY_RESULT_AVAILABLE)) return;
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        const sample = gl.getQueryParameter(this.pending, gl.QUERY_RESULT) / 1e6;
        this.milliseconds = this.milliseconds ? this.milliseconds * 0.85 + sample * 0.15 : sample;
      }
      gl.deleteQuery(this.pending);
      this.pending = null;
    }
    this.pending = gl.createQuery();
    if (!this.pending) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, this.pending);
    this.active = true;
  }

  end(): void {
    if (!this.active || !this.extension) return;
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.active = false;
  }
}
