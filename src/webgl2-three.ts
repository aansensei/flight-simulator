import { GpuTimer } from './gpu-timer';
import { CameraEffects } from './camera-effects';
/**
 * AERONAUT: Wilderness Flight
 * Module: src/webgl2-three.ts
 *
 * Bộ nhân đồ họa 3D tương thích kiến trúc Three.js chạy trực tiếp trên WebGL 2 (GLSL ES 3.00).
 * Bao gồm:
 * - Vector3, Quaternion, Euler, Matrix4, Color, MathUtils
 * - Object3D, Group, Scene, PerspectiveCamera
 * - BufferGeometry, Mesh, InstancedMesh, CanvasTexture
 * - WebGLRenderer (WebGL 2.0 + Shadow Mapping PCF 3x3 + Hardware Instancing + ACES Filmic Tone Mapping)
 */

export const MathUtils = {
  clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  },
  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },
  smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  },
  degToRad(d: number): number {
    return d * (Math.PI / 180);
  },
  radToDeg(r: number): number {
    return r * (180 / Math.PI);
  }
};

export class Color {
  r = 1;
  g = 1;
  b = 1;
  constructor(hexOrR: number = 0xffffff, g?: number, b?: number) {
    if (g !== undefined && b !== undefined) {
      this.r = hexOrR;
      this.g = g;
      this.b = b;
    } else {
      this.setHex(hexOrR);
    }
  }
  setHex(hex: number): this {
    hex = Math.floor(hex);
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }
  setRGB(r: number, g: number, b: number): this {
    this.r = r;
    this.g = g;
    this.b = b;
    return this;
  }
  copy(c: Color): this {
    this.r = c.r;
    this.g = c.g;
    this.b = c.b;
    return this;
  }
  lerp(c: Color, t: number): this {
    this.r += (c.r - this.r) * t;
    this.g += (c.g - this.g) * t;
    this.b += (c.b - this.b) * t;
    return this;
  }
  toArray(): [number, number, number] {
    return [this.r, this.g, this.b];
  }
}

export class Vector3 {
  x: number;
  y: number;
  z: number;
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v: Vector3): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
  add(v: Vector3): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  addScaledVector(v: Vector3, s: number): this {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  sub(v: Vector3): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  subVectors(a: Vector3, b: Vector3): this {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  multiplyScalar(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  crossVectors(a: Vector3, b: Vector3): this {
    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x, by = b.y, bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length(): number {
    return Math.sqrt(this.lengthSq());
  }
  distanceTo(v: Vector3): number {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  normalize(): this {
    const len = this.length();
    if (len > 1e-8) {
      this.multiplyScalar(1 / len);
    }
    return this;
  }
  lerp(v: Vector3, alpha: number): this {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  lerpVectors(v1: Vector3, v2: Vector3, alpha: number): this {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    return this;
  }
  applyQuaternion(q: Quaternion): this {
    const x = this.x, y = this.y, z = this.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return this;
  }
  applyMatrix4(m: Matrix4): this {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15] || 1);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
}

export class Euler {
  x: number;
  y: number;
  z: number;
  order: string;
  constructor(x = 0, y = 0, z = 0, order = 'YXZ') {
    this.x = x;
    this.y = y;
    this.z = z;
    this.order = order;
  }
  set(x: number, y: number, z: number, order = this.order): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.order = order;
    return this;
  }
  setFromQuaternion(q: Quaternion, order = 'YXZ'): this {
    this.order = order;
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    const m11 = 1 - (yy + zz);
    const m12 = xy - wz;
    const m13 = xz + wy;
    const m21 = xy + wz;
    const m22 = 1 - (xx + zz);
    const m23 = yz - wx;
    const m31 = xz - wy;
    const m32 = yz + wx;
    const m33 = 1 - (xx + yy);

    if (order === 'YXZ') {
      this.x = Math.asin(-MathUtils.clamp(m23, -1, 1));
      if (Math.abs(m23) < 0.999999) {
        this.y = Math.atan2(m13, m33);
        this.z = Math.atan2(m21, m22);
      } else {
        this.y = Math.atan2(-m31, m11);
        this.z = 0;
      }
    } else {
      this.y = Math.asin(MathUtils.clamp(m13, -1, 1));
      if (Math.abs(m13) < 0.999999) {
        this.x = Math.atan2(-m23, m33);
        this.z = Math.atan2(-m12, m11);
      } else {
        this.x = Math.atan2(m32, m22);
        this.z = 0;
      }
    }
    return this;
  }
}

export class Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  set(x: number, y: number, z: number, w: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  identity(): this {
    return this.set(0, 0, 0, 1);
  }
  copy(q: Quaternion): this {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }
  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }
  invert(): this {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }
  normalize(): this {
    let l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (l === 0) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.w = 1;
    } else {
      l = 1 / l;
      this.x *= l;
      this.y *= l;
      this.z *= l;
      this.w *= l;
    }
    return this;
  }
  multiply(q: Quaternion): this {
    return this.multiplyQuaternions(this, q);
  }
  premultiply(q: Quaternion): this {
    return this.multiplyQuaternions(q, this);
  }
  multiplyQuaternions(a: Quaternion, b: Quaternion): this {
    const qax = a.x, qay = a.y, qaz = a.z, qaw = a.w;
    const qbx = b.x, qby = b.y, qbz = b.z, qbw = b.w;
    this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    return this;
  }
  setFromAxisAngle(axis: Vector3, angle: number): this {
    const half = angle * 0.5;
    const s = Math.sin(half);
    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos(half);
    return this;
  }
  setFromEuler(euler: Euler): this {
    const x = euler.x, y = euler.y, z = euler.z, order = euler.order;
    const c1 = Math.cos(x * 0.5), c2 = Math.cos(y * 0.5), c3 = Math.cos(z * 0.5);
    const s1 = Math.sin(x * 0.5), s2 = Math.sin(y * 0.5), s3 = Math.sin(z * 0.5);

    if (order === 'YXZ') {
      this.x = s1 * c2 * c3 + c1 * s2 * s3;
      this.y = c1 * s2 * c3 - s1 * c2 * s3;
      this.z = c1 * c2 * s3 - s1 * s2 * c3;
      this.w = c1 * c2 * c3 + s1 * s2 * s3;
    } else {
      this.x = s1 * c2 * c3 + c1 * s2 * s3;
      this.y = c1 * s2 * c3 - s1 * c2 * s3;
      this.z = c1 * c2 * s3 + s1 * s2 * c3;
      this.w = c1 * c2 * c3 - s1 * s2 * s3;
    }
    return this;
  }
  slerpQuaternions(qa: Quaternion, qb: Quaternion, t: number): this {
    if (t <= 0) return this.copy(qa);
    if (t >= 1) return this.copy(qb);
    let x = qa.x, y = qa.y, z = qa.z, w = qa.w;
    let bx = qb.x, by = qb.y, bz = qb.z, bw = qb.w;
    let cosHalfTheta = w * bw + x * bx + y * by + z * bz;
    if (cosHalfTheta < 0) {
      bx = -bx; by = -by; bz = -bz; bw = -bw;
      cosHalfTheta = -cosHalfTheta;
    }
    if (cosHalfTheta >= 1.0) {
      return this.set(x, y, z, w);
    }
    const sqrSinHalfTheta = 1.0 - cosHalfTheta * cosHalfTheta;
    if (sqrSinHalfTheta <= 1e-6) {
      const s = 1 - t;
      this.x = s * x + t * bx;
      this.y = s * y + t * by;
      this.z = s * z + t * bz;
      this.w = s * w + t * bw;
      return this.normalize();
    }
    const sinHalfTheta = Math.sqrt(sqrSinHalfTheta);
    const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    this.x = x * ratioA + bx * ratioB;
    this.y = y * ratioA + by * ratioB;
    this.z = z * ratioA + bz * ratioB;
    this.w = w * ratioA + bw * ratioB;
    return this;
  }
}

export class Matrix4 {
  elements: Float32Array;
  constructor() {
    this.elements = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }
  identity(): this {
    const te = this.elements;
    te[0] = 1; te[4] = 0; te[8] = 0; te[12] = 0;
    te[1] = 0; te[5] = 1; te[9] = 0; te[13] = 0;
    te[2] = 0; te[6] = 0; te[10] = 1; te[14] = 0;
    te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1;
    return this;
  }
  copy(m: Matrix4): this {
    this.elements.set(m.elements);
    return this;
  }
  multiplyMatrices(a: Matrix4, b: Matrix4): this {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;

    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];

    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  compose(position: Vector3, quaternion: Quaternion, scale: Vector3): this {
    const te = this.elements;
    const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = scale.x, sy = scale.y, sz = scale.z;

    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;

    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;

    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;

    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }
  makePerspective(fovDeg: number, aspect: number, near: number, far: number): this {
    const te = this.elements;
    const f = 1.0 / Math.tan(MathUtils.degToRad(fovDeg) * 0.5);
    const nf = 1 / (near - far);
    te[0] = f / aspect; te[4] = 0; te[8] = 0; te[12] = 0;
    te[1] = 0; te[5] = f; te[9] = 0; te[13] = 0;
    te[2] = 0; te[6] = 0; te[10] = (far + near) * nf; te[14] = 2 * far * near * nf;
    te[3] = 0; te[7] = 0; te[11] = -1; te[15] = 0;
    return this;
  }
  makeOrthographic(left: number, right: number, top: number, bottom: number, near: number, far: number): this {
    const te = this.elements;
    const w = 1.0 / (right - left);
    const h = 1.0 / (top - bottom);
    const p = 1.0 / (far - near);
    const x = (right + left) * w;
    const y = (top + bottom) * h;
    const z = (far + near) * p;
    te[0] = 2 * w; te[4] = 0; te[8] = 0; te[12] = -x;
    te[1] = 0; te[5] = 2 * h; te[9] = 0; te[13] = -y;
    te[2] = 0; te[6] = 0; te[10] = -2 * p; te[14] = -z;
    te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1;
    return this;
  }
  lookAtView(eye: Vector3, target: Vector3, up: Vector3): this {
    const z0 = eye.x - target.x, z1 = eye.y - target.y, z2 = eye.z - target.z;
    let len = Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    const zx = len > 1e-6 ? z0 / len : 0;
    const zy = len > 1e-6 ? z1 / len : 0;
    const zz = len > 1e-6 ? z2 / len : 1;

    let x0 = up.y * zz - up.z * zy;
    let x1 = up.z * zx - up.x * zz;
    let x2 = up.x * zy - up.y * zx;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (len < 1e-6) {
      x0 = 1; x1 = 0; x2 = 0;
    } else {
      x0 /= len; x1 /= len; x2 /= len;
    }

    const y0 = zy * x2 - zz * x1;
    const y1 = zz * x0 - zx * x2;
    const y2 = zx * x1 - zy * x0;

    const te = this.elements;
    te[0] = x0; te[4] = x1; te[8] = x2; te[12] = -(x0 * eye.x + x1 * eye.y + x2 * eye.z);
    te[1] = y0; te[5] = y1; te[9] = y2; te[13] = -(y0 * eye.x + y1 * eye.y + y2 * eye.z);
    te[2] = zx; te[6] = zy; te[10] = zz; te[14] = -(zx * eye.x + zy * eye.y + zz * eye.z);
    te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1;
    return this;
  }
}

export class Object3D {
  position = new Vector3();
  quaternion = new Quaternion();
  rotation = new Euler();
  scale = new Vector3(1, 1, 1);
  matrix = new Matrix4();
  matrixWorld = new Matrix4();
  children: Object3D[] = [];
  parent: Object3D | null = null;
  visible = true;
  castShadow = false;
  receiveShadow = false;
  useQuaternion = false;
  name = '';

  add(child: Object3D): this {
    if (child.parent) {
      const idx = child.parent.children.indexOf(child);
      if (idx >= 0) child.parent.children.splice(idx, 1);
    }
    child.parent = this;
    this.children.push(child);
    return this;
  }
  remove(child: Object3D): this {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parent = null;
    }
    return this;
  }
  updateMatrix(): void {
    if (!this.useQuaternion) {
      this.quaternion.setFromEuler(this.rotation);
    }
    this.matrix.compose(this.position, this.quaternion, this.scale);
  }
  updateMatrixWorld(): void {
    this.updateMatrix();
    if (this.parent === null) {
      this.matrixWorld.copy(this.matrix);
    } else {
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    }
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].updateMatrixWorld();
    }
  }
}

export class Group extends Object3D {}

export class Scene extends Object3D {
  background = new Color(0x87b8e8);
  fogColor = new Color(0xc8def2);
  fogDensity = 0.00012;
}

export class PerspectiveCamera extends Object3D {
  fov: number;
  aspect: number;
  near: number;
  far: number;
  projectionMatrix = new Matrix4();
  viewMatrix = new Matrix4();
  target = new Vector3(0, 0, -1);
  upVec = new Vector3(0, 1, 0);

  constructor(fov = 60, aspect = 1.777, near = 0.25, far = 26000) {
    super();
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix(): void {
    this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far);
  }
  lookAt(target: Vector3, up?: Vector3): void {
    this.target.copy(target);
    if (up) this.upVec.copy(up);
    this.viewMatrix.lookAtView(this.position, this.target, this.upVec);
  }
}

export interface GeometryBuffers {
  positions: Float32Array;
  normals: Float32Array;
  uvs?: Float32Array;
  colors?: Float32Array;
  indices?: Uint16Array | Uint32Array;
}

export class BufferGeometry {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array | null;
  indices: Uint16Array | Uint32Array | null;
  vao: WebGLVertexArrayObject | null = null;
  gpuBuffers: WebGLBuffer[] = [];
  indexCount = 0;
  vertexCount = 0;
  indexType = 0;
  needsUpload = true;

  constructor(data: GeometryBuffers) {
    this.positions = data.positions;
    this.normals = data.normals;
    this.vertexCount = this.positions.length / 3;
    this.uvs = data.uvs || new Float32Array(this.vertexCount * 2);
    this.colors = data.colors || null;
    this.indices = data.indices || null;
    this.indexCount = this.indices ? this.indices.length : this.vertexCount;
  }
}

export type MaterialShaderType = 'pbr' | 'terrain' | 'water' | 'cloud' | 'sky' | 'unlit_tex' | 'prop_blur';

export interface MaterialOptions {
  shaderType?: MaterialShaderType;
  color?: number;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  opacity?: number;
  transparent?: boolean;
  doubleSided?: boolean;
  emissive?: number;
  canvasTexture?: HTMLCanvasElement;
  foliage?: boolean;
  treeBillboard?: boolean;
}

export class Material {
  shaderType: MaterialShaderType;
  color: Color;
  roughness: number;
  metalness: number;
  clearcoat: number;
  opacity: number;
  transparent: boolean;
  doubleSided: boolean;
  emissive: Color;
  canvasTexture: HTMLCanvasElement | null;
  foliage: boolean;
  treeBillboard: boolean;
  glTexture: WebGLTexture | null = null;
  textureNeedsUpdate = true;

  constructor(opts: MaterialOptions = {}) {
    this.shaderType = opts.shaderType || 'pbr';
    this.color = new Color(opts.color !== undefined ? opts.color : 0xffffff);
    this.roughness = opts.roughness !== undefined ? opts.roughness : 0.45;
    this.metalness = opts.metalness !== undefined ? opts.metalness : 0.05;
    this.clearcoat = opts.clearcoat !== undefined ? opts.clearcoat : 0.0;
    this.opacity = opts.opacity !== undefined ? opts.opacity : 1.0;
    this.transparent = opts.transparent || this.opacity < 0.999;
    this.doubleSided = opts.doubleSided || false;
    this.emissive = new Color(opts.emissive !== undefined ? opts.emissive : 0x000000);
    this.canvasTexture = opts.canvasTexture || null;
    this.foliage = opts.foliage || false;
    this.treeBillboard = opts.treeBillboard || false;
  }
}

export class Mesh extends Object3D {
  geometry: BufferGeometry;
  material: Material;
  constructor(geometry: BufferGeometry, material: Material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}

export class InstancedMesh extends Mesh {
  count: number;
  instanceMatrices: Float32Array;
  instanceColors: Float32Array;
  instanceMatrixBuffer: WebGLBuffer | null = null;
  instanceColorBuffer: WebGLBuffer | null = null;
  needsInstanceUpload = true;

  constructor(geometry: BufferGeometry, material: Material, count: number) {
    super(geometry, material);
    this.count = count;
    this.instanceMatrices = new Float32Array(count * 16);
    this.instanceColors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.instanceMatrices[i * 16 + 0] = 1;
      this.instanceMatrices[i * 16 + 5] = 1;
      this.instanceMatrices[i * 16 + 10] = 1;
      this.instanceMatrices[i * 16 + 15] = 1;
      this.instanceColors[i * 3 + 0] = 1;
      this.instanceColors[i * 3 + 1] = 1;
      this.instanceColors[i * 3 + 2] = 1;
    }
  }
  setMatrixAt(index: number, matrix: Matrix4): void {
    if (index < 0 || index >= this.count) return;
    this.instanceMatrices.set(matrix.elements, index * 16);
    this.needsInstanceUpload = true;
  }
  setColorAt(index: number, color: Color): void {
    if (index < 0 || index >= this.count) return;
    this.instanceColors[index * 3 + 0] = color.r;
    this.instanceColors[index * 3 + 1] = color.g;
    this.instanceColors[index * 3 + 2] = color.b;
    this.needsInstanceUpload = true;
  }
}

/**
 * Các hàm dựng hình học 3D chuẩn kỹ thuật (Lofted Fuselage, NACA Airfoil Wing, Box, Cylinder, Cone, Sphere)
 */
export const GeometryBuilder = {
  computeVertexNormals(positions: Float32Array, indices: Uint16Array | Uint32Array): Float32Array {
    const normals = new Float32Array(positions.length);
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;
      const ax = positions[i0], ay = positions[i0 + 1], az = positions[i0 + 2];
      const bx = positions[i1], by = positions[i1 + 1], bz = positions[i1 + 2];
      const cx = positions[i2], cy = positions[i2 + 1], cz = positions[i2 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      normals[i0] += nx; normals[i0 + 1] += ny; normals[i0 + 2] += nz;
      normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
      normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
    }
    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.sqrt(normals[i] * normals[i] + normals[i + 1] * normals[i + 1] + normals[i + 2] * normals[i + 2]);
      if (len > 1e-7) {
        normals[i] /= len;
        normals[i + 1] /= len;
        normals[i + 2] /= len;
      } else {
        normals[i + 1] = 1;
      }
    }
    return normals;
  },

  createBox(w: number, h: number, d: number, ox = 0, oy = 0, oz = 0): BufferGeometry {
    const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
    const x0 = ox - hw, x1 = ox + hw;
    const y0 = oy - hh, y1 = oy + hh;
    const z0 = oz - hd, z1 = oz + hd;
    const pos = new Float32Array([
      // Front (+Z)
      x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1,
      // Back (-Z)
      x1, y0, z0,  x0, y0, z0,  x0, y1, z0,  x1, y1, z0,
      // Top (+Y)
      x0, y1, z1,  x1, y1, z1,  x1, y1, z0,  x0, y1, z0,
      // Bottom (-Y)
      x0, y0, z0,  x1, y0, z0,  x1, y0, z1,  x0, y0, z1,
      // Right (+X)
      x1, y0, z1,  x1, y0, z0,  x1, y1, z0,  x1, y1, z1,
      // Left (-X)
      x0, y0, z0,  x0, y0, z1,  x0, y1, z1,  x0, y1, z0
    ]);
    const norm = new Float32Array([
      0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
      1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0
    ]);
    const uvs = new Float32Array([
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1
    ]);
    const indices = new Uint16Array(36);
    for (let f = 0; f < 6; f++) {
      const b = f * 4;
      const idx = f * 6;
      indices[idx] = b; indices[idx + 1] = b + 1; indices[idx + 2] = b + 2;
      indices[idx + 3] = b; indices[idx + 4] = b + 2; indices[idx + 5] = b + 3;
    }
    return new BufferGeometry({ positions: pos, normals: norm, uvs, indices });
  },

  createPlane(w: number, h: number, segX = 1, segY = 1, vertical = false): BufferGeometry {
    const vCount = (segX + 1) * (segY + 1);
    const positions = new Float32Array(vCount * 3);
    const normals = new Float32Array(vCount * 3);
    const uvs = new Float32Array(vCount * 2);
    const indices = vCount > 65535 ? new Uint32Array(segX * segY * 6) : new Uint16Array(segX * segY * 6);

    let pIdx = 0, uIdx = 0;
    for (let iy = 0; iy <= segY; iy++) {
      const v = iy / segY;
      for (let ix = 0; ix <= segX; ix++) {
        const u = ix / segX;
        if (vertical) {
          positions[pIdx] = (u - 0.5) * w;
          positions[pIdx + 1] = (0.5 - v) * h;
          positions[pIdx + 2] = 0;
          normals[pIdx] = 0;
          normals[pIdx + 1] = 0;
          normals[pIdx + 2] = 1;
        } else {
          positions[pIdx] = (u - 0.5) * w;
          positions[pIdx + 1] = 0;
          positions[pIdx + 2] = (v - 0.5) * h;
          normals[pIdx] = 0;
          normals[pIdx + 1] = 1;
          normals[pIdx + 2] = 0;
        }
        uvs[uIdx] = u;
        uvs[uIdx + 1] = 1 - v;
        pIdx += 3;
        uIdx += 2;
      }
    }

    let iIdx = 0;
    for (let iy = 0; iy < segY; iy++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = ix + (segX + 1) * iy;
        const b = ix + (segX + 1) * (iy + 1);
        const c = (ix + 1) + (segX + 1) * (iy + 1);
        const d = (ix + 1) + (segX + 1) * iy;
        indices[iIdx++] = a; indices[iIdx++] = b; indices[iIdx++] = d;
        indices[iIdx++] = b; indices[iIdx++] = c; indices[iIdx++] = d;
      }
    }
    return new BufferGeometry({ positions, normals, uvs, indices });
  },

  createCylinder(rTop: number, rBot: number, height: number, radialSegs = 16, axis: 'x' | 'y' | 'z' = 'y'): BufferGeometry {
    const pos: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const halfH = height * 0.5;

    const pushCoord = (x: number, y: number, z: number) => {
      if (axis === 'y') pos.push(x, y, z);
      else if (axis === 'z') pos.push(x, z, -y);
      else pos.push(y, x, z);
    };

    for (let y = 0; y <= 1; y++) {
      const v = y;
      const r = y === 0 ? rBot : rTop;
      const py = (y - 0.5) * height;
      for (let i = 0; i <= radialSegs; i++) {
        const u = i / radialSegs;
        const theta = u * Math.PI * 2;
        pushCoord(Math.cos(theta) * r, py, Math.sin(theta) * r);
        uvs.push(u, v);
      }
    }

    const ring = radialSegs + 1;
    for (let i = 0; i < radialSegs; i++) {
      const a = i;
      const b = i + ring;
      const c = i + ring + 1;
      const d = i + 1;
      indices.push(a, d, b, b, d, c);
    }

    // Nắp trên và dưới
    if (rBot > 0) {
      const centerIdx = pos.length / 3;
      pushCoord(0, -halfH, 0);
      uvs.push(0.5, 0.5);
      for (let i = 0; i <= radialSegs; i++) {
        const theta = (i / radialSegs) * Math.PI * 2;
        pushCoord(Math.cos(theta) * rBot, -halfH, Math.sin(theta) * rBot);
        uvs.push(0.5, 0.5);
      }
      for (let i = 0; i < radialSegs; i++) {
        indices.push(centerIdx, centerIdx + 1 + i, centerIdx + 2 + i);
      }
    }
    if (rTop > 0) {
      const centerIdx = pos.length / 3;
      pushCoord(0, halfH, 0);
      uvs.push(0.5, 0.5);
      for (let i = 0; i <= radialSegs; i++) {
        const theta = (i / radialSegs) * Math.PI * 2;
        pushCoord(Math.cos(theta) * rTop, halfH, Math.sin(theta) * rTop);
        uvs.push(0.5, 0.5);
      }
      for (let i = 0; i < radialSegs; i++) {
        indices.push(centerIdx, centerIdx + 2 + i, centerIdx + 1 + i);
      }
    }

    const posArr = new Float32Array(pos);
    const idxArr = new Uint16Array(indices);
    const normArr = this.computeVertexNormals(posArr, idxArr);
    return new BufferGeometry({ positions: posArr, normals: normArr, uvs: new Float32Array(uvs), indices: idxArr });
  },

  /**
   * Tạo hình học Lofted Fuselage qua một chuỗi các mặt cắt dọc trục Z
   * Mỗi mặt cắt: { z, w, hTop, hBot, yCenter, roundness }
   */
  createLoftedSections(
    sections: Array<{ z: number; rx: number; ryTop: number; ryBot: number; yOffset: number; power?: number }>,
    radialSegs = 24
  ): BufferGeometry {
    const pos: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const ring = radialSegs + 1;

    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s];
      const v = s / Math.max(1, sections.length - 1);
      const p = sec.power || 1.0; // p < 1 làm tiết diện hơi vuông kiểu thân Cessna
      for (let i = 0; i <= radialSegs; i++) {
        const u = i / radialSegs;
        const theta = u * Math.PI * 2;
        const ct = Math.cos(theta);
        const st = Math.sin(theta);
        const sx = Math.sign(ct) * Math.pow(Math.abs(ct), p) * sec.rx;
        const ry = st >= 0 ? sec.ryTop : sec.ryBot;
        const sy = sec.yOffset + Math.sign(st) * Math.pow(Math.abs(st), p) * ry;
        pos.push(sx, sy, sec.z);
        uvs.push(u, v);
      }
    }

    for (let s = 0; s < sections.length - 1; s++) {
      for (let i = 0; i < radialSegs; i++) {
        const a = s * ring + i;
        const b = (s + 1) * ring + i;
        const c = (s + 1) * ring + i + 1;
        const d = s * ring + i + 1;
        indices.push(a, b, d, b, c, d);
      }
    }

    const posArr = new Float32Array(pos);
    const idxArr = new Uint16Array(indices);
    const normArr = this.computeVertexNormals(posArr, idxArr);
    return new BufferGeometry({ positions: posArr, normals: normArr, uvs: new Float32Array(uvs), indices: idxArr });
  },

  /**
   * Tạo cánh có tiết diện khí động học NACA 2412 thật (mặt trên cong dày hơn mặt dưới)
   */
  createAirfoilWing(
    span: number,
    rootChord: number,
    tipChord: number,
    thicknessRatio = 0.12,
    dihedralRise = 0.16,
    sweepBack = 0.12,
    spanSegs = 12,
    profileSegs = 20
  ): BufferGeometry {
    const sections: Array<{ x: number; y: number; zLead: number; chord: number; thick: number }> = [];
    const halfSpan = span * 0.5;
    for (let is = -spanSegs; is <= spanSegs; is++) {
      const t = is / spanSegs; // -1 -> 1
      const absT = Math.abs(t);
      const x = t * halfSpan;
      // Cessna 172 có phần cánh trong từ x=0 đến 2.4m giữ nguyên dây cung, phần ngoài thuôn dần
      const taperFactor = absT < 0.45 ? 0 : (absT - 0.45) / 0.55;
      const chord = MathUtils.lerp(rootChord, tipChord, taperFactor);
      const tipRound = absT > 0.96 ? Math.sqrt(Math.max(0.05, 1 - Math.pow((absT - 0.96) / 0.04, 2))) : 1.0;
      const y = absT * dihedralRise;
      const zLead = -chord * 0.35 + taperFactor * sweepBack;
      sections.push({ x, y, zLead, chord: chord * tipRound, thick: chord * thicknessRatio * tipRound });
    }

    const pos: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const ring = profileSegs + 1;

    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s];
      const uSpan = s / (sections.length - 1);
      for (let i = 0; i <= profileSegs; i++) {
        const theta = (i / profileSegs) * Math.PI * 2;
        // NACA airfoil parameterization: xc từ 0 (mép trước) -> 1 (mép sau)
        const xc = 0.5 * (1 - Math.cos(theta));
        const yt = 5 * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc + 0.2843 * xc * xc * xc - 0.1036 * Math.pow(xc, 4));
        // Camber NACA 2412
        const yc = xc < 0.4 ? (0.02 / 0.16) * (2 * 0.4 * xc - xc * xc) : (0.02 / 0.36) * ((1 - 0.8) + 0.8 * xc - xc * xc);
        const sign = Math.sin(theta) >= 0 ? 1 : -1;
        const py = sec.y + (yc * sec.chord + sign * yt * sec.thick);
        const pz = sec.zLead + xc * sec.chord;
        pos.push(sec.x, py, pz);
        uvs.push(uSpan, xc);
      }
    }

    for (let s = 0; s < sections.length - 1; s++) {
      for (let i = 0; i < profileSegs; i++) {
        const a = s * ring + i;
        const b = (s + 1) * ring + i;
        const c = (s + 1) * ring + i + 1;
        const d = s * ring + i + 1;
        indices.push(a, d, b, b, d, c);
      }
    }

    const posArr = new Float32Array(pos);
    const idxArr = new Uint16Array(indices);
    const normArr = this.computeVertexNormals(posArr, idxArr);
    return new BufferGeometry({ positions: posArr, normals: normArr, uvs: new Float32Array(uvs), indices: idxArr });
  },

  /**
   * Gộp nhiều BufferGeometry có màu đỉnh riêng thành 1 BufferGeometry duy nhất (dùng cho Instanced Pine Tree / Buildings)
   */
  mergeWithColors(parts: Array<{ geo: BufferGeometry; color: Color; offset?: Vector3 }>): BufferGeometry {
    let totalVerts = 0;
    let totalIndices = 0;
    for (const p of parts) {
      totalVerts += p.geo.vertexCount;
      totalIndices += p.geo.indexCount;
    }
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const colors = new Float32Array(totalVerts * 3);
    const indices = totalVerts > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

    let vBase = 0;
    let iBase = 0;
    for (const p of parts) {
      const ox = p.offset ? p.offset.x : 0;
      const oy = p.offset ? p.offset.y : 0;
      const oz = p.offset ? p.offset.z : 0;
      for (let i = 0; i < p.geo.vertexCount; i++) {
        positions[(vBase + i) * 3 + 0] = p.geo.positions[i * 3 + 0] + ox;
        positions[(vBase + i) * 3 + 1] = p.geo.positions[i * 3 + 1] + oy;
        positions[(vBase + i) * 3 + 2] = p.geo.positions[i * 3 + 2] + oz;
        normals[(vBase + i) * 3 + 0] = p.geo.normals[i * 3 + 0];
        normals[(vBase + i) * 3 + 1] = p.geo.normals[i * 3 + 1];
        normals[(vBase + i) * 3 + 2] = p.geo.normals[i * 3 + 2];
        uvs[(vBase + i) * 2 + 0] = p.geo.uvs[i * 2 + 0];
        uvs[(vBase + i) * 2 + 1] = p.geo.uvs[i * 2 + 1];
        colors[(vBase + i) * 3 + 0] = p.color.r;
        colors[(vBase + i) * 3 + 1] = p.color.g;
        colors[(vBase + i) * 3 + 2] = p.color.b;
      }
      if (p.geo.indices) {
        for (let i = 0; i < p.geo.indices.length; i++) {
          indices[iBase + i] = p.geo.indices[i] + vBase;
        }
        iBase += p.geo.indices.length;
      }
      vBase += p.geo.vertexCount;
    }
    return new BufferGeometry({ positions, normals, uvs, colors, indices });
  }
};

interface CompiledProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

/**
 * Bộ kết xuất WebGL 2 chính (hỗ trợ Shadow Map, Instancing, PBR, Terrain, Water, Cloud, Sky)
 */
export class WebGLRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  backendName = 'WebGL 2.0 (GLSL ES 3.00 PBR)';
  webgpuSupported = false;
  renderWidth = 1280;
  renderHeight = 720;
  outputWidth = 1280;
  outputHeight = 720;
  shadowMapSize = 2048;

  gpuTimer: GpuTimer;
  dynamicScale = 1;
  reflectionLimit = 960;
  private cameraEffects: CameraEffects;
  cinematic = true;
  sharpen = true;

  private programs: Record<string, CompiledProgram> = {};
  private shadowProgram!: CompiledProgram;
  private shadowInstancedProgram!: CompiledProgram;
  private shadowFbo: WebGLFramebuffer | null = null;
  private shadowDepthTex: WebGLTexture | null = null;

  sunDirection = new Vector3(0.58, 0.46, -0.67).normalize();
  sunColor = new Color(0xfff4df);
  skyZenithColor = new Color(0x2a6bc4);
  skyHorizonColor = new Color(0xc4dff6);
  groundAmbientColor = new Color(0x3a4d39);
  fogColor = new Color(0xc4dff6);
  fogDensity = 0.00011;
  cloudImmersion = 0.0;
  waterWaveLayers = 4;
  enablePostGrading = true;
  elapsedTime = 0;
  cloudCover = 0.38;
  rain = 0;
  private reflectionCamera: PerspectiveCamera;
  private reflectionFbo: WebGLFramebuffer;
  private reflectionTexture: WebGLTexture;
  private reflectionDepth: WebGLRenderbuffer;
  private reflectionWidth = 0;
  private reflectionHeight = 0;
  private reflectionPass = false;
  private reflectionMatrix = new Matrix4();
  private terrainTextures: WebGLTexture[] = [];
  private terrainMaterialsReady = false;
  private foliageTextures: WebGLTexture[] = [];
  private foliageReady = false;
  private terrainHeightTexture: WebGLTexture | null = null;
  private treeAtlas: WebGLTexture | null = null;
  private treePrototype: Mesh | null = null;
  private treeAtlasDirty = true;
  private bakingTree = false;
  private waterCenter = new Vector3();

  private lightViewMatrix = new Matrix4();
  private lightProjMatrix = new Matrix4();
  private lightSpaceMatrix = new Matrix4();
  private tempLightEye = new Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.webgpuSupported = typeof navigator !== 'undefined' && 'gpu' in navigator;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    if (!gl) {
      throw new Error('Trình duyệt không hỗ trợ WebGL 2.0.');
    }
    this.gl = gl;
    const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rawGpu = String((dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || "OpenGL ES 3.0");
    const shortGpu = rawGpu.includes("SwiftShader") ? "ANGLE SwiftShader" : rawGpu.replace(/ANGLE \(([^,]+),\s*([^()]+).*\)/, "$1 $2").slice(0, 28);
    this.backendName = `WebGL 2.0 (${shortGpu})`;

    this.gpuTimer = new GpuTimer(gl);
    this.reflectionCamera = new PerspectiveCamera();
    this.reflectionFbo = gl.createFramebuffer()!;
    this.reflectionTexture = gl.createTexture()!;
    this.reflectionDepth = gl.createRenderbuffer()!;
    this.cameraEffects = new CameraEffects(gl);
    this.initTerrainMaterials();
    this.initFoliageMaterials();
    this.initShaders();
    this.initShadowMap(this.shadowMapSize);
  }

  setForestGeometry(geometry: BufferGeometry): void {
    this.treePrototype = new Mesh(geometry, new Material({ foliage: true, doubleSided: true, roughness: 0.97, metalness: 0 }));
    this.treeAtlasDirty = true;
  }

  invalidateForestAtlas(): void { this.treeAtlasDirty = true; }

  private updateForestAtlas(): void {
    if (!this.treePrototype || !this.foliageReady || !this.treeAtlasDirty) return;
    const gl = this.gl, width = 256, height = 512;
    if (!this.treeAtlas) this.treeAtlas = gl.createTexture();
    const framebuffer = gl.createFramebuffer(), depth = gl.createRenderbuffer();
    gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, this.treeAtlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.treeAtlas, 0);
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Không dựng được hình cây ở xa.');
    gl.viewport(0, 0, width, height); gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const camera = new PerspectiveCamera(36, 0.5, 0.1, 100);
    camera.position.set(0, 7, 24); camera.lookAt(new Vector3(0, 7, 0));
    this.bakingTree = true; this.drawMesh(this.treePrototype, camera); this.bakingTree = false;
    gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, this.treeAtlas); gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(framebuffer); gl.deleteRenderbuffer(depth);
    gl.activeTexture(gl.TEXTURE0); this.treeAtlasDirty = false;
  }

  setTerrainHeightField(sampleHeight: (x: number, z: number) => number): void {
    const gl = this.gl, size = 512;
    const heights = new Float32Array(size * size);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      heights[z * size + x] = sampleHeight((x / (size - 1) - 0.5) * 64000, (z / (size - 1) - 0.5) * 64000);
    }
    if (!this.terrainHeightTexture) this.terrainHeightTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, this.terrainHeightTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, size, size, 0, gl.RED, gl.FLOAT, heights);
    const filtering = gl.getExtension('OES_texture_float_linear') ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
  }

  private initFoliageMaterials(): void {
    const gl = this.gl;
    let loaded = 0;
    for (const [index, filename] of ['pine-twig-color.png', 'pine-twig-alpha.png'].entries()) {
      const texture = gl.createTexture()!; this.foliageTextures.push(texture);
      gl.activeTexture(gl.TEXTURE7 + index); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.generateMipmap(gl.TEXTURE_2D);
      const image = new Image();
      image.onload = () => {
        gl.activeTexture(gl.TEXTURE7 + index); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); gl.generateMipmap(gl.TEXTURE_2D);
        gl.activeTexture(gl.TEXTURE0); this.foliageReady = ++loaded === 2;
      };
      image.src = new URL(`assets/foliage/${filename}`, document.baseURI).href;
    }
    gl.activeTexture(gl.TEXTURE0);
  }

  private initTerrainMaterials(): void {
    const gl = this.gl;
    const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
    let loaded = 0;
    for (const [index, filename] of ['grass-color.jpg', 'rock-color.jpg', 'rock-normal.jpg'].entries()) {
      const texture = gl.createTexture()!;
      this.terrainTextures.push(texture);
      gl.activeTexture(gl.TEXTURE4 + index); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(index === 2 ? [128, 128, 255, 255] : [128, 128, 128, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.generateMipmap(gl.TEXTURE_2D);
      if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      const image = new Image();
      image.onload = () => {
        gl.activeTexture(gl.TEXTURE4 + index); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.activeTexture(gl.TEXTURE0);
        this.terrainMaterialsReady = ++loaded === 3;
      };
      image.src = new URL(`assets/materials/${filename}`, document.baseURI).href;
    }
    gl.activeTexture(gl.TEXTURE0);
  }

  setSize(outputW: number, outputH: number, renderScale: number, maxDpr: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.outputWidth = Math.round(outputW * dpr);
    this.outputHeight = Math.round(outputH * dpr);
    const targetScale = (maxDpr === 4 ? Math.min(3840 / outputW, 2160 / outputH) : dpr * renderScale) * this.dynamicScale;
    const maxTexture = this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE);
    const scale = Math.min(targetScale, maxTexture / outputW, maxTexture / outputH, 3840 / outputW, 2160 / outputH);
    this.renderWidth = Math.max(1, Math.round(outputW * scale));
    this.renderHeight = Math.max(1, Math.round(outputH * scale));
    this.canvas.width = this.renderWidth;
    this.canvas.height = this.renderHeight;
  }

  setShadowMapSize(size: number): void {
    if (this.shadowMapSize === size && this.shadowFbo) return;
    this.shadowMapSize = size;
    this.initShadowMap(size);
  }

  private initShadowMap(size: number): void {
    const gl = this.gl;
    if (this.shadowFbo) gl.deleteFramebuffer(this.shadowFbo);
    if (this.shadowDepthTex) gl.deleteTexture(this.shadowDepthTex);

    const depthTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.shadowDepthTex = depthTex;
    this.shadowFbo = fbo;
  }

  private compileShader(vsSource: string, fsSource: string, uniformNames: string[]): CompiledProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error('Shader compile: ' + gl.getShaderInfoLog(s));
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Shader link: ' + gl.getProgramInfoLog(program));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms };
  }

  private initShaders(): void {
    const commonUniforms = [
      'uModel', 'uView', 'uProj', 'uLightSpace',
      'uTreeBillboard', 'uTreeAtlas', 'uBakingTree',
      'uCameraPos', 'uSunDir', 'uSunColor', 'uSkyZenith', 'uSkyHorizon', 'uGroundColor',
      'uFogColor', 'uFogDensity', 'uCloudImmersion', 'uTime',
      'uBaseColor', 'uRoughness', 'uMetalness', 'uClearcoat', 'uOpacity', 'uEmissive',
      'uTerrainHeightField', 'uNeedlesColor', 'uNeedlesAlpha', 'uFoliage', 'uGrassColor', 'uRockColor', 'uRockNormal', 'uTerrainMaterials', 'uWaterCenter', 'uReflection', 'uReflectionMatrix', 'uClipWater', 'uCloudCover', 'uRain', 'uShadowMap', 'uTex', 'uUseVertexColor', 'uWaveLayers', 'uPostGrading'
    ];

    // 1. Shadow Pass Shaders (Standard & Instanced)
    const shadowVS = `#version 300 es
      layout(location = 0) in vec3 aPosition;
      uniform mat4 uModel;
      uniform mat4 uLightSpace;
      void main() {
        gl_Position = uLightSpace * uModel * vec4(aPosition, 1.0);
      }
    `;
    const shadowInstVS = `#version 300 es
      layout(location = 0) in vec3 aPosition;
      layout(location = 4) in vec4 aInstRow0;
      layout(location = 5) in vec4 aInstRow1;
      layout(location = 6) in vec4 aInstRow2;
      layout(location = 7) in vec4 aInstRow3;
      uniform mat4 uLightSpace;
      void main() {
        mat4 instMat = mat4(aInstRow0, aInstRow1, aInstRow2, aInstRow3);
        gl_Position = uLightSpace * instMat * vec4(aPosition, 1.0);
      }
    `;
    const shadowFS = `#version 300 es
      precision highp float;
      void main() {}
    `;
    this.shadowProgram = this.compileShader(shadowVS, shadowFS, ['uModel', 'uLightSpace']);
    this.shadowInstancedProgram = this.compileShader(shadowInstVS, shadowFS, ['uLightSpace']);

    // Shared GLSL Functions (Shadow PCF + Fog + ACES ToneMapping)
    const glslCommonFS = `
      uniform vec3 uCameraPos;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyHorizon;
      uniform vec3 uGroundColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uCloudImmersion;
      uniform float uTime;
      uniform float uPostGrading;
      uniform sampler2D uShadowMap;
      uniform float uCloudCover;
      uniform float uRain;
      uniform float uClipWater;

      float atmosphereHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float atmosphereNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(atmosphereHash(i), atmosphereHash(i + vec2(1, 0)), f.x), mix(atmosphereHash(i + vec2(0, 1)), atmosphereHash(i + vec2(1, 1)), f.x), f.y);
      }
      float cloudField(vec2 p) {
        float density = 0.0, amplitude = 0.52;
        mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          density += atmosphereNoise(p) * amplitude;
          p = rotation * p * 2.03 + 11.7;
          amplitude *= 0.48;
        }
        return density;
      }
      vec3 atmosphericSky(vec3 dir) {
        float y = max(dir.y, 0.0);
        float sunCos = max(0.0, dot(dir, normalize(uSunDir)));
        vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(y, 0.45));
        sky += uSunColor * pow(sunCos, 10.0) * 0.2;
        sky += uSunColor * smoothstep(0.99965, 0.99996, sunCos) * 6.0;
        if (dir.y > 0.012) {
          vec2 p = (uCameraPos.xz + dir.xz * (1800.0 - uCameraPos.y) / max(dir.y, 0.045)) * 0.00024 + vec2(uTime * 0.003, uTime * 0.001);
          float field = cloudField(p);
          float threshold = mix(0.72, 0.22, uCloudCover);
          float density = smoothstep(threshold - 0.08, threshold + 0.12, field);
          float heightShade = cloudField(p + uSunDir.xz * 0.12);
          float lighting = clamp(0.5 + (field - heightShade) * 5.0, 0.0, 1.0);
          vec3 dark = mix(uSkyHorizon * 0.48, vec3(0.17, 0.2, 0.25), uRain);
          vec3 bright = uSkyHorizon * 0.5 + uSunColor * 0.8;
          vec3 cloud = mix(dark, bright, lighting);
          cloud += uSunColor * pow(sunCos, 18.0) * pow(1.0 - density, 3.0) * 0.65;
          density *= smoothstep(0.012, 0.13, dir.y);
          sky = mix(sky, cloud, density);
        }
        return dir.y < 0.0 ? mix(uSkyHorizon, uFogColor * 0.8, clamp(-dir.y * 3.0, 0.0, 1.0)) : sky;
      }

      float calcShadow(vec4 lightSpacePos, vec3 N) {
        vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
        projCoords = projCoords * 0.5 + 0.5;
        if (projCoords.z > 0.999 || projCoords.x < 0.001 || projCoords.x > 0.999 || projCoords.y < 0.001 || projCoords.y > 0.999) {
          return 1.0;
        }
        float bias = max(0.0022 * (1.0 - dot(N, uSunDir)), 0.0006);
        float shadow = 0.0;
        vec2 texelSize = 1.0 / vec2(textureSize(uShadowMap, 0));
        for(int x = -1; x <= 1; ++x) {
          for(int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(uShadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += (projCoords.z - bias > pcfDepth) ? 0.25 : 1.0;
          }
        }
        return shadow / 9.0;
      }

      vec3 applyAtmosphericFog(vec3 color, vec3 worldPos) {
        vec3 toCam = worldPos - uCameraPos;
        float dist = length(toCam);
        vec3 viewDir = toCam / max(dist, 0.001);
        float startHeight = max(0.0, uCameraPos.y);
        float endHeight = max(0.0, worldPos.y);
        float heightDelta = (endHeight - startHeight) * 0.0012;
        float integratedDensity = abs(heightDelta) < 0.001 ? exp(-startHeight * 0.0012) : (exp(-startHeight * 0.0012) - exp(-endHeight * 0.0012)) / heightDelta;
        float fogFactor = 1.0 - exp(-dist * uFogDensity * (0.35 + integratedDensity * 0.9));
        fogFactor = clamp(fogFactor, 0.0, 0.94);

        float sunAlign = max(0.0, dot(viewDir, uSunDir));
        vec3 atmoColor = mix(uFogColor, uSunColor, pow(sunAlign, 18.0) * 0.3 * (1.0 - uRain * 0.8));
        vec3 res = mix(color, atmoColor, fogFactor);
        // Hiệu ứng bay xuyên qua mây: giảm tầm nhìn mượt, không chuyển đột ngột
        if (uCloudImmersion > 0.001) {
          vec3 cloudMist = mix(uFogColor, vec3(0.95, 0.97, 1.0), 0.65);
          res = mix(res, cloudMist, clamp(uCloudImmersion * 0.86, 0.0, 0.88));
        }
        return res;
      }

      vec3 acesToneMapping(vec3 x) {
        if (uPostGrading < 0.5) {
          return pow(clamp(x, 0.0, 1.0), vec3(1.0 / 2.2));
        }
        const float a = 2.51;
        const float b = 0.03;
        const float c = 2.43;
        const float d = 0.59;
        const float e = 0.14;
        vec3 mapped = clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        return pow(mapped, vec3(1.0 / 2.2));
      }
    `;

    // 2. Standard PBR Shader (cho máy bay, buồng lái, nhà cửa)
    const pbrVS = `#version 300 es
      layout(location = 0) in vec3 aPosition;
      layout(location = 1) in vec3 aNormal;
      layout(location = 2) in vec2 aUv;
      layout(location = 3) in vec3 aColor;

      uniform mat4 uModel;
      uniform mat4 uView;
      uniform mat4 uProj;
      uniform mat4 uLightSpace;

      out vec3 vWorldPos;
      out vec3 vNormal;
      out vec2 vUv;
      out vec3 vColor;
      out vec4 vLightSpacePos;

      void main() {
        vec4 worldPos = uModel * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(uModel) * aNormal);
        vUv = aUv;
        vColor = aColor;
        vLightSpacePos = uLightSpace * worldPos;
        gl_Position = uProj * uView * worldPos;
      }
    `;

    const pbrInstVS = `#version 300 es
      layout(location = 0) in vec3 aPosition;
      layout(location = 1) in vec3 aNormal;
      layout(location = 2) in vec2 aUv;
      layout(location = 3) in vec3 aColor;
      layout(location = 4) in vec4 aInstRow0;
      layout(location = 5) in vec4 aInstRow1;
      layout(location = 6) in vec4 aInstRow2;
      layout(location = 7) in vec4 aInstRow3;
      layout(location = 8) in vec3 aInstColor;

      uniform mat4 uView;
      uniform mat4 uProj;
      uniform mat4 uLightSpace;
      uniform vec3 uCameraPos;
      uniform float uTreeBillboard;

      out vec3 vWorldPos;
      out vec3 vNormal;
      out vec2 vUv;
      out vec3 vColor;
      out vec4 vLightSpacePos;

      void main() {
        mat4 instMat = mat4(aInstRow0, aInstRow1, aInstRow2, aInstRow3);
        vec4 worldPos = instMat * vec4(aPosition, 1.0);
        if (uTreeBillboard > 0.5) {
          vec3 center = instMat[3].xyz;
          vec3 right = normalize(vec3(uCameraPos.z - center.z, 0.0, center.x - uCameraPos.x));
          worldPos.xyz = center + right * aPosition.x * length(instMat[0].xyz) + vec3(0.0, aPosition.y * length(instMat[1].xyz), 0.0);
        }
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(instMat) * aNormal);
        vUv = aUv;
        vColor = aColor * aInstColor;
        vLightSpacePos = uLightSpace * worldPos;
        gl_Position = uProj * uView * worldPos;
      }
    `;

    const pbrFS = `#version 300 es
      precision highp float;
      in vec3 vWorldPos;
      in vec3 vNormal;
      in vec2 vUv;
      in vec3 vColor;
      in vec4 vLightSpacePos;

      uniform vec3 uBaseColor;
      uniform float uRoughness;
      uniform float uMetalness;
      uniform float uClearcoat;
      uniform float uOpacity;
      uniform vec3 uEmissive;
      uniform float uUseVertexColor;
      uniform float uFoliage;
      uniform float uTreeBillboard;
      uniform float uBakingTree;
      uniform sampler2D uTreeAtlas;
      uniform sampler2D uNeedlesColor;
      uniform sampler2D uNeedlesAlpha;

      ${glslCommonFS}

      out vec4 fragColor;

      void main() {
        if (uClipWater > 0.5 && vWorldPos.y < 0.04) discard;
        if (uTreeBillboard > 0.5) {
          vec4 tree = texture(uTreeAtlas, vUv);
          if (tree.a < 0.035) discard;
          vec3 treeColor = clamp(tree.rgb / max(tree.a, 0.035), 0.0, 1.0);
          vec3 color = applyAtmosphericFog(pow(treeColor, vec3(2.2)), vWorldPos);
          fragColor = vec4(pow(max(color, 0.0), vec3(1.0 / 2.2)), 1.0);
          return;
        }
        vec3 N = normalize(vNormal);
        bool needles = uFoliage > 0.5 && vColor.g > vColor.r * 1.15;
        float foliageCutoff = mix(0.24, 0.035, smoothstep(120.0, 1500.0, length(vWorldPos - uCameraPos)));
        if (needles && texture(uNeedlesAlpha, vUv).r < foliageCutoff) discard;
        if (uFoliage > 0.5 && !gl_FrontFacing) N = -N;
        vec3 V = normalize(uCameraPos - vWorldPos);
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(V + L);

        vec3 albedo = uBaseColor * mix(vec3(1.0), vColor, uUseVertexColor);
        if (needles) albedo = pow(texture(uNeedlesColor, vUv).rgb, vec3(2.2)) * vColor * 2.8;
        float NdotL = max(dot(N, L), 0.0);
        float NdotV = max(dot(N, V), 0.001);
        float NdotH = max(dot(N, H), 0.0);
        float VdotH = max(dot(V, H), 0.0);

        float shadow = uBakingTree > 0.5 ? 1.0 : calcShadow(vLightSpacePos, N);

        // Cook-Torrance GGX approximation
        float alpha = max(0.04, uRoughness * uRoughness);
        float alpha2 = alpha * alpha;
        float denom = (NdotH * NdotH * (alpha2 - 1.0) + 1.0);
        float D = alpha2 / max(3.14159 * denom * denom, 0.0001);

        vec3 F0 = mix(vec3(0.04), albedo, uMetalness);
        vec3 F = F0 + (1.0 - F0) * pow(1.0 - VdotH, 5.0);

        vec3 kD = (vec3(1.0) - F) * (1.0 - uMetalness);
        vec3 diffuse = kD * albedo / 3.14159;
        float geometryK = (uRoughness + 1.0) * (uRoughness + 1.0) / 8.0;
        float geometryL = NdotL / max(0.001, NdotL * (1.0 - geometryK) + geometryK);
        float geometryV = NdotV / max(0.001, NdotV * (1.0 - geometryK) + geometryK);
        vec3 spec = D * F * geometryL * geometryV / max(0.001, 4.0 * NdotL * NdotV);

        // Clearcoat cho sơn máy bay và kính buồng lái
        float ccSpec = pow(NdotH, 96.0) * uClearcoat * 0.45;

        // Ánh sáng bầu trời bán cầu (Hemisphere Ambient) + Phản chiếu môi trường
        float hemiFactor = N.y * 0.5 + 0.5;
        vec3 envAmbient = mix(uGroundColor, mix(uSkyHorizon, uSkyZenith, 0.45), hemiFactor) * 0.55;
        vec3 R = reflect(-V, N);
        vec3 envReflect = mix(uGroundColor, mix(uSkyHorizon, uSkyZenith, clamp(R.y, 0.0, 1.0)), smoothstep(-0.15, 0.35, R.y));
        float envFresnel = (0.04 + 0.96 * pow(1.0 - NdotV, 5.0)) * (1.0 - uRoughness * 0.75);

        vec3 color = (diffuse + spec + vec3(ccSpec)) * uSunColor * NdotL * shadow * 2.45;
        color += albedo * envAmbient;
        color += envReflect * (envFresnel + uMetalness * 0.35 + uClearcoat * 0.22);
        color += uEmissive;

        color = applyAtmosphericFog(color, vWorldPos);
        color = acesToneMapping(color);
        fragColor = vec4(color, uOpacity);
      }
    `;

    this.programs['pbr'] = this.compileShader(pbrVS, pbrFS, commonUniforms);
    this.programs['pbr_instanced'] = this.compileShader(pbrInstVS, pbrFS, commonUniforms);

    // 3. Terrain Multi-Biome Shader (với vật liệu phân bổ theo cao độ, độ dốc & detail noise chống lặp)
    const terrainFS = `#version 300 es
      precision highp float;
      in vec3 vWorldPos;
      in vec3 vNormal;
      in vec2 vUv;
      in vec4 vLightSpacePos;

      ${glslCommonFS}

      uniform sampler2D uGrassColor;
      uniform sampler2D uRockColor;
      uniform sampler2D uRockNormal;
      uniform float uTerrainMaterials;
      uniform sampler2D uTerrainHeightField;
      out vec4 fragColor;

      float terrainHeight(vec2 p) { return texture(uTerrainHeightField, p / 64000.0 + 0.5).r; }
      float terrainSunShadow(vec3 point) {
        vec2 direction = normalize(uSunDir.xz);
        float slope = uSunDir.y / max(0.04, length(uSunDir.xz));
        float visibility = 1.0;
        for (int i = 0; i < 11; i++) {
          float distanceSun = 90.0 * pow(1.6, float(i));
          vec2 position = point.xz + direction * distanceSun;
          if (max(abs(position.x), abs(position.y)) > 31900.0) break;
          float clearance = point.y + slope * distanceSun - terrainHeight(position);
          visibility = min(visibility, smoothstep(-25.0, 35.0 + distanceSun * 0.008, clearance + 35.0));
        }
        return mix(0.25, 1.0, visibility);
      }
      float terrainAmbient(vec3 p) {
        float horizon = 0.0;
        for (int i = 0; i < 4; i++) {
          float angle = float(i) * 1.570796;
          vec2 d = vec2(cos(angle), sin(angle)) * 220.0;
          horizon += max(0.0, terrainHeight(p.xz + d) - p.y - 25.0);
        }
        return clamp(exp(-horizon * 0.0015), 0.45, 1.0);
      }
      vec3 untiled(sampler2D imageMap, vec2 uv) {
        vec2 dx = dFdx(uv), dy = dFdy(uv);
        float variation = texture(uGrassColor, uv * 0.006).g * 8.0;
        float tile = floor(variation), blend = fract(variation);
        vec2 a = sin(vec2(3.0, 7.0) * tile) * 3.0;
        vec2 b = sin(vec2(3.0, 7.0) * (tile + 1.0)) * 3.0;
        vec3 ca = textureGrad(imageMap, uv + a, dx, dy).rgb;
        vec3 cb = textureGrad(imageMap, uv + b, dx, dy).rgb;
        return mix(ca, cb, smoothstep(0.2, 0.8, blend));
      }
      vec3 rockColor(vec3 p, vec3 weights) {
        return untiled(uRockColor, p.yz) * weights.x + untiled(uRockColor, p.xz) * weights.y + untiled(uRockColor, p.xy) * weights.z;
      }
      vec3 rockNormal(vec3 p, vec3 weights, vec3 normal) {
        vec3 x = texture(uRockNormal, p.yz).xyz * 2.0 - 1.0;
        vec3 y = texture(uRockNormal, p.xz).xyz * 2.0 - 1.0;
        vec3 z = texture(uRockNormal, p.xy).xyz * 2.0 - 1.0;
        return normalize(vec3(x.z * sign(normal.x), x.x, x.y) * weights.x + vec3(y.x, y.z * sign(normal.y), y.y) * weights.y + vec3(z.x, z.y, z.z * sign(normal.z)) * weights.z);
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 2; i++) {
          v += a * vnoise(p);
          p *= 2.07;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        if (uClipWater > 0.5 && vWorldPos.y < 0.04) discard;
        vec3 N = normalize(vNormal);
        float h = vWorldPos.y;
        float slope = 1.0 - clamp(N.y, 0.0, 1.0);

        // Nhiễu đa tỷ lệ giảm lặp vân (Macro, Meso, Micro)
        float nMacro = fbm(vWorldPos.xz * 0.0018);
        float nMeso = fbm(vWorldPos.xz * 0.016);
        float nMicro = vnoise(vWorldPos.xz * 0.14);

        // Bảng màu địa chất vùng Alps tự nhiên, không quá bão hòa
        vec3 sandGravel = mix(vec3(0.13, 0.12, 0.10), vec3(0.25, 0.23, 0.19), nMeso);
        vec3 lushMeadow = mix(vec3(0.19, 0.33, 0.14), vec3(0.26, 0.39, 0.17), nMacro * 0.7 + nMeso * 0.3);
        vec3 alpineForest = mix(vec3(0.11, 0.22, 0.11), vec3(0.16, 0.27, 0.14), nMeso);
        vec3 graniteRock = mix(vec3(0.28, 0.29, 0.31), vec3(0.43, 0.44, 0.46), fbm(vWorldPos.xz * 0.035 + vec2(h * 0.04)));
        vec3 alpineSnow = mix(vec3(0.86, 0.90, 0.95), vec3(0.96, 0.98, 1.0), nMicro);

        // Chuyển tiếp theo độ cao
        vec3 col = lushMeadow;
        // Sỏi/cát quanh bờ hồ (mực nước hồ y = 0.0) và lòng sông
        float shoreBlend = 1.0 - smoothstep(-0.4, 2.2 + nMeso * 1.8, h);
        col = mix(col, sandGravel, shoreBlend);

        // Sườn rừng thông ở cao độ trung bình (50m -> 480m)
        float forestBlend = smoothstep(35.0, 130.0, h) * (1.0 - smoothstep(420.0, 620.0, h));
        col = mix(col, alpineForest, forestBlend * 0.72);

        // Tuyết trên đỉnh núi cao (từ 560m trở lên, phụ thuộc độ dốc)
        float coastal = smoothstep(6200.0, 9000.0, vWorldPos.x);
        float snowHeight = mix(1450.0, 2600.0, coastal) + nMacro * 280.0;
        float snowBlend = smoothstep(snowHeight, snowHeight + 170.0, h) * (1.0 - smoothstep(0.22, 0.56, slope));

        // Vách đá lộ thiên ở sườn dốc
        float rockMask = smoothstep(0.22 - h * 0.0001, 0.44, slope);
        col = mix(col, graniteRock, rockMask);
        col = mix(col, alpineSnow, snowBlend);

        if (uTerrainMaterials > 0.5) {
          vec3 weights = pow(abs(N), vec3(4.0)); weights /= max(0.001, weights.x + weights.y + weights.z);
          vec3 grass = pow(untiled(uGrassColor, vWorldPos.xz * 0.11), vec3(2.2)) * 1.45;
          vec3 stone = pow(rockColor(vWorldPos * 0.045, weights), vec3(2.2)) * 1.4;
          float vegetation = mix(forestBlend * 0.35, 0.18, coastal);
          grass *= (1.0 - vegetation) * mix(vec3(0.92, 1.0, 0.82), vec3(0.55, 0.97, 0.48), coastal);
          vec3 surface = mix(grass, stone, rockMask);
          surface = mix(surface, sandGravel, shoreBlend * 0.75);
          surface = mix(surface, alpineSnow, snowBlend);
          col = mix(col, surface * (0.85 + nMacro * 0.5), 0.78);
          vec3 detailedNormal = rockNormal(vWorldPos * 0.045, weights, N);
          float fade = 1.0 - smoothstep(500.0, 4500.0, length(vWorldPos - uCameraPos));
          N = normalize(mix(N, detailedNormal, rockMask * fade * 0.45));
        }

        // Kiểm tra khu vực sân bay và đường băng (Runway tại x = 850, z = [-650..650], y = 18m)
        float rx = abs(vWorldPos.x - 850.0);
        float rz = abs(vWorldPos.z - 0.0);
        if (rx < 65.0 && rz < 1240.0) {
          float padMask = (1.0 - smoothstep(34.0, 64.0, rx)) * (1.0 - smoothstep(1150.0, 1230.0, rz));
          col = mix(col, sandGravel * 0.88, padMask * 0.75);
        }

        vec2 detailPos = vWorldPos.xz * 0.32;
        vec2 bump = vec2(vnoise(detailPos + vec2(0.1, 0)) - vnoise(detailPos - vec2(0.1, 0)), vnoise(detailPos + vec2(0, 0.1)) - vnoise(detailPos - vec2(0, 0.1)));
        float detailFade = 1.0 - smoothstep(350.0, 1800.0, length(vWorldPos - uCameraPos));
        N = normalize(N + vec3(-bump.x, 0, -bump.y) * 0.45 * detailFade);
        // Chi tiết vi mô
        col *= (0.98 + 0.04 * nMicro);

        // Chiếu sáng mặt trời + bóng đổ + ánh sáng bầu trời
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(uCameraPos - vWorldPos);
        float NdotL = max(dot(N, L), 0.0);
        float shadow = min(calcShadow(vLightSpacePos, N), terrainSunShadow(vWorldPos));

        float hemi = N.y * 0.5 + 0.5;
        vec3 ambient = mix(uGroundColor * 0.65, mix(uSkyHorizon, uSkyZenith, 0.4), hemi) * 0.38;

        // Tuyết có độ bóng nhẹ dưới nắng
        vec3 H = normalize(L + V);
        float snowSpec = snowBlend * pow(max(dot(N, H), 0.0), 32.0) * 0.28;

        vec3 finalColor = col * (ambient * terrainAmbient(vWorldPos) + uSunColor * NdotL * shadow * 1.95) + uSunColor * snowSpec * shadow;
        finalColor = applyAtmosphericFog(finalColor, vWorldPos);
        finalColor = acesToneMapping(finalColor);
        fragColor = vec4(finalColor, 1.0);
      }
    `;
    this.programs['terrain'] = this.compileShader(pbrVS, terrainFS, commonUniforms);

    // 4. Alpine Lake Water Shader (Chuyển động sóng, Normal biến thiên theo thời gian, Fresnel, nông/sâu, vệt nắng)
    const waterWaves = `
      void swell(vec2 p, float time, float sea, out float height, out vec2 gradient) {
        height = 0.0; gradient = vec2(0.0);
        for (int i = 0; i < 3; i++) {
          float f = float(i), k = 6.2831853 / (170.0 + f * 137.0);
          vec2 direction = vec2(cos(0.6 + f * 1.1), sin(0.6 + f * 1.1));
          float amplitude = (0.16 + sea * 0.62) * pow(0.65, f);
          float phase = dot(p, direction) * k - time * sqrt(9.80665 * k) + f * 2.7;
          height += amplitude * sin(phase);
          gradient += direction * amplitude * k * cos(phase);
        }
      }
    `;
    const waterVS = `#version 300 es
      precision highp float;
      layout(location = 0) in vec3 aPosition;
      uniform mat4 uModel;
      uniform mat4 uView;
      uniform mat4 uProj;
      uniform float uTime;
      uniform float uRoughness;
      out vec3 vWorldPos;
      ${waterWaves}
      void main() {
        vec4 worldPos = uModel * vec4(aPosition, 1.0);
        float height; vec2 gradient;
        swell(worldPos.xz, uTime, smoothstep(6200.0, 9000.0, worldPos.x), height, gradient);
        if (uRoughness < 0.9) worldPos.y += height;
        vWorldPos = worldPos.xyz;
        gl_Position = uProj * uView * worldPos;
      }
    `;

    const waterFS = `#version 300 es
      precision highp float;
      in vec3 vWorldPos;
      uniform sampler2D uReflection;
      uniform mat4 uReflectionMatrix;
      uniform vec2 uWaterCenter;
      uniform float uRoughness;
      ${glslCommonFS}
      ${waterWaves}
      out vec4 fragColor;
      void main() {
        vec2 p = vWorldPos.xz;
        vec2 patchDistance = abs(p - uWaterCenter);
        if (uRoughness > 0.9 && max(patchDistance.x, patchDistance.y) < 4000.0) discard;
        float sea = smoothstep(6200.0, 9000.0, p.x);
        float height; vec2 gradient;
        swell(p, uTime, sea, height, gradient);
        float footprint = length(fwidth(p));
        for (int i = 0; i < 9; i++) {
          float fi = float(i), angle = 0.6 + fi * 2.399963;
          vec2 direction = vec2(cos(angle), sin(angle));
          float frequency = 1.2 * pow(1.57, fi);
          float amplitude = (0.022 + sea * 0.018 + uRain * 0.032) * pow(0.8, fi);
          float phase = dot(p, direction) * frequency - uTime * sqrt(9.80665 * frequency) + fi * 3.73;
          phase += 1.7 * sin(dot(p, vec2(0.023, 0.017)) + fi * 1.71) + 0.8 * cos(dot(p, vec2(0.011, -0.031)) + fi * 2.9);
          gradient += direction * cos(phase) * amplitude * (1.0 - smoothstep(0.65, 2.4, frequency * footprint));
        }
        vec3 N = normalize(vec3(-gradient.x, 1, -gradient.y));
        vec3 V = normalize(uCameraPos - vWorldPos);
        float nv = max(0.001, dot(N, V));
        float fresnel = 0.02037 + 0.97963 * pow(1.0 - nv, 5.0);
        vec4 reflectionPoint = uReflectionMatrix * vec4(vWorldPos, 1);
        vec2 reflectionUv = reflectionPoint.xy / reflectionPoint.w * 0.5 + 0.5;
        reflectionUv += gradient * 0.065;
        vec3 reflected = pow(texture(uReflection, clamp(reflectionUv, 0.001, 0.999)).rgb, vec3(2.2));
        float radial = length((p - vec2(-220, 150)) * vec2(1.0 / 1080.0, 1.0 / 1850.0));
        float shallow = smoothstep(0.65, 1.05, radial);
        vec3 transmitted = mix(vec3(0.010, 0.050, 0.060), vec3(0.025, 0.14, 0.115), shallow);
        transmitted = mix(transmitted, vec3(0.014, 0.105, 0.095), sea);
        vec3 L = normalize(uSunDir), H = normalize(L + V);
        float nh = max(0.0, dot(N, H));
        float roughness = 0.04 + uRain * 0.07 + min(0.1, footprint * 0.004);
        float a2 = roughness * roughness;
        float d = a2 / (3.14159 * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
        vec3 glint = uSunColor * min(3.0, d * 0.009) * max(0.0, L.y);
        vec3 body = applyAtmosphericFog(transmitted + glint, vWorldPos);
        vec3 bodyLinear = pow(acesToneMapping(body), vec3(2.2));
        vec3 color = mix(bodyLinear, reflected, fresnel);
        fragColor = vec4(pow(max(color, 0.0), vec3(1.0 / 2.2)), 1);
      }
    `;
    this.programs['water'] = this.compileShader(waterVS, waterFS, commonUniforms);

    // 5. Sky Dome Shader (Bầu trời đổi màu từ chân trời lên thiên đỉnh + Đĩa mặt trời)
    const skyFS = `#version 300 es
      precision highp float;
      in vec3 vWorldPos;
      ${glslCommonFS}
      out vec4 fragColor;
      void main() {
        vec3 dir = normalize(vWorldPos - uCameraPos);
        fragColor = vec4(acesToneMapping(atmosphericSky(dir)), 1);
      }
    `;
    this.programs['sky'] = this.compileShader(pbrVS, skyFS, commonUniforms);

    // 6. Volumetric-Layered 3D Cloud Shader (Tán xạ ánh sáng mặt trời + đáy mây có chiều sâu + biên mềm)
    const cloudFS = `#version 300 es
      precision highp float;
      in vec3 vWorldPos;
      in vec3 vNormal;
      in vec3 vColor;
      uniform float uOpacity;
      ${glslCommonFS}
      out vec4 fragColor;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(uCameraPos - vWorldPos);
        vec3 L = normalize(uSunDir);

        float topLight = clamp(N.y * 0.55 + 0.45, 0.0, 1.0);
        float sunLight = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        // Tán xạ thuận (Silver-lining forward scattering) khi nhìn về phía mặt trời
        float forwardScatter = pow(max(0.0, dot(-V, L)), 4.0) * 0.45;

        vec3 shadowTone = mix(uSkyHorizon * 0.68, vec3(0.55, 0.62, 0.72), 0.5);
        vec3 litTone = mix(vec3(0.96, 0.97, 0.99), uSunColor, 0.35);

        vec3 col = mix(shadowTone, litTone, clamp(topLight * 0.65 + sunLight * 0.55 + forwardScatter, 0.0, 1.0));
        col *= vColor;

        // Làm mềm biên đám mây theo góc nhìn (Soft Rim Alpha)
        float rim = smoothstep(0.05, 0.55, abs(dot(N, V)));
        float distFade = 1.0 - smoothstep(7500.0, 11500.0, length(vWorldPos - uCameraPos));
        col = applyAtmosphericFog(col, vWorldPos);
        col = acesToneMapping(col);
        fragColor = vec4(col, uOpacity * rim * distFade);
      }
    `;
    this.programs['cloud_instanced'] = this.compileShader(pbrInstVS, cloudFS, commonUniforms);

    // 7. Unlit Texture Shader (cho Mặt đồng hồ Buồng lái 3D sắc nét, dễ đọc)
    const unlitTexFS = `#version 300 es
      precision highp float;
      in vec2 vUv;
      uniform sampler2D uTex;
      uniform float uOpacity;
      out vec4 fragColor;
      void main() {
        vec4 texCol = texture(uTex, vUv);
        fragColor = vec4(texCol.rgb, texCol.a * uOpacity);
      }
    `;
    this.programs['unlit_tex'] = this.compileShader(pbrVS, unlitTexFS, commonUniforms);

    // 8. Propeller Blur Disc Shader (Đĩa mờ cánh quạt mượt mà ở RPM cao, không nhấp nháy)
    const propBlurFS = `#version 300 es
      precision highp float;
      in vec2 vUv;
      uniform float uOpacity;
      uniform float uTime;
      out vec4 fragColor;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0 || r < 0.12) discard;
        float angle = atan(p.y, p.x) + uTime * 38.0;
        float bladeStreak = 0.55 + 0.45 * abs(sin(angle * 2.0));
        float radialFade = (1.0 - smoothstep(0.72, 1.0, r)) * smoothstep(0.12, 0.24, r);
        float ring = smoothstep(0.86, 0.93, r) * (1.0 - smoothstep(0.93, 0.98, r));
        vec3 col = mix(vec3(0.22, 0.24, 0.27), vec3(0.88, 0.90, 0.92), ring * 0.7);
        float alpha = radialFade * bladeStreak * uOpacity;
        fragColor = vec4(col, alpha);
      }
    `;
    this.programs['prop_blur'] = this.compileShader(pbrVS, propBlurFS, commonUniforms);
  }

  private ensureGeometryVAO(geo: BufferGeometry, instancedMesh?: InstancedMesh): void {
    const gl = this.gl;
    if (geo.vao && !geo.needsUpload && (!instancedMesh || !instancedMesh.needsInstanceUpload)) {
      return;
    }
    if (!geo.vao) {
      geo.vao = gl.createVertexArray();
    }
    gl.bindVertexArray(geo.vao);

    if (geo.needsUpload) {
      // Attribute 0: Position
      const posBuf = gl.createBuffer()!;
      geo.gpuBuffers.push(posBuf);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

      // Attribute 1: Normal
      const normBuf = gl.createBuffer()!;
      geo.gpuBuffers.push(normBuf);
      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
      gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

      // Attribute 2: UV
      const uvBuf = gl.createBuffer()!;
      geo.gpuBuffers.push(uvBuf);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, geo.uvs, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

      // Attribute 3: Vertex Color
      if (geo.colors) {
        const colBuf = gl.createBuffer()!;
      geo.gpuBuffers.push(colBuf);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, geo.colors, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(3);
        gl.vertexAttrib3f(3, 1.0, 1.0, 1.0);
      }

      if (geo.indices) {
        const idxBuf = gl.createBuffer()!;
      geo.gpuBuffers.push(idxBuf);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
        geo.indexType = geo.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      }
      geo.needsUpload = false;
    }

    if (instancedMesh && instancedMesh.needsInstanceUpload) {
      if (!instancedMesh.instanceMatrixBuffer) {
        instancedMesh.instanceMatrixBuffer = gl.createBuffer();
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, instancedMesh.instanceMatrixBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, instancedMesh.instanceMatrices, gl.DYNAMIC_DRAW);
      const stride = 16 * 4;
      for (let r = 0; r < 4; r++) {
        const loc = 4 + r;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, stride, r * 16);
        gl.vertexAttribDivisor(loc, 1);
      }

      if (!instancedMesh.instanceColorBuffer) {
        instancedMesh.instanceColorBuffer = gl.createBuffer();
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, instancedMesh.instanceColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, instancedMesh.instanceColors, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(8);
      gl.vertexAttribPointer(8, 3, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(8, 1);

      instancedMesh.needsInstanceUpload = false;
    }

    gl.bindVertexArray(null);
  }

  private ensureMaterialTexture(mat: Material): void {
    if (!mat.canvasTexture) return;
    const gl = this.gl;
    if (!mat.glTexture) {
      mat.glTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, mat.glTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    if (mat.textureNeedsUpdate) {
      gl.bindTexture(gl.TEXTURE_2D, mat.glTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mat.canvasTexture);
      gl.generateMipmap(gl.TEXTURE_2D);
      mat.textureNeedsUpdate = false;
    }
  }

  render(scene: Scene, camera: PerspectiveCamera, shadowFocusTarget: Vector3): void {
    this.waterCenter.copy(shadowFocusTarget);
    this.updateForestAtlas();
    const gl = this.gl;
    this.gpuTimer.begin();
    scene.updateMatrixWorld();

    // Thu thập danh sách Mesh trong Scene Graph
    const opaqueMeshes: Mesh[] = [];
    const transparentMeshes: Mesh[] = [];
    const shadowCasters: Mesh[] = [];
    let skyMesh: Mesh | null = null;

    const traverse = (obj: Object3D) => {
      if (!obj.visible) return;
      if (obj instanceof Mesh) {
        if (obj.material.shaderType === 'sky') {
          skyMesh = obj;
        } else if (obj.material.transparent) {
          transparentMeshes.push(obj);
        } else {
          opaqueMeshes.push(obj);
        }
        if (obj.castShadow) {
          shadowCasters.push(obj);
        }
      }
      for (let i = 0; i < obj.children.length; i++) {
        traverse(obj.children[i]);
      }
    };
    traverse(scene);

    // 1. PASS BÓNG ĐỔ (Shadow Map Pass)
    this.tempLightEye.copy(shadowFocusTarget).addScaledVector(this.sunDirection, 260);
    this.lightViewMatrix.lookAtView(this.tempLightEye, shadowFocusTarget, new Vector3(0, 1, 0));
    const orthoRadius = 190;
    this.lightProjMatrix.makeOrthographic(-orthoRadius, orthoRadius, orthoRadius, -orthoRadius, 10, 680);
    this.lightSpaceMatrix.multiplyMatrices(this.lightProjMatrix, this.lightViewMatrix);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    for (let i = 0; i < shadowCasters.length; i++) {
      const m = shadowCasters[i];
      const isInst = m instanceof InstancedMesh;
      this.ensureGeometryVAO(m.geometry, isInst ? (m as InstancedMesh) : undefined);
      const prog = isInst ? this.shadowInstancedProgram : this.shadowProgram;
      gl.useProgram(prog.program);
      gl.uniformMatrix4fv(prog.uniforms['uLightSpace'], false, this.lightSpaceMatrix.elements);
      if (!isInst) {
        gl.uniformMatrix4fv(prog.uniforms['uModel'], false, m.matrixWorld.elements);
      }
      gl.bindVertexArray(m.geometry.vao);
      if (isInst) {
        const im = m as InstancedMesh;
        if (m.geometry.indices) {
          gl.drawElementsInstanced(gl.TRIANGLES, m.geometry.indexCount, m.geometry.indexType, 0, im.count);
        } else {
          gl.drawArraysInstanced(gl.TRIANGLES, 0, m.geometry.vertexCount, im.count);
        }
      } else {
        if (m.geometry.indices) {
          gl.drawElements(gl.TRIANGLES, m.geometry.indexCount, m.geometry.indexType, 0);
        } else {
          gl.drawArrays(gl.TRIANGLES, 0, m.geometry.vertexCount);
        }
      }
    }

    this.renderLakeReflection(camera, skyMesh, opaqueMeshes);

    // 2. PASS CHÍNH (Main Lighting Pass)
    this.cameraEffects.begin(this.renderWidth, this.renderHeight);
    gl.viewport(0, 0, this.renderWidth, this.renderHeight);
    gl.clearColor(scene.background.r, scene.background.g, scene.background.b, 1.0);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Gắn Shadow Map vào Texture Unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTex);

    // Vẽ bầu trời trước
    if (skyMesh) {
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      this.drawMesh(skyMesh, camera);
      gl.depthMask(true);
    }

    // Vẽ các vật thể đặc (Opaque)
    gl.disable(gl.BLEND);
    for (let i = 0; i < opaqueMeshes.length; i++) {
      this.drawMesh(opaqueMeshes[i], camera);
    }

    transparentMeshes.sort((a, b) => {
      const ae = a.matrixWorld.elements, be = b.matrixWorld.elements;
      const distance = (e: Float32Array) => (e[12] - camera.position.x) ** 2 + (e[13] - camera.position.y) ** 2 + (e[14] - camera.position.z) ** 2;
      return distance(be) - distance(ae);
    });
    // Vẽ các vật thể bán trong suốt (Mặt nước, Mây, Kính buồng lái, Đĩa cánh quạt)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (let i = 0; i < transparentMeshes.length; i++) {
      this.drawMesh(transparentMeshes[i], camera);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    this.cameraEffects.finish(this.elapsedTime, this.cinematic, this.rain, this.sharpen);
    this.gpuTimer.end();
  }

  private renderLakeReflection(camera: PerspectiveCamera, sky: Mesh | null, meshes: Mesh[]): void {
    const gl = this.gl;
    const width = Math.min(this.reflectionLimit, Math.ceil(this.renderWidth / 2));
    const height = Math.ceil(width * this.renderHeight / this.renderWidth);
    if (width !== this.reflectionWidth || height !== this.reflectionHeight) {
      this.reflectionWidth = width; this.reflectionHeight = height;
      gl.bindTexture(gl.TEXTURE_2D, this.reflectionTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.reflectionDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.reflectionFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.reflectionTexture, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.reflectionDepth);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Lake reflection unavailable');
    }
    const reflected = this.reflectionCamera;
    reflected.fov = camera.fov; reflected.aspect = camera.aspect;
    reflected.near = camera.near; reflected.far = camera.far;
    reflected.updateProjectionMatrix();
    reflected.position.set(camera.position.x, -camera.position.y, camera.position.z);
    reflected.lookAt(new Vector3(camera.target.x, -camera.target.y, camera.target.z), new Vector3(camera.upVec.x, -camera.upVec.y, camera.upVec.z));
    this.reflectionMatrix.multiplyMatrices(reflected.projectionMatrix, reflected.viewMatrix);
    this.reflectionPass = true;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.reflectionFbo);
    gl.viewport(0, 0, width, height);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.clearColor(this.skyHorizonColor.r, this.skyHorizonColor.g, this.skyHorizonColor.b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTex);
    if (sky) { gl.depthMask(false); this.drawMesh(sky, reflected); gl.depthMask(true); }
    for (const mesh of meshes) this.drawMesh(mesh, reflected);
    this.reflectionPass = false;
  }

  private drawMesh(m: Mesh, camera: PerspectiveCamera): void {
    const gl = this.gl;
    const mat = m.material;
    if (mat.foliage && !this.foliageReady) return;
    if (mat.treeBillboard && !this.treeAtlas) return;
    const isInst = m instanceof InstancedMesh;
    this.ensureGeometryVAO(m.geometry, isInst ? (m as InstancedMesh) : undefined);

    let progKey: string = mat.shaderType;
    if (isInst && mat.shaderType === 'pbr') progKey = 'pbr_instanced';
    if (isInst && mat.shaderType === 'cloud') progKey = 'cloud_instanced';
    const prog = this.programs[progKey] || this.programs['pbr'];

    gl.useProgram(prog.program);
    if (mat.doubleSided) {
      gl.disable(gl.CULL_FACE);
    } else {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
    }

    const u = prog.uniforms;
    if (u['uModel']) gl.uniformMatrix4fv(u['uModel'], false, m.matrixWorld.elements);
    if (u['uView']) gl.uniformMatrix4fv(u['uView'], false, camera.viewMatrix.elements);
    if (u['uProj']) gl.uniformMatrix4fv(u['uProj'], false, camera.projectionMatrix.elements);
    if (u['uLightSpace']) gl.uniformMatrix4fv(u['uLightSpace'], false, this.lightSpaceMatrix.elements);

    if (u['uCameraPos']) gl.uniform3f(u['uCameraPos'], camera.position.x, camera.position.y, camera.position.z);
    if (u['uSunDir']) gl.uniform3f(u['uSunDir'], this.sunDirection.x, this.sunDirection.y, this.sunDirection.z);
    if (u['uSunColor']) gl.uniform3f(u['uSunColor'], this.sunColor.r, this.sunColor.g, this.sunColor.b);
    if (u['uSkyZenith']) gl.uniform3f(u['uSkyZenith'], this.skyZenithColor.r, this.skyZenithColor.g, this.skyZenithColor.b);
    if (u['uSkyHorizon']) gl.uniform3f(u['uSkyHorizon'], this.skyHorizonColor.r, this.skyHorizonColor.g, this.skyHorizonColor.b);
    if (u['uGroundColor']) gl.uniform3f(u['uGroundColor'], this.groundAmbientColor.r, this.groundAmbientColor.g, this.groundAmbientColor.b);
    if (u['uFogColor']) gl.uniform3f(u['uFogColor'], this.fogColor.r, this.fogColor.g, this.fogColor.b);
    if (u['uFogDensity']) gl.uniform1f(u['uFogDensity'], this.fogDensity);
    if (u['uCloudImmersion']) gl.uniform1f(u['uCloudImmersion'], this.cloudImmersion);
    if (u['uTime']) gl.uniform1f(u['uTime'], this.elapsedTime);
    if (u['uWaveLayers']) gl.uniform1f(u['uWaveLayers'], this.waterWaveLayers);
    if (u['uPostGrading']) gl.uniform1f(u['uPostGrading'], this.enablePostGrading ? 1.0 : 0.0);

    if (u['uClipWater']) gl.uniform1f(u['uClipWater'], this.reflectionPass ? 1 : 0);
    if (u['uCloudCover']) gl.uniform1f(u['uCloudCover'], this.cloudCover);
    if (u['uRain']) gl.uniform1f(u['uRain'], this.rain);
    if (u['uReflectionMatrix']) gl.uniformMatrix4fv(u['uReflectionMatrix'], false, this.reflectionMatrix.elements);
    if (u['uReflection']) {
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.reflectionTexture);
      gl.uniform1i(u['uReflection'], 3);
      gl.activeTexture(gl.TEXTURE0);
    }

    if (u['uWaterCenter']) gl.uniform2f(u['uWaterCenter'], Math.round(this.waterCenter.x / 500) * 500, Math.round(this.waterCenter.z / 500) * 500);
    if (mat.shaderType === 'terrain') {
      for (const [index, name] of ['uGrassColor', 'uRockColor', 'uRockNormal'].entries()) {
        gl.activeTexture(gl.TEXTURE4 + index); gl.bindTexture(gl.TEXTURE_2D, this.terrainTextures[index]);
        if (u[name]) gl.uniform1i(u[name], 4 + index);
      }
      gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, this.terrainHeightTexture);
      if (u['uTerrainHeightField']) gl.uniform1i(u['uTerrainHeightField'], 9);
      if (u['uTerrainMaterials']) gl.uniform1f(u['uTerrainMaterials'], this.terrainMaterialsReady ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
    }
    if (u['uFoliage']) gl.uniform1f(u['uFoliage'], mat.foliage ? 1 : 0);
    if (u['uBakingTree']) gl.uniform1f(u['uBakingTree'], this.bakingTree ? 1 : 0);
    if (u['uTreeBillboard']) gl.uniform1f(u['uTreeBillboard'], mat.treeBillboard ? 1 : 0);
    if (u['uTreeAtlas']) {
      gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, this.bakingTree ? null : this.treeAtlas); gl.uniform1i(u['uTreeAtlas'], 10);
      gl.activeTexture(gl.TEXTURE0);
    }

    if (u['uNeedlesColor']) {
      gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.foliageTextures[0]); gl.uniform1i(u['uNeedlesColor'], 7);
      gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, this.foliageTextures[1]); gl.uniform1i(u['uNeedlesAlpha'], 8);
      gl.activeTexture(gl.TEXTURE0);
    }
    if (u['uBaseColor']) gl.uniform3f(u['uBaseColor'], mat.color.r, mat.color.g, mat.color.b);
    if (u['uRoughness']) gl.uniform1f(u['uRoughness'], mat.roughness);
    if (u['uMetalness']) gl.uniform1f(u['uMetalness'], mat.metalness);
    if (u['uClearcoat']) gl.uniform1f(u['uClearcoat'], mat.clearcoat);
    if (u['uOpacity']) gl.uniform1f(u['uOpacity'], mat.opacity);
    if (u['uEmissive']) gl.uniform3f(u['uEmissive'], mat.emissive.r, mat.emissive.g, mat.emissive.b);
    if (u['uUseVertexColor']) gl.uniform1f(u['uUseVertexColor'], (m.geometry.colors || isInst) ? 1.0 : 0.0);
    if (u['uShadowMap']) gl.uniform1i(u['uShadowMap'], 0);

    if (mat.canvasTexture && u['uTex']) {
      gl.activeTexture(gl.TEXTURE1);
      this.ensureMaterialTexture(mat);
      gl.bindTexture(gl.TEXTURE_2D, mat.glTexture);
      gl.uniform1i(u['uTex'], 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.activeTexture(gl.TEXTURE0);
    }

    gl.bindVertexArray(m.geometry.vao);
    if (isInst) {
      const im = m as InstancedMesh;
      if (m.geometry.indices) {
        gl.drawElementsInstanced(gl.TRIANGLES, m.geometry.indexCount, m.geometry.indexType, 0, im.count);
      } else {
        gl.drawArraysInstanced(gl.TRIANGLES, 0, m.geometry.vertexCount, im.count);
      }
    } else {
      if (m.geometry.indices) {
        gl.drawElements(gl.TRIANGLES, m.geometry.indexCount, m.geometry.indexType, 0);
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, m.geometry.vertexCount);
      }
    }
  }
}
