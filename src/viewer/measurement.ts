export type MeasurementPoint = readonly [number, number, number]
export type MeasurementNormal = readonly [number, number, number]

export interface FaceSample {
  point: MeasurementPoint
  normal: MeasurementNormal
  triangle?: readonly [MeasurementPoint, MeasurementPoint, MeasurementPoint]
  surfaceTriangles?: readonly MeasurementPoint[]
  entityId?: string
}

export interface DistanceMeasurement {
  points: readonly MeasurementPoint[]
}

export const emptyDistanceMeasurement: DistanceMeasurement = {
  points: [],
}

export function addDistancePoint(
  measurement: DistanceMeasurement,
  point: MeasurementPoint,
): DistanceMeasurement {
  if (
    point.length !== 3 ||
    !point.every(Number.isFinite)
  ) {
    throw new Error('A measurement point must contain three finite coordinates.')
  }

  const safePoint: MeasurementPoint = [point[0], point[1], point[2]]

  if (measurement.points.length >= 2) {
    return { points: [safePoint] }
  }

  return {
    points: [...measurement.points, safePoint],
  }
}

export function pointToPointDistance(
  first: MeasurementPoint,
  second: MeasurementPoint,
): number {
  return Math.hypot(
    second[0] - first[0],
    second[1] - first[1],
    second[2] - first[2],
  )
}

export function coordinateDeltas(first: MeasurementPoint, second: MeasurementPoint): MeasurementPoint {
  return [
    second[0] - first[0],
    second[1] - first[1],
    second[2] - first[2],
  ]
}

export function getDistanceMillimetres(
  measurement: DistanceMeasurement,
): number | null {
  if (measurement.points.length !== 2) return null
  return pointToPointDistance(measurement.points[0], measurement.points[1])
}

export function formatDistanceMillimetres(distance: number): string {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new Error('Distance must be a finite non-negative number.')
  }

  const decimals = distance >= 100 ? 1 : distance >= 10 ? 2 : 3
  return `${distance.toFixed(decimals)} mm`
}

export function parallelFaceDistance(
  first: FaceSample,
  second: FaceSample,
  parallelTolerance = 0.995,
): number | null {
  const lengthA = Math.hypot(...first.normal)
  const lengthB = Math.hypot(...second.normal)
  if (lengthA === 0 || lengthB === 0) throw new Error('Face normals must have a direction.')

  const normalA = first.normal.map((value) => value / lengthA) as unknown as MeasurementNormal
  const normalB = second.normal.map((value) => value / lengthB) as unknown as MeasurementNormal
  const alignment = Math.abs(
    normalA[0] * normalB[0] + normalA[1] * normalB[1] + normalA[2] * normalB[2],
  )
  if (alignment < parallelTolerance) return null

  return Math.abs(
    (second.point[0] - first.point[0]) * normalA[0] +
    (second.point[1] - first.point[1]) * normalA[1] +
    (second.point[2] - first.point[2]) * normalA[2],
  )
}

export function faceAngleDegrees(first: FaceSample, second: FaceSample): number {
  const lengthA = Math.hypot(...first.normal)
  const lengthB = Math.hypot(...second.normal)
  if (lengthA === 0 || lengthB === 0) throw new Error('Face normals must have a direction.')
  const dot = (
    first.normal[0] * second.normal[0] +
    first.normal[1] * second.normal[1] +
    first.normal[2] * second.normal[2]
  ) / (lengthA * lengthB)
  return Math.acos(Math.min(1, Math.max(-1, Math.abs(dot)))) * 180 / Math.PI
}

export function circularPolylineRadius(points: readonly MeasurementPoint[]): number | null {
  if (points.length < 8) return null
  const chain = points.filter((_, index) => index % 2 === 0)
  chain.push(points[points.length - 1])
  const distance = (a: MeasurementPoint, b: MeasurementPoint) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const scale = Math.max(...chain.slice(1).map((point) => distance(chain[0], point)), 1)
  if (distance(chain[0], chain[chain.length - 1]) > scale * 1e-3) return null
  const p1 = chain[0]
  const p2 = chain[Math.floor((chain.length - 1) / 3)]
  const p3 = chain[Math.floor((chain.length - 1) * 2 / 3)]
  const a = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]]
  const b = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]]
  const cross = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const n = cross(a, b)
  const n2 = n.reduce((sum, value) => sum + value * value, 0)
  if (n2 < 1e-16) return null
  const a2 = a.reduce((sum, value) => sum + value * value, 0)
  const b2 = b.reduce((sum, value) => sum + value * value, 0)
  const bCrossN = cross(b, n)
  const nCrossA = cross(n, a)
  const center = p1.map((value, index) => value + (a2 * bCrossN[index] + b2 * nCrossA[index]) / (2 * n2)) as unknown as MeasurementPoint
  const radius = distance(center, p1)
  if (!Number.isFinite(radius) || radius <= 0) return null
  const maximumError = Math.max(...chain.map((point) => Math.abs(distance(center, point) - radius)))
  return maximumError <= Math.max(radius * 0.01, 1e-4) ? radius : null
}
