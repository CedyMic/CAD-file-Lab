import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateMeshProperties,
  formatAreaMm2,
  formatVolumeMm3,
} from '../src/viewer/meshProperties.ts'

const cube = {
  vertices: [
    0, 0, 0,  2, 0, 0,  2, 3, 0,  0, 3, 0,
    0, 0, 4,  2, 0, 4,  2, 3, 4,  0, 3, 4,
  ],
  triangles: [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2,
    0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
  ],
}

test('calculates surface area and enclosed volume for a closed box mesh', () => {
  const properties = calculateMeshProperties(cube)
  assert.equal(properties.surfaceAreaMm2, 52)
  assert.equal(properties.enclosedVolumeMm3, 24)
  assert.equal(properties.triangleCount, 12)
  assert.equal(properties.volumeStatus, 'closed')
})

test('reports area but withholds volume for an open mesh', () => {
  const open = { ...cube, triangles: cube.triangles.slice(0, -3) }
  const properties = calculateMeshProperties(open)
  assert.equal(properties.surfaceAreaMm2, 46)
  assert.equal(properties.enclosedVolumeMm3, null)
  assert.equal(properties.volumeStatus, 'open-or-non-manifold')
})

test('withholds volume for inconsistent winding and degenerate geometry', () => {
  const reversedFace = { ...cube, triangles: [...cube.triangles] }
  reversedFace.triangles.splice(0, 3, 0, 1, 2)
  assert.equal(calculateMeshProperties(reversedFace).enclosedVolumeMm3, null)

  const flat = calculateMeshProperties({ vertices: [0, 0, 0, 1, 0, 0, 2, 0, 0], triangles: [0, 1, 2] })
  assert.equal(flat.degenerateTriangleCount, 1)
  assert.equal(flat.enclosedVolumeMm3, null)
})

test('validates mesh arrays and formats square and cubic millimetres', () => {
  assert.throws(
    () => calculateMeshProperties({ vertices: [0, 0, 0], triangles: [0, 1, 0] }),
    /invalid vertex index/,
  )
  assert.equal(formatAreaMm2(12.345), '12.35 mm²')
  assert.equal(formatVolumeMm3(24), '24 mm³')
})
