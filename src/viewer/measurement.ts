export type MeasurementPoint = readonly [number, number, number]
export type MeasurementNormal = readonly [number, number, number]

export interface FaceSample {
  point: MeasurementPoint
  normal: MeasurementNormal
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
