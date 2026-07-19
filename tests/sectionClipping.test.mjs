import assert from 'node:assert/strict'
import test from 'node:test'

import { createSectionPlane, defaultSectionSettings } from '../src/viewer/sectionClipping.ts'

const model = {
  bodyId: 'body-1',
  fileName: 'offset.step',
  faces: { vertices: [10, 20, 30, 14, 28, 36], normals: [], triangles: [] },
  edges: { lines: [] },
}

const layout = { position: [-12, -30, 24], target: [0, 3, 0], radius: 5 }

test('places the default X section at the model midpoint', () => {
  assert.deepEqual(createSectionPlane(model, layout, defaultSectionSettings), {
    normal: [1, 0, 0], constant: 0, modelCoordinate: 12,
  })
})

test('maps model Y and Z axes into the Y-up viewer', () => {
  assert.deepEqual(createSectionPlane(model, layout, { axis: 'y', position: 25, flip: false }), {
    normal: [0, 0, -1], constant: 2, modelCoordinate: 22,
  })
  assert.deepEqual(createSectionPlane(model, layout, { axis: 'z', position: 100, flip: false }), {
    normal: [0, 1, 0], constant: -6, modelCoordinate: 36,
  })
})

test('clamps position and flips the complete plane equation', () => {
  assert.deepEqual(createSectionPlane(model, layout, { axis: 'x', position: 200, flip: true }), {
    normal: [-1, 0, 0], constant: 2, modelCoordinate: 14,
  })
})

test('returns no plane for a model without renderable points', () => {
  assert.equal(createSectionPlane({ ...model, faces: { ...model.faces, vertices: [] } }, layout, defaultSectionSettings), null)
})
