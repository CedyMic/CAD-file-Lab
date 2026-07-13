import assert from 'node:assert/strict'
import test from 'node:test'
import { getFeatureModelFileName, validateCadFeatureModel } from '../src/cad/featureModel.ts'

const boss = {
  id: 'feature-1', type: 'sketchExtrude', name: 'Base plate', plane: 'XY',
  profile: { type: 'rectangle', width: 100, height: 60 }, operation: 'boss', length: 10, reversed: false,
}

test('validates dimensioned sketch boss and cut history', () => {
  const input = { version: 1, features: [boss, {
    id: 'feature-2', type: 'sketchExtrude', name: 'Mounting hole', plane: 'XY',
    profile: { type: 'circle', radius: 8 }, operation: 'cut', length: 10, reversed: false,
  }] }
  const result = validateCadFeatureModel(input)
  assert.deepEqual(result, input)
  assert.notEqual(result, input)
  assert.equal(getFeatureModelFileName(result), 'Base-plate.step')
})

test('supports all principal sketch planes and reversed extrusions', () => {
  for (const plane of ['XY', 'XZ', 'YZ']) {
    const result = validateCadFeatureModel({ version: 1, features: [{ ...boss, plane, reversed: true }] })
    assert.equal(result.features[0].plane, plane)
    assert.equal(result.features[0].reversed, true)
  }
})

test('preserves signed offset reference planes', () => {
  const result = validateCadFeatureModel({ version: 1, features: [{ ...boss, plane: 'XZ', planeOffset: -24.5 }] })
  assert.equal(result.features[0].planeOffset, -24.5)
  assert.throws(() => validateCadFeatureModel({ version: 1, features: [{ ...boss, planeOffset: 1_000_001 }] }), /Plane offset/)
})

test('validates angled reference planes and closed line profiles', () => {
  const result = validateCadFeatureModel({ version: 1, features: [{
    ...boss, plane: 'YZ', planeAngle: 37.5, planeAngleAxis: 'vertical',
    profile: { type: 'polyline', points: [[0, 0], [50, 0], [25, 35]] },
  }] })
  assert.equal(result.features[0].planeAngle, 37.5)
  assert.equal(result.features[0].profile.points.length, 3)
  assert.throws(() => validateCadFeatureModel({ version: 1, features: [{ ...boss, planeAngle: 361 }] }), /Plane angle/)
  assert.throws(() => validateCadFeatureModel({ version: 1, features: [{ ...boss, profile: { type: 'polyline', points: [[0, 0], [1, 1]] } }] }), /at least three/)
})

test('rejects unsafe or non-buildable histories', () => {
  assert.throws(() => validateCadFeatureModel({ version: 1, features: [] }), /at least one/)
  assert.throws(() => validateCadFeatureModel({ version: 1, features: [{ ...boss, operation: 'cut' }] }), /first feature.*boss/i)
  assert.throws(() => validateCadFeatureModel({ version: 1, features: [{ ...boss, length: 0 }] }), /Extrude length/)
  assert.throws(() => validateCadFeatureModel({ version: 1, features: [boss, { ...boss }] }), /unique/)
})
