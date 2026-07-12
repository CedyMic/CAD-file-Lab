export type MeshExportFormat = 'stl' | 'obj' | 'ply'

export interface TriangleMeshSource { vertices: ArrayLike<number>; triangles: ArrayLike<number> }
export interface MeshConversionOptions { format: MeshExportFormat; reductionRatio?: number; fileName?: string }
export interface ConvertedMeshFile { blob: Blob; fileName: string; sourceTriangleCount: number; triangleCount: number }
interface CompactMesh { vertices: number[]; triangles: number[] }

const MIME_TYPES: Record<MeshExportFormat, string> = { stl: 'model/stl', obj: 'model/obj', ply: 'application/vnd.ply' }

function validateMesh(mesh: TriangleMeshSource): number {
  if (mesh.vertices.length % 3 !== 0 || mesh.triangles.length % 3 !== 0) throw new Error('The mesh has incomplete vertex or triangle data.')
  const vertexCount = mesh.vertices.length / 3
  for (let index = 0; index < mesh.vertices.length; index += 1) if (!Number.isFinite(mesh.vertices[index])) throw new Error('The mesh contains a non-finite vertex coordinate.')
  for (let index = 0; index < mesh.triangles.length; index += 1) {
    const vertexIndex = mesh.triangles[index]
    if (!Number.isSafeInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= vertexCount) throw new Error('The mesh contains an invalid triangle index.')
  }
  const triangleCount = mesh.triangles.length / 3
  if (triangleCount === 0) throw new Error('The mesh has no triangles to export.')
  return triangleCount
}

export function reduceTriangleMesh(mesh: TriangleMeshSource, reductionRatio = 1): CompactMesh {
  const sourceTriangleCount = validateMesh(mesh)
  if (!Number.isFinite(reductionRatio) || reductionRatio <= 0 || reductionRatio > 1) throw new Error('The reduction ratio must be greater than 0 and at most 1.')
  const targetTriangleCount = Math.max(1, Math.min(sourceTriangleCount, Math.round(sourceTriangleCount * reductionRatio)))
  const retainedTriangles: number[] = []
  for (let outputIndex = 0; outputIndex < targetTriangleCount; outputIndex += 1) {
    const sourceIndex = Math.floor(outputIndex * sourceTriangleCount / targetTriangleCount)
    const offset = sourceIndex * 3
    retainedTriangles.push(mesh.triangles[offset], mesh.triangles[offset + 1], mesh.triangles[offset + 2])
  }
  const vertices: number[] = []; const triangles: number[] = []; const indexMap = new Map<number, number>()
  for (const sourceVertexIndex of retainedTriangles) {
    let outputVertexIndex = indexMap.get(sourceVertexIndex)
    if (outputVertexIndex === undefined) {
      outputVertexIndex = indexMap.size; indexMap.set(sourceVertexIndex, outputVertexIndex)
      const offset = sourceVertexIndex * 3
      vertices.push(mesh.vertices[offset], mesh.vertices[offset + 1], mesh.vertices[offset + 2])
    }
    triangles.push(outputVertexIndex)
  }
  return { vertices, triangles }
}

function triangleNormal(mesh: CompactMesh, offset: number): [number, number, number] {
  const a = mesh.triangles[offset] * 3; const b = mesh.triangles[offset + 1] * 3; const c = mesh.triangles[offset + 2] * 3
  const abx = mesh.vertices[b] - mesh.vertices[a]; const aby = mesh.vertices[b + 1] - mesh.vertices[a + 1]; const abz = mesh.vertices[b + 2] - mesh.vertices[a + 2]
  const acx = mesh.vertices[c] - mesh.vertices[a]; const acy = mesh.vertices[c + 1] - mesh.vertices[a + 1]; const acz = mesh.vertices[c + 2] - mesh.vertices[a + 2]
  const x = aby * acz - abz * acy; const y = abz * acx - abx * acz; const z = abx * acy - aby * acx; const length = Math.hypot(x, y, z)
  return length === 0 ? [0, 0, 0] : [x / length, y / length, z / length]
}

function createBinaryStl(mesh: CompactMesh): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + mesh.triangles.length / 3 * 50); const view = new DataView(buffer); view.setUint32(80, mesh.triangles.length / 3, true); let byteOffset = 84
  for (let offset = 0; offset < mesh.triangles.length; offset += 3) {
    for (const value of triangleNormal(mesh, offset)) { view.setFloat32(byteOffset, value, true); byteOffset += 4 }
    for (let corner = 0; corner < 3; corner += 1) for (let axis = 0; axis < 3; axis += 1) { view.setFloat32(byteOffset, mesh.vertices[mesh.triangles[offset + corner] * 3 + axis], true); byteOffset += 4 }
    view.setUint16(byteOffset, 0, true); byteOffset += 2
  }
  return buffer
}

function createObj(mesh: CompactMesh): string {
  const lines = ['# Exported by CAD File Lab']
  for (let i = 0; i < mesh.vertices.length; i += 3) lines.push(`v ${mesh.vertices[i]} ${mesh.vertices[i + 1]} ${mesh.vertices[i + 2]}`)
  for (let i = 0; i < mesh.triangles.length; i += 3) lines.push(`f ${mesh.triangles[i] + 1} ${mesh.triangles[i + 1] + 1} ${mesh.triangles[i + 2] + 1}`)
  return `${lines.join('\n')}\n`
}

function createPly(mesh: CompactMesh): string {
  const lines = ['ply', 'format ascii 1.0', 'comment Exported by CAD File Lab', `element vertex ${mesh.vertices.length / 3}`, 'property float x', 'property float y', 'property float z', `element face ${mesh.triangles.length / 3}`, 'property list uchar uint vertex_indices', 'end_header']
  for (let i = 0; i < mesh.vertices.length; i += 3) lines.push(`${mesh.vertices[i]} ${mesh.vertices[i + 1]} ${mesh.vertices[i + 2]}`)
  for (let i = 0; i < mesh.triangles.length; i += 3) lines.push(`3 ${mesh.triangles[i]} ${mesh.triangles[i + 1]} ${mesh.triangles[i + 2]}`)
  return `${lines.join('\n')}\n`
}

export function convertTriangleMesh(source: TriangleMeshSource, options: MeshConversionOptions): ConvertedMeshFile {
  if (!Object.hasOwn(MIME_TYPES, options.format)) throw new Error('The requested mesh export format is not supported.')
  const sourceTriangleCount = validateMesh(source); const mesh = reduceTriangleMesh(source, options.reductionRatio)
  const contents = options.format === 'stl' ? createBinaryStl(mesh) : options.format === 'obj' ? createObj(mesh) : createPly(mesh)
  const baseName = (options.fileName ?? 'model').replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9._ -]/g, '_').trim() || 'model'
  return { blob: new Blob([contents], { type: MIME_TYPES[options.format] }), fileName: `${baseName}.${options.format}`, sourceTriangleCount, triangleCount: mesh.triangles.length / 3 }
}
