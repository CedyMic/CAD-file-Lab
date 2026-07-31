/** Geometry used by the sketcher is always expressed in model-space millimetres. */
export interface ModelPoint {
  x: number
  y: number
}

export interface InferencePoint extends ModelPoint {
  id: string
  /** The origin is a permanent reference, rather than a user-created endpoint. */
  origin?: boolean
}

export type RelationProposal =
  | { type: 'coincident'; pointId: string }
  | { type: 'horizontal'; referencePointId: string }
  | { type: 'vertical'; referencePointId: string }

export interface InferenceResult {
  point: ModelPoint
  snappedPointId?: string
  proposal?: RelationProposal
}

export interface InferPointOptions {
  /** Ctrl (or an equivalent UI gesture) suppresses auto-created relations. */
  suppressAutomaticRelations?: boolean
  toleranceMm?: number
}

const distanceSquared = (first: ModelPoint, second: ModelPoint) => (first.x - second.x) ** 2 + (first.y - second.y) ** 2

/**
 * Resolve a click without mutating sketch state. Stable endpoints and the origin
 * are considered before horizontal/vertical inference, so a nearby endpoint is
 * never lost to a weaker directional suggestion.
 */
export function inferSketchPoint(
  rawPoint: ModelPoint,
  candidates: readonly InferencePoint[],
  previousPoint?: InferencePoint,
  options: InferPointOptions = {},
): InferenceResult {
  const tolerance = options.toleranceMm ?? 0.5
  if (!Number.isFinite(rawPoint.x) || !Number.isFinite(rawPoint.y) || tolerance < 0) throw new Error('A finite model-space point and a non-negative tolerance are required.')

  const nearby = candidates
    .filter((candidate) => distanceSquared(rawPoint, candidate) <= tolerance ** 2)
    .sort((first, second) => {
      const firstRank = first.origin ? 0 : 1
      const secondRank = second.origin ? 0 : 1
      return firstRank - secondRank || distanceSquared(rawPoint, first) - distanceSquared(rawPoint, second) || first.id.localeCompare(second.id)
    })[0]
  if (nearby) {
    return {
      point: { x: nearby.x, y: nearby.y },
      snappedPointId: nearby.id,
      proposal: options.suppressAutomaticRelations ? undefined : { type: 'coincident', pointId: nearby.id },
    }
  }

  if (!previousPoint) return { point: { ...rawPoint } }
  const dx = Math.abs(rawPoint.x - previousPoint.x)
  const dy = Math.abs(rawPoint.y - previousPoint.y)
  if (dx <= tolerance || dy <= tolerance) {
    const vertical = dx <= dy
    const point = vertical
      ? { x: previousPoint.x, y: rawPoint.y }
      : { x: rawPoint.x, y: previousPoint.y }
    return {
      point,
      proposal: options.suppressAutomaticRelations ? undefined : vertical
        ? { type: 'vertical', referencePointId: previousPoint.id }
        : { type: 'horizontal', referencePointId: previousPoint.id },
    }
  }
  return { point: { ...rawPoint } }
}
