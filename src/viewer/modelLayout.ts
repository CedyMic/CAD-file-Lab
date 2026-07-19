import type { ImportedCadBody } from '../cad/cadClient'

export interface ModelLayout {
  position: [number, number, number]
  target: [number, number, number]
  radius: number
}

const defaultLayout: ModelLayout = {
  position: [0, 0, 0],
  target: [0, 0.8, 0],
  radius: 1.75,
}

function includeZUpPoints(
  source: number[] | Float32Array,
  minimum: number[],
  maximum: number[],
) {
  for (let index = 0; index < source.length; index += 3) {
    const x = source[index]
    const y = source[index + 2]
    const z = -source[index + 1]
    minimum[0] = Math.min(minimum[0], x)
    minimum[1] = Math.min(minimum[1], y)
    minimum[2] = Math.min(minimum[2], z)
    maximum[0] = Math.max(maximum[0], x)
    maximum[1] = Math.max(maximum[1], y)
    maximum[2] = Math.max(maximum[2], z)
  }
}

function negate(value: number) {
  return value === 0 ? 0 : -value
}

export function calculateModelLayout(model: ImportedCadBody | null): ModelLayout {
  if (!model) return defaultLayout

  const minimum = [Infinity, Infinity, Infinity]
  const maximum = [-Infinity, -Infinity, -Infinity]
  includeZUpPoints(model.faces.vertices, minimum, maximum)
  includeZUpPoints(model.edges.lines, minimum, maximum)

  if (!Number.isFinite(minimum[0])) return defaultLayout

  const sizeX = maximum[0] - minimum[0]
  const sizeY = maximum[1] - minimum[1]
  const sizeZ = maximum[2] - minimum[2]
  const centerX = (minimum[0] + maximum[0]) / 2
  const centerZ = (minimum[2] + maximum[2]) / 2

  return {
    position: [negate(centerX), negate(minimum[1]), negate(centerZ)],
    target: [0, Math.max(sizeY / 2, 0.01), 0],
    radius: Math.max(Math.hypot(sizeX, sizeY, sizeZ) / 2, 0.5),
  }
}
