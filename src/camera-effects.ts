// The scene resolves from an MSAA target before the lens pass samples it.
export class CameraEffects {
  private framebuffer: WebGLFramebuffer;
  private resolveFramebuffer: WebGLFramebuffer;
  private colorBuffer: WebGLRenderbuffer;
  private depthBuffer: WebGLRenderbuffer;
  private texture: WebGLTexture;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private width = 0;
  private height = 0;

  constructor(private gl: WebGL2RenderingContext) {
    this.framebuffer = gl.createFramebuffer()!;
    this.resolveFramebuffer = gl.createFramebuffer()!;
    this.colorBuffer = gl.createRenderbuffer()!;
    this.depthBuffer = gl.createRenderbuffer()!;
    this.texture = gl.createTexture()!;
    this.vao = gl.createVertexArray()!;
    const vertex = `#version 300 es
      out vec2 uv;
      void main() {
        vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        uv = p;
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`;
    const fragment = `#version 300 es
      precision highp float;
      in vec2 uv;
      out vec4 color;
      uniform sampler2D image;
      uniform vec2 pixel;
      uniform float time;
      uniform float strength;
      uniform float rain;
      uniform float sharpen;
      float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      vec3 bright(vec2 p) {
        vec3 c = texture(image, p).rgb;
        return c * smoothstep(0.72, 1.0, luma(c));
      }
      void main() {
        vec3 c = texture(image, uv).rgb;
        vec3 nw = texture(image, uv + pixel * vec2(-1, 1)).rgb;
        vec3 ne = texture(image, uv + pixel * vec2(1, 1)).rgb;
        vec3 sw = texture(image, uv + pixel * vec2(-1, -1)).rgb;
        vec3 se = texture(image, uv + pixel * vec2(1, -1)).rgb;
        float lnw = luma(nw), lne = luma(ne), lsw = luma(sw), lse = luma(se), lc = luma(c);
        vec2 dir = vec2(-(lnw + lne - lsw - lse), lnw + lsw - lne - lse);
        float reduce = max((lnw + lne + lsw + lse) * 0.03125, 0.0078125);
        dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), vec2(-8), vec2(8)) * pixel;
        vec3 a = 0.5 * (texture(image, uv - dir / 6.0).rgb + texture(image, uv + dir / 6.0).rgb);
        vec3 b = a * 0.5 + 0.25 * (texture(image, uv - dir * 0.5).rgb + texture(image, uv + dir * 0.5).rgb);
        float lb = luma(b);
        float lo = min(lc, min(min(lnw, lne), min(lsw, lse)));
        float hi = max(lc, max(max(lnw, lne), max(lsw, lse)));
        c = lb < lo || lb > hi ? a : b;
        vec3 neighborhood = (nw + ne + sw + se) * 0.25;
        vec3 minColor = min(c, min(min(nw, ne), min(sw, se)));
        vec3 maxColor = max(c, max(max(nw, ne), max(sw, se)));
        c = clamp(c + (c - neighborhood) * 0.22 * sharpen, minColor, maxColor);
        vec3 glow = vec3(0);
        for (int i = 0; i < 8; i++) {
          float angle = float(i) * 0.785398;
          vec2 offset = vec2(cos(angle), sin(angle)) * pixel;
          glow += bright(uv + offset * 5.0) * 0.65 + bright(uv + offset * 18.0) * 0.35;
        }
        c += glow * (0.045 / 8.0) * strength;
        float luminance = luma(c);
        vec3 neutral = mix(vec3(luminance), c, 0.94);
        vec3 tone = mix(vec3(0.975, 1.0, 1.025), vec3(1.025, 1.006, 0.98), smoothstep(0.25, 0.85, luminance));
        c = mix(c, neutral * tone, strength);
        vec2 lens = uv * 2.0 - 1.0;
        c *= 1.0 - dot(lens, lens) * 0.055 * strength;
        float grain = fract(sin(dot(gl_FragCoord.xy + fract(time) * 139.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        c += grain * 0.003 * strength;
        if (rain > 0.01) {
          float streaks = 0.0;
          for (int layer = 0; layer < 3; layer++) {
            float f = float(layer);
            vec2 q = uv * vec2(115.0 + f * 37.0, 15.0 + f * 7.0);
            q.x += uv.y * (8.0 + f * 2.0);
            q.y += time * (12.0 + f * 4.0);
            vec2 cell = floor(q);
            float seed = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
            vec2 local = fract(q);
            float line = (1.0 - smoothstep(0.015, 0.065, abs(local.x - seed))) * smoothstep(0.0, 0.12, local.y) * (1.0 - smoothstep(0.25, 0.6, local.y));
            streaks += line * step(0.72, seed) * (0.7 - f * 0.15);
          }
          c = mix(c, vec3(0.72, 0.79, 0.84), clamp(streaks * rain * 0.6, 0.0, 0.5));
        }
        color = vec4(clamp(c, 0.0, 1.0), 1);
      }`;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Camera shader failed');
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program) || 'Camera program failed');
    for (const name of ['image', 'pixel', 'time', 'strength', 'rain', 'sharpen']) this.uniforms[name] = gl.getUniformLocation(this.program, name);
  }

  begin(width: number, height: number): void {
    const gl = this.gl;
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      const samples = Math.min(width * height > 4000000 ? 2 : 4, gl.getParameter(gl.MAX_SAMPLES));
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.colorBuffer);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.colorBuffer);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('MSAA framebuffer unavailable');
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.resolveFramebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Lens framebuffer unavailable');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
  }

  finish(time: number, cinematic: boolean, rain: number, sharpen: boolean): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.resolveFramebuffer);
    gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms['image'], 2);
    gl.uniform2f(this.uniforms['pixel'], 1 / this.width, 1 / this.height);
    gl.uniform1f(this.uniforms['time'], time);
    gl.uniform1f(this.uniforms['rain'], rain);
    gl.uniform1f(this.uniforms['sharpen'], sharpen ? 1 : 0);
    gl.uniform1f(this.uniforms['strength'], cinematic ? 1 : 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }
}
