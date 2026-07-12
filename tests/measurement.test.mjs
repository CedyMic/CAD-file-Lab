import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addDistancePoint,
  emptyDistanceMeasurement,
  formatDistanceMillimetres,
  getDistanceMillimetres,
  pointToPointDistance,
  parallelFaceDistance,
  faceAngleDegrees,
} from '../src/viewer/measurement.ts'

test('calculates a three-dimensional point-to-point distance', () => {
  assert.equal(pointToPointDistance([1, 2, 3], [4, 6, 15]), 13)
})

test('measures the perpendicular gap between parallel planar faces', () => {
  assert.equal(parallelFaceDistance(
    { point: [3, 2, 0], normal: [0, 0, 1] },
    { point: [20, -4, 8], normal: [0, 0, -2] },
  ), 8)
})

test('does not report a face gap for nonparallel faces', () => {
  assert.equal(parallelFaceDistance(
    { point: [0, 0, 0], normal: [0, 0, 1] },
    { point: [0, 5, 0], normal: [0, 1, 0] },
  ), null)
})

test('measures the acute angle between face planes', () => {
  assert.equal(faceAngleDegrees(
    { point: [0, 0, 0], normal: [0, 0, 1] },
    { point: [0, 0, 0], normal: [0, 1, 0] },
  ), 90)
  assert.ok(Math.abs(faceAngleDegrees(
    { point: [0, 0, 0], normal: [1, 0, 0] },
    { point: [0, 0, 0], normal: [1, 1, 0] },
  ) - 45) < 1e-10)
})

test('selects two points and starts a fresh measurement on the third', () => {
  const one = addDistancePoint(emptyDistanceMeasurement, [0, 0, 0])
  const two = addDistancePoint(one, [3, 4, 0])
  assert.equal(getDistanceMillimetres(two), 5)

  const restarted = addDistancePoint(two, [9, 8, 7])
  assert.deepEqual(restarted.points, [[9, 8, 7]])
  assert.equal(getDistanceMillimetres(restarted), null)
})

test('rejects invalid points and formats millimetres at useful precision', () => {
  assert.throws(
    () => addDistancePoint(emptyDistanceMeasurement, [0, Number.NaN, 0]),
    /finite coordinates/,
  )
  assert.equal(formatDistanceMillimetres(4.1254), '4.125 mm')
  assert.equal(formatDistanceMillimetres(42.125), '42.13 mm')
  assert.equal(formatDistanceMillimetres(420.15), '420.1 mm')
})
