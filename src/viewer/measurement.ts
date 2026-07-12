export type MeasurementPoint = readonly [number, number, number]

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
