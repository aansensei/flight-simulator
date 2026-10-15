import { BufferGeometry, GeometryBuilder, Group, Material, MaterialMap, Mesh, Object3D } from './webgl2-three';

export interface ParsedGLBResult {
  root: Group;
  nodesByName: Map<string, Object3D>;
  meshes: Mesh[];
  textures: MaterialMap[];
  triangleCount: number;
}

// This loader accepts the embedded, static triangle meshes used by the bundled assets.
export function parseGLB(buffer: ArrayBuffer): ParsedGLBResult {
  const view = new DataView(buffer);
  if (buffer.byteLength < 28 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error('Invalid GLB header');
  let offset = 12, doc: any, bin = new Uint8Array();
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) throw new Error('Truncated GLB chunk');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    offset += 8;
    if (length % 4 || offset + length > buffer.byteLength) throw new Error('Invalid GLB chunk length');
    if (type === 0x4e4f534a) {
      if (doc || offset !== 20) throw new Error('GLB JSON must be first');
      doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, length)));
    } else if (type === 0x004e4942) bin = new Uint8Array(buffer, offset, length);
    offset += length;
  }
  if (doc?.asset?.version !== '2.0' || doc.extensionsRequired?.length || doc.buffers?.length !== 1 || doc.buffers[0].uri || doc.buffers[0].byteLength > bin.length) throw new Error('Unsupported GLB document');
  const bufferView = (index: number): any => {
    const bv = doc.bufferViews?.[index];
    if (!bv || bv.buffer !== 0 || (bv.byteOffset || 0) < 0 || bv.byteLength < 0 || (bv.byteOffset || 0) + bv.byteLength > doc.buffers[0].byteLength) throw new Error('Invalid GLB buffer view');
    return bv;
  };
  const componentSizes: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const componentCounts: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = (index: number, components: number, indices = false): Float32Array | Uint32Array => {
    const acc = doc.accessors?.[index];
    if (!acc || acc.sparse || acc.bufferView === undefined || componentCounts[acc.type] !== components || !Number.isInteger(acc.count) || acc.count < 1) throw new Error('Unsupported GLB accessor');
    if (indices && (![5121, 5123, 5125].includes(acc.componentType) || acc.normalized)) throw new Error('Invalid GLB indices');
    const bv = bufferView(acc.bufferView), size = componentSizes[acc.componentType];
    const stride = bv.byteStride || components * size, start = acc.byteOffset || 0;
    if (!size || stride < components * size || start < 0 || start + (acc.count - 1) * stride + components * size > bv.byteLength) throw new Error('GLB accessor exceeds buffer view');
    const data = new DataView(bin.buffer, bin.byteOffset + (bv.byteOffset || 0), bv.byteLength);
    const result = indices ? new Uint32Array(acc.count) : new Float32Array(acc.count * components);
    for (let i = 0; i < acc.count; i++) for (let c = 0; c < components; c++) {
      const p = start + i * stride + c * size;
      let value: number;
      switch (acc.componentType) {
        case 5120: value = data.getInt8(p); break;
        case 5121: value = data.getUint8(p); break;
        case 5122: value = data.getInt16(p, true); break;
        case 5123: value = data.getUint16(p, true); break;
        case 5125: value = data.getUint32(p, true); break;
        default: value = data.getFloat32(p, true);
      }
      if (!Number.isFinite(value)) throw new Error('Nonfinite GLB vertex');
      if (acc.normalized) {
        const signed = acc.componentType === 5120 || acc.componentType === 5122;
        value = Math.max(signed ? -1 : 0, value / (2 ** (size * 8 - (signed ? 1 : 0)) - 1));
      }
      result[i * components + c] = value;
    }
    return result;
  };
  const images: MaterialMap[] = (doc.images || []).map((entry: any) => {
    if (entry.uri || !['image/jpeg', 'image/png'].includes(entry.mimeType)) throw new Error('Only embedded PNG/JPEG images are supported');
    const bv = bufferView(entry.bufferView);
    return { bytes: bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), mimeType: entry.mimeType, image: null, glTexture: null, wrapS: 10497, wrapT: 10497, minFilter: 9987, magFilter: 9729 };
  });
  const textures: MaterialMap[] = (doc.textures || []).map((entry: any) => {
    const image = images[entry.source];
    if (!image) throw new Error('Missing GLB image');
    const sampler = doc.samplers?.[entry.sampler] || {};
    return { ...image, ...sampler };
  });
  const texture = (info: any): MaterialMap | null => {
    if (!info) return null;
    if ((info.texCoord || 0) !== 0 || info.extensions || !textures[info.index]) throw new Error('Unsupported GLB texture reference');
    return textures[info.index];
  };
  const materials: Material[] = (doc.materials || []).map((entry: any) => {
    const pbr = entry.pbrMetallicRoughness || {}, factor = pbr.baseColorFactor || [1, 1, 1, 1];
    const mat = new Material({ roughness: pbr.roughnessFactor ?? 1, metalness: pbr.metallicFactor ?? 1, doubleSided: !!entry.doubleSided });
    mat.color.setRGB(factor[0], factor[1], factor[2]);
    mat.transparent = entry.alphaMode === 'BLEND';
    mat.opacity = entry.alphaMode === 'OPAQUE' || !entry.alphaMode ? 1 : factor[3];
    mat.alphaCutoff = entry.alphaMode === 'MASK' ? (entry.alphaCutoff ?? 0.5) : -1;
    mat.baseColorMap = texture(pbr.baseColorTexture);
    mat.normalMap = texture(entry.normalTexture);
    mat.metallicRoughnessMap = texture(pbr.metallicRoughnessTexture);
    mat.normalScale = entry.normalTexture?.scale ?? 1;
    return mat;
  });
  const fallback = new Material({ roughness: 1, metalness: 1 });
  const nodesByName = new Map<string, Object3D>(), meshes: Mesh[] = [], visited = new Set<number>();
  let triangleCount = 0;
  const buildNode = (index: number): Object3D => {
    const node = doc.nodes?.[index];
    if (!node || visited.has(index) || node.matrix || node.skin !== undefined || node.weights) throw new Error('Unsupported GLB node hierarchy');
    visited.add(index);
    const group = new Group();
    group.name = node.name || `Node_${index}`;
    if (node.name) nodesByName.set(node.name, group);
    if (node.translation) group.position.set(...node.translation as [number, number, number]);
    if (node.rotation) { group.quaternion.set(...node.rotation as [number, number, number, number]); group.useQuaternion = true; }
    if (node.scale) group.scale.set(...node.scale as [number, number, number]);
    if (node.mesh !== undefined) {
      const mesh = doc.meshes?.[node.mesh];
      if (!mesh) throw new Error('Missing GLB mesh');
      for (const primitive of mesh.primitives) {
        if ((primitive.mode ?? 4) !== 4 || primitive.targets) throw new Error('Only static GLB triangles are supported');
        const positions = read(primitive.attributes.POSITION, 3) as Float32Array;
        const count = positions.length / 3;
        const indices = primitive.indices === undefined ? Uint32Array.from({ length: count }, (_, i) => i) : read(primitive.indices, 1, true) as Uint32Array;
        if (indices.length % 3 || indices.some(i => i >= count)) throw new Error('Invalid GLB triangle indices');
        const normals = primitive.attributes.NORMAL === undefined ? GeometryBuilder.computeVertexNormals(positions, indices) : read(primitive.attributes.NORMAL, 3) as Float32Array;
        const uvs = primitive.attributes.TEXCOORD_0 === undefined ? undefined : read(primitive.attributes.TEXCOORD_0, 2) as Float32Array;
        if (normals.length !== positions.length || (uvs && uvs.length !== count * 2)) throw new Error('Mismatched GLB attribute count');
        const material = primitive.material === undefined ? fallback : materials[primitive.material];
        if (!material) throw new Error('Missing GLB material');
        const part = new Mesh(new BufferGeometry({ positions, normals, uvs, indices }), material);
        part.name = mesh.name || group.name;
        part.castShadow = !material.transparent; part.receiveShadow = true;
        group.add(part); meshes.push(part); triangleCount += indices.length / 3;
      }
    }
    for (const child of node.children || []) group.add(buildNode(child));
    return group;
  };
  const root = new Group();
  const scene = doc.scenes?.[doc.scene ?? 0];
  if (!scene?.nodes) throw new Error('Missing GLB scene');
  for (const index of scene.nodes) root.add(buildNode(index));
  root.updateMatrixWorld();
  return { root, nodesByName, meshes, textures, triangleCount };
}

const decodedTextures = new Map<string, Promise<MaterialMap>>();
async function decodeTexture(texture: MaterialMap): Promise<MaterialMap> {
  const digest = await crypto.subtle.digest('SHA-256', texture.bytes.slice().buffer as ArrayBuffer);
  const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') + `:${texture.wrapS}:${texture.wrapT}:${texture.minFilter}:${texture.magFilter}`;
  let pending = decodedTextures.get(key);
  if (!pending) {
    pending = createImageBitmap(new Blob([texture.bytes.slice().buffer as ArrayBuffer], { type: texture.mimeType }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }).then(image => ({ ...texture, image }));
    decodedTextures.set(key, pending);
  }
  return pending;
}

export async function loadGLBFromUrl(url: string): Promise<ParsedGLBResult> {
  const response = await fetch(new URL(url, document.baseURI));
  if (!response.ok) throw new Error(`Không tải được mô hình: ${url} (${response.status})`);
  const parsed = parseGLB(await response.arrayBuffer());
  const replacements = new Map<MaterialMap, MaterialMap>();
  await Promise.all(parsed.textures.map(async texture => replacements.set(texture, await decodeTexture(texture))));
  for (const mesh of parsed.meshes) for (const property of ['baseColorMap', 'normalMap', 'metallicRoughnessMap'] as const) {
    const map = mesh.material[property];
    if (map) mesh.material[property] = replacements.get(map)!;
  }
  parsed.textures = [...new Set(replacements.values())];
  return parsed;
}
