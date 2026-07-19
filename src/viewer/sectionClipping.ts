import type { ImportedCadBody } from '../cad/cadClient'
import type { ModelLayout } from './modelLayout'

export type SectionAxis = 'x' | 'y' | 'z'

export interface SectionSettings {
  axis: SectionAxis
  position: number
  flip: boolean
}

export interface SectionPlaneDefinition {
  normal: [number, number, number]
  constant: number
  modelCoordinate: number
}

export const defaultSectionSettings: SectionSettings = {
  axis: 'x',
  position: 50,
  flip: false,
}

function includePoints(
  source: number[] | Float32Array,
  minimum: number[],
  maximum: number[],
) {
  for (let index = 0; index < source.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], source[index + axis])
      maximum[axis] = Math.max(maximum[axis], source[index + axis])
    }
  }
}

export function createSectionPlane(
  model: ImportedCadBody,
  layout: ModelLayout,
  settings: SectionSettings,
): SectionPlaneDefinition | null {
  const minimum = [Infinity, Infinity, Infinity]
  const maximum = [-Infinity, -Infinity, -Infinity]
  includePoints(model.faces.vertices, minimum, maximum)
  includePoints(model.edges.lines, minimum, maximum)

  const axisIndex = settings.axis === 'x' ? 0 : settings.axis === 'y' ? 1 : 2
  if (!Number.isFinite(minimum[axisIndex]) || !Number.isFinite(maximum[axisIndex])) return null

  const ratio = Math.min(100, Math.max(0, settings.position)) / 100
  const modelCoordinate = minimum[axisIndex] + (maximum[axisIndex] - minimum[axisIndex]) * ratio

  let normal: [number, number, number]
  let worldCoordinate: number
  if (settings.axis === 'x') {
    normal = [1, 0, 0]
    worldCoordinate = modelCoordinate + layout.position[0]
  } else if (settings.axis === 'y') {
    normal = [0, 0, -1]
    worldCoordinate = -modelCoordinate + layout.position[2]
  } else {
    normal = [0, 1, 0]
    worldCoordinate = modelCoordinate + layout.position[1]
  }

  const worldAxisIndex = normal.findIndex((value) => value !== 0)
  let constant = -(normal[worldAxisIndex] * worldCoordinate)
  if (constant === 0) constant = 0

  if (settings.flip) {
    normal = normal.map((value) => value === 0 ? 0 : -value) as [number, number, number]
    constant = -constant
  }

  return { normal, constant, modelCoordinate }
}
