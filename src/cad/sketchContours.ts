import type { ModelPoint } from './sketchInference'

export interface ContourPoint extends ModelPoint {
  id: string
}

export interface ContourSegment {
  id: string
  startPointId: string
  endPointId: string
}

export interface ContourValidation {
  valid: boolean
  reason?: 'empty' | 'open' | 'zero-length' | 'duplicate' | 'self-intersecting' | 'missing-point'
}

const orientation = (a: ModelPoint, b: ModelPoint, c: ModelPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
const onSegment = (a: ModelPoint, b: ModelPoint, point: ModelPoint) =>
  Math.min(a.x, b.x) <= point.x && point.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= point.y && point.y <= Math.max(a.y, b.y)

function segmentsIntersect(firstStart: ModelPoint, firstEnd: ModelPoint, secondStart: ModelPoint, secondEnd: ModelPoint): boolean {
  const firstA = orientation(firstStart, firstEnd, secondStart)
  const firstB = orientation(firstStart, firstEnd, secondEnd)
  const secondA = orientation(secondStart, secondEnd, firstStart)
  const secondB = orientation(secondStart, secondEnd, firstEnd)
  if (((firstA > 0 && firstB < 0) || (firstA < 0 && firstB > 0)) && ((secondA > 0 && secondB < 0) || (secondA < 0 && secondB > 0))) return true
  return (firstA === 0 && onSegment(firstStart, firstEnd, secondStart)) || (firstB === 0 && onSegment(firstStart, firstEnd, secondEnd)) || (secondA === 0 && onSegment(secondStart, secondEnd, firstStart)) || (secondB === 0 && onSegment(secondStart, secondEnd, firstEnd))
}

/** Validate that line segments form one simple, closed profile suitable for a solid feature. */
export function validateClosedContour(points: readonly ContourPoint[], segments: readonly ContourSegment[]): ContourValidation {
  if (segments.length < 3) return { valid: false, reason: 'empty' }
  const pointById = new Map(points.map((point) => [point.id, point]))
  const degree = new Map<string, number>()
  const uniqueEdges = new Set<string>()
  for (const segment of segments) {
    const start = pointById.get(segment.startPointId)
    const end = pointById.get(segment.endPointId)
    if (!start || !end) return { valid: false, reason: 'missing-point' }
    if (start.id === end.id || Math.hypot(start.x - end.x, start.y - end.y) <= 1e-9) return { valid: false, reason: 'zero-length' }
    const edge = [start.id, end.id].sort().join('\u0000')
    if (uniqueEdges.has(edge)) return { valid: false, reason: 'duplicate' }
    uniqueEdges.add(edge)
    degree.set(start.id, (degree.get(start.id) ?? 0) + 1)
    degree.set(end.id, (degree.get(end.id) ?? 0) + 1)
  }
  if ([...degree.values()].some((value) => value !== 2)) return { valid: false, reason: 'open' }
  const visited = new Set<string>()
  const stack = [segments[0].startPointId]
  while (stack.length) {
    const id = stack.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const segment of segments) {
      if (segment.startPointId === id) stack.push(segment.endPointId)
      if (segment.endPointId === id) stack.push(segment.startPointId)
    }
  }
  if (visited.size !== degree.size) return { valid: false, reason: 'open' }
  for (let index = 0; index < segments.length; index += 1) for (let otherIndex = index + 1; otherIndex < segments.length; otherIndex += 1) {
    const first = segments[index]
    const second = segments[otherIndex]
    if (first.startPointId === second.startPointId || first.startPointId === second.endPointId || first.endPointId === second.startPointId || first.endPointId === second.endPointId) continue
    if (segmentsIntersect(pointById.get(first.startPointId)!, pointById.get(first.endPointId)!, pointById.get(second.startPointId)!, pointById.get(second.endPointId)!)) return { valid: false, reason: 'self-intersecting' }
  }
  return { valid: true }
}
