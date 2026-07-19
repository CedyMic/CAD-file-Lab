import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMoveFaceFeature,
  validateDirectEditHistory,
  validateFaceOffset,
} from '../src/cad/directEdit.ts'

test('validates signed Move Face offset distances', () => {
  assert.equal(validateFaceOffset(12.5), 12.5)
  assert.equal(validateFaceOffset(-3), -3)
  assert.throws(() => validateFaceOffset(0), /non-zero/i)
  assert.throws(() => validateFaceOffset(Number.NaN), /non-zero/i)
  assert.throws(() => validateFaceOffset(100_001), /100,000 mm/i)
})

test('creates compact serializable Move Face history entries', () => {
  const feature = createMoveFaceFeature(42, -7.5, 3)
  assert.equal(feature.name, 'Move Face3')
  assert.equal(feature.faceId, 42)
  assert.equal(feature.distance, -7.5)
  assert.deepEqual(validateDirectEditHistory([feature]), [feature])
})

test('rejects invalid direct-edit history', () => {
  assert.throws(() => validateDirectEditHistory([{ id: 'x', type: 'moveFace', mode: 'offset', name: 'Move Face1', faceId: 0, distance: 1 }]), /face reference/i)
  assert.throws(() => validateDirectEditHistory([{ id: 'x', type: 'moveFace', mode: 'offset', name: 'Move Face1', faceId: 1, distance: 0 }]), /non-zero/i)
})
