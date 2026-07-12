export interface TriangleMeshData {
  vertices: number[] | Float32Array
  triangles: number[] | Uint32Array
}

export interface MeshProperties {
  surfaceAreaMm2: number
  enclosedVolumeMm3: number | null
  triangleCount: number
  degenerateTriangleCount: number
  volumeStatus: 'closed' | 'open-or-non-manifold'
}

interface EdgeUse {
  count: number
  orientation: number
}

function assertMesh(mesh: TriangleMeshData): void {
  if (mesh.vertices.length % 3 !== 0) {
    throw new Error('Mesh vertices must contain complete XYZ coordinates.')
  }
  if (mesh.triangles.length % 3 !== 0) {
    throw new Error('Mesh indices must contain complete triangles.')
  }
  if (!Array.from(mesh.vertices).every(Number.isFinite)) {
    throw new Error('Mesh vertices must contain only finite coordinates.')
  }

  const vertexCount = mesh.vertices.length / 3
  for (const index of mesh.triangles) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= vertexCount) {
      throw new Error('Mesh triangles contain an invalid vertex index.')
    }
  }
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

export function calculateMeshProperties(mesh: TriangleMeshData): MeshProperties {
  assertMesh(mesh)

  let surfaceAreaMm2 = 0
  let signedVolumeMm3 = 0
  let degenerateTriangleCount = 0
  const edges = new Map<string, EdgeUse>()

  for (let offset = 0; offset < mesh.triangles.length; offset += 3) {
    const a = Number(mesh.triangles[offset])
    const b = Number(mesh.triangles[offset + 1])
    const c = Number(mesh.triangles[offset + 2])
    const ax = mesh.vertices[a * 3]
    const ay = mesh.vertices[a * 3 + 1]
    const az = mesh.vertices[a * 3 + 2]
    const abx = mesh.vertices[b * 3] - ax
    const aby = mesh.vertices[b * 3 + 1] - ay
    const abz = mesh.vertices[b * 3 + 2] - az
    const acx = mesh.vertices[c * 3] - ax
    const acy = mesh.vertices[c * 3 + 1] - ay
    const acz = mesh.vertices[c * 3 + 2] - az
    const crossX = aby * acz - abz * acy
    const crossY = abz * acx - abx * acz
    const crossZ = abx * acy - aby * acx
    const doubleArea = Math.hypot(crossX, crossY, crossZ)

    if (doubleArea <= Number.EPSILON) degenerateTriangleCount += 1
    surfaceAreaMm2 += doubleArea / 2

    const bx = mesh.vertices[b * 3]
    const by = mesh.vertices[b * 3 + 1]
    const bz = mesh.vertices[b * 3 + 2]
    const cx = mesh.vertices[c * 3]
    const cy = mesh.vertices[c * 3 + 1]
    const cz = mesh.vertices[c * 3 + 2]
    signedVolumeMm3 += (
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx)
    ) / 6

    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      const key = edgeKey(from, to)
      const use = edges.get(key) ?? { count: 0, orientation: 0 }
      use.count += 1
      use.orientation += from < to ? 1 : -1
      edges.set(key, use)
    }
  }

  const isClosed = mesh.triangles.length > 0 &&
    degenerateTriangleCount === 0 &&
    [...edges.values()].every((edge) => edge.count === 2 && edge.orientation === 0)

  return {
    surfaceAreaMm2,
    enclosedVolumeMm3: isClosed ? Math.abs(signedVolumeMm3) : null,
    triangleCount: mesh.triangles.length / 3,
    degenerateTriangleCount,
    volumeStatus: isClosed ? 'closed' : 'open-or-non-manifold',
  }
}

export function formatAreaMm2(area: number): string {
  if (!Number.isFinite(area) || area < 0) throw new Error('Area must be finite and non-negative.')
  return `${area.toLocaleString('en-US', { maximumFractionDigits: 2 })} mm²`
}

export function formatVolumeMm3(volume: number): string {
  if (!Number.isFinite(volume) || volume < 0) throw new Error('Volume must be finite and non-negative.')
  return `${volume.toLocaleString('en-US', { maximumFractionDigits: 2 })} mm³`
}
