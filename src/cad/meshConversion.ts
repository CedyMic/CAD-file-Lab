export type MeshExportFormat = 'stl' | 'obj' | 'ply' | 'glb' | 'gltf' | '3mf'

export interface TriangleMeshSource {
  vertices: ArrayLike<number>
  triangles: ArrayLike<number>
}
export interface MeshConversionOptions {
  format: MeshExportFormat
  /** Fraction of source triangles to retain. Must be greater than 0 and at most 1. */
  reductionRatio?: number
  fileName?: string
}

export interface ConvertedMeshFile {
  blob: Blob
  fileName: string
  sourceTriangleCount: number
  triangleCount: number
}

interface CompactMesh {
  vertices: number[]
  triangles: number[]
}

const MIME_TYPES: Record<MeshExportFormat, string> = {
  stl: 'model/stl',
  obj: 'model/obj',
  ply: 'application/vnd.ply',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  '3mf': 'model/3mf',
}

const encoder = new TextEncoder()

function validateMesh(mesh: TriangleMeshSource): number {
  if (
    mesh.vertices.length % 3 !== 0 ||
    mesh.triangles.length % 3 !== 0
  ) {
    throw new Error('The mesh has incomplete vertex or triangle data.')
  }

  const vertexCount = mesh.vertices.length / 3

  for (let index = 0; index < mesh.vertices.length; index += 1) {
    if (!Number.isFinite(mesh.vertices[index])) {
      throw new Error('The mesh contains a non-finite vertex coordinate.')
    }
  }

  for (let index = 0; index < mesh.triangles.length; index += 1) {
    const vertexIndex = mesh.triangles[index]
    if (
      !Number.isSafeInteger(vertexIndex) ||
      vertexIndex < 0 ||
      vertexIndex >= vertexCount
    ) {
      throw new Error('The mesh contains an invalid triangle index.')
    }
  }

  const triangleCount = mesh.triangles.length / 3
  if (triangleCount === 0) {
    throw new Error('The mesh has no triangles to export.')
  }

  return triangleCount
}

/**
 * Retains triangles at even intervals across the source index buffer, then
 * removes unreferenced vertices. Even sampling avoids concentrating a preview
 * on the first faces in files whose triangles are grouped by CAD face.
 */
export function reduceTriangleMesh(
  mesh: TriangleMeshSource,
  reductionRatio = 1,
): CompactMesh {
  const sourceTriangleCount = validateMesh(mesh)
  if (
    !Number.isFinite(reductionRatio) ||
    reductionRatio <= 0 ||
    reductionRatio > 1
  ) {
    throw new Error('The reduction ratio must be greater than 0 and at most 1.')
  }

  const targetTriangleCount = Math.max(
    1,
    Math.min(
      sourceTriangleCount,
      Math.round(sourceTriangleCount * reductionRatio),
    ),
  )
  const retainedTriangles: number[] = []

  for (let outputIndex = 0; outputIndex < targetTriangleCount; outputIndex += 1) {
    const sourceIndex = Math.floor(
      outputIndex * sourceTriangleCount / targetTriangleCount,
    )
    const offset = sourceIndex * 3
    retainedTriangles.push(
      mesh.triangles[offset],
      mesh.triangles[offset + 1],
      mesh.triangles[offset + 2],
    )
  }

  const remappedVertices: number[] = []
  const remappedTriangles: number[] = []
  const indexMap = new Map<number, number>()

  for (const sourceVertexIndex of retainedTriangles) {
    let outputVertexIndex = indexMap.get(sourceVertexIndex)
    if (outputVertexIndex === undefined) {
      outputVertexIndex = indexMap.size
      indexMap.set(sourceVertexIndex, outputVertexIndex)
      const offset = sourceVertexIndex * 3
      remappedVertices.push(
        mesh.vertices[offset],
        mesh.vertices[offset + 1],
        mesh.vertices[offset + 2],
      )
    }
    remappedTriangles.push(outputVertexIndex)
  }

  return {
    vertices: remappedVertices,
    triangles: remappedTriangles,
  }
}

function triangleNormal(mesh: CompactMesh, offset: number): [number, number, number] {
  const a = mesh.triangles[offset] * 3
  const b = mesh.triangles[offset + 1] * 3
  const c = mesh.triangles[offset + 2] * 3
  const abx = mesh.vertices[b] - mesh.vertices[a]
  const aby = mesh.vertices[b + 1] - mesh.vertices[a + 1]
  const abz = mesh.vertices[b + 2] - mesh.vertices[a + 2]
  const acx = mesh.vertices[c] - mesh.vertices[a]
  const acy = mesh.vertices[c + 1] - mesh.vertices[a + 1]
  const acz = mesh.vertices[c + 2] - mesh.vertices[a + 2]
  const x = aby * acz - abz * acy
  const y = abz * acx - abx * acz
  const z = abx * acy - aby * acx
  const length = Math.hypot(x, y, z)
  return length === 0 ? [0, 0, 0] : [x / length, y / length, z / length]
}

function createBinaryStl(mesh: CompactMesh): ArrayBuffer {
  const triangleCount = mesh.triangles.length / 3
  const buffer = new ArrayBuffer(84 + triangleCount * 50)
  const view = new DataView(buffer)
  view.setUint32(80, triangleCount, true)
  let byteOffset = 84

  for (let offset = 0; offset < mesh.triangles.length; offset += 3) {
    const normal = triangleNormal(mesh, offset)
    for (const value of normal) {
      view.setFloat32(byteOffset, value, true)
      byteOffset += 4
    }
    for (let corner = 0; corner < 3; corner += 1) {
      const vertexOffset = mesh.triangles[offset + corner] * 3
      for (let axis = 0; axis < 3; axis += 1) {
        view.setFloat32(byteOffset, mesh.vertices[vertexOffset + axis], true)
        byteOffset += 4
      }
    }
    view.setUint16(byteOffset, 0, true)
    byteOffset += 2
  }

  return buffer
}

function createObj(mesh: CompactMesh): string {
  const lines = ['# Exported by CAD File Lab']
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    lines.push(`v ${mesh.vertices[index]} ${mesh.vertices[index + 1]} ${mesh.vertices[index + 2]}`)
  }
  for (let index = 0; index < mesh.triangles.length; index += 3) {
    lines.push(`f ${mesh.triangles[index] + 1} ${mesh.triangles[index + 1] + 1} ${mesh.triangles[index + 2] + 1}`)
  }
  return `${lines.join('\n')}\n`
}

function createPly(mesh: CompactMesh): string {
  const vertexCount = mesh.vertices.length / 3
  const triangleCount = mesh.triangles.length / 3
  const lines = [
    'ply', 'format ascii 1.0', 'comment Exported by CAD File Lab',
    `element vertex ${vertexCount}`, 'property float x', 'property float y', 'property float z',
    `element face ${triangleCount}`, 'property list uchar uint vertex_indices', 'end_header',
  ]
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    lines.push(`${mesh.vertices[index]} ${mesh.vertices[index + 1]} ${mesh.vertices[index + 2]}`)
  }
  for (let index = 0; index < mesh.triangles.length; index += 3) {
    lines.push(`3 ${mesh.triangles[index]} ${mesh.triangles[index + 1]} ${mesh.triangles[index + 2]}`)
  }
  return `${lines.join('\n')}\n`
}

function createGltfGeometry(mesh: CompactMesh): { bytes: Uint8Array, json: Record<string, unknown> } {
  const vertexCount = mesh.vertices.length / 3
  const indexCount = mesh.triangles.length
  const positionLength = mesh.vertices.length * 4
  const indexOffset = (positionLength + 3) & ~3
  const bytes = new Uint8Array(indexOffset + indexCount * 4)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < mesh.vertices.length; index += 1) {
    view.setFloat32(index * 4, mesh.vertices[index], true)
  }
  for (let index = 0; index < indexCount; index += 1) {
    view.setUint32(indexOffset + index * 4, mesh.triangles[index], true)
  }

  const minimum = [Infinity, Infinity, Infinity]
  const maximum = [-Infinity, -Infinity, -Infinity]
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], mesh.vertices[index + axis])
      maximum[axis] = Math.max(maximum[axis], mesh.vertices[index + axis])
    }
  }
  return {
    bytes,
    json: {
      asset: { version: '2.0', generator: 'CAD File Lab' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min: minimum, max: maximum },
        { bufferView: 1, componentType: 5125, count: indexCount, type: 'SCALAR' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positionLength, target: 34962 },
        { buffer: 0, byteOffset: indexOffset, byteLength: indexCount * 4, target: 34963 },
      ],
      buffers: [{ byteLength: bytes.length }],
    },
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function createGltf(mesh: CompactMesh): string {
  const geometry = createGltfGeometry(mesh)
  const buffers = geometry.json.buffers as Array<Record<string, unknown>>
  buffers[0].uri = `data:application/octet-stream;base64,${bytesToBase64(geometry.bytes)}`
  return JSON.stringify(geometry.json)
}

function createGlb(mesh: CompactMesh): ArrayBuffer {
  const geometry = createGltfGeometry(mesh)
  const jsonBytes = encoder.encode(JSON.stringify(geometry.json))
  const jsonLength = (jsonBytes.length + 3) & ~3
  const binaryLength = (geometry.bytes.length + 3) & ~3
  const buffer = new ArrayBuffer(12 + 8 + jsonLength + 8 + binaryLength)
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, buffer.byteLength, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.fill(0x20, 20, 20 + jsonLength)
  bytes.set(jsonBytes, 20)
  const binaryHeader = 20 + jsonLength
  view.setUint32(binaryHeader, binaryLength, true)
  view.setUint32(binaryHeader + 4, 0x004e4942, true)
  bytes.set(geometry.bytes, binaryHeader + 8)
  return buffer
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createStoredZip(files: Array<{ name: string, contents: string }>): ArrayBuffer {
  const encoded = files.map(file => ({ name: encoder.encode(file.name), data: encoder.encode(file.contents) }))
  const localSize = encoded.reduce((sum, file) => sum + 30 + file.name.length + file.data.length, 0)
  const centralSize = encoded.reduce((sum, file) => sum + 46 + file.name.length, 0)
  const buffer = new ArrayBuffer(localSize + centralSize + 22)
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  let localOffset = 0
  let centralOffset = localSize
  for (const file of encoded) {
    const checksum = crc32(file.data)
    view.setUint32(localOffset, 0x04034b50, true)
    view.setUint16(localOffset + 4, 20, true)
    view.setUint32(localOffset + 14, checksum, true)
    view.setUint32(localOffset + 18, file.data.length, true)
    view.setUint32(localOffset + 22, file.data.length, true)
    view.setUint16(localOffset + 26, file.name.length, true)
    bytes.set(file.name, localOffset + 30)
    bytes.set(file.data, localOffset + 30 + file.name.length)

    view.setUint32(centralOffset, 0x02014b50, true)
    view.setUint16(centralOffset + 4, 20, true)
    view.setUint16(centralOffset + 6, 20, true)
    view.setUint32(centralOffset + 16, checksum, true)
    view.setUint32(centralOffset + 20, file.data.length, true)
    view.setUint32(centralOffset + 24, file.data.length, true)
    view.setUint16(centralOffset + 28, file.name.length, true)
    view.setUint32(centralOffset + 42, localOffset, true)
    bytes.set(file.name, centralOffset + 46)
    centralOffset += 46 + file.name.length
    localOffset += 30 + file.name.length + file.data.length
  }
  view.setUint32(centralOffset, 0x06054b50, true)
  view.setUint16(centralOffset + 8, encoded.length, true)
  view.setUint16(centralOffset + 10, encoded.length, true)
  view.setUint32(centralOffset + 12, centralSize, true)
  view.setUint32(centralOffset + 16, localSize, true)
  return buffer
}

function createThreeMf(mesh: CompactMesh): ArrayBuffer {
  const vertices: string[] = []
  const triangles: string[] = []
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    vertices.push(`<vertex x="${mesh.vertices[index]}" y="${mesh.vertices[index + 1]}" z="${mesh.vertices[index + 2]}"/>`)
  }
  for (let index = 0; index < mesh.triangles.length; index += 3) {
    triangles.push(`<triangle v1="${mesh.triangles[index]}" v2="${mesh.triangles[index + 1]}" v3="${mesh.triangles[index + 2]}"/>`)
  }
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`
  return createStoredZip([
    { name: '[Content_Types].xml', contents: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>' },
    { name: '_rels/.rels', contents: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>' },
    { name: '3D/3dmodel.model', contents: model },
  ])
}

function downloadName(fileName: string | undefined, format: MeshExportFormat): string {
  const baseName = (fileName ?? 'model')
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .trim() || 'model'
  return `${baseName}.${format}`
}

export function convertTriangleMesh(
  source: TriangleMeshSource,
  options: MeshConversionOptions,
): ConvertedMeshFile {
  if (!Object.hasOwn(MIME_TYPES, options.format)) {
    throw new Error('The requested mesh export format is not supported.')
  }
  const sourceTriangleCount = validateMesh(source)
  const mesh = reduceTriangleMesh(source, options.reductionRatio)
  let contents: string | ArrayBuffer
  switch (options.format) {
    case 'stl': contents = createBinaryStl(mesh); break
    case 'obj': contents = createObj(mesh); break
    case 'ply': contents = createPly(mesh); break
    case 'glb': contents = createGlb(mesh); break
    case 'gltf': contents = createGltf(mesh); break
    case '3mf': contents = createThreeMf(mesh); break
  }

  return {
    blob: new Blob([contents], { type: MIME_TYPES[options.format] }),
    fileName: downloadName(options.fileName, options.format),
    sourceTriangleCount,
    triangleCount: mesh.triangles.length / 3,
  }
}
