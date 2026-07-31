import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getFeatureModelFileName,
  migrateCadFeatureModel,
  normalizeCadFeatureDocument,
  validateCadFeatureDocument,
  validateCadFeatureModel,
  validateModelSpaceSketch,
} from '../src/cad/featureModel.ts'

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

test('migrates a legacy rectangle into separate model-space sketch and extrusion features', () => {
  const migrated = migrateCadFeatureModel({ version: 1, features: [boss] })
  assert.equal(migrated.version, 2)
  assert.deepEqual(migrated.features.map((feature) => feature.type), ['sketch', 'extrude'])

  const [sketch, extrude] = migrated.features
  assert.equal(sketch.support.kind, 'principal')
  assert.equal(sketch.support.plane, 'XY')
  assert.equal(sketch.sketch.points.length, 4)
  assert.equal(sketch.sketch.entities.length, 4)
  assert.equal(sketch.sketch.relations.length, 4)
  assert.equal(sketch.sketch.entities[0].endPointId, sketch.sketch.entities[1].startPointId)
  assert.equal(sketch.sketch.entities.at(-1).endPointId, sketch.sketch.entities[0].startPointId)
  assert.deepEqual(sketch.sketch.points.map(({ x, y }) => [x, y]), [[-50, -30], [50, -30], [50, 30], [-50, 30]])
  assert.equal(extrude.id, boss.id)
  assert.equal(extrude.sketchId, sketch.id)
  assert.equal(extrude.distance, boss.length)
})

test('preserves legacy circle, polyline, offset, angle, and operation data during migration', () => {
  const migrated = migrateCadFeatureModel({ version: 1, features: [
    { ...boss, plane: 'XZ', planeOffset: -12.5, planeAngle: 30, planeAngleAxis: 'vertical', profile: { type: 'circle', radius: 7 } },
    { ...boss, id: 'cut', name: 'Cut', operation: 'cut', reversed: true, profile: { type: 'polyline', points: [[1, 2], [8, 2], [4, 9]] } },
  ] })
  assert.deepEqual(migrated.features.map((feature) => feature.type), ['referencePlane', 'sketch', 'extrude', 'sketch', 'extrude'])
  const [plane, circleSketch, firstExtrude, polylineSketch, cut] = migrated.features
  assert.equal(plane.offset, -12.5)
  assert.deepEqual(plane.angle, { degrees: 30, axis: 'v' })
  assert.deepEqual(circleSketch.support, { kind: 'referencePlane', featureId: plane.id })
  assert.equal(circleSketch.sketch.entities[0].radius, 7)
  assert.deepEqual(polylineSketch.sketch.points.map(({ x, y }) => [x, y]), [[1, 2], [8, 2], [4, 9]])
  assert.equal(firstExtrude.operation, 'boss')
  assert.equal(cut.operation, 'cut')
  assert.equal(cut.reversed, true)
})

test('validates V2 references, stable IDs, and relation targets', () => {
  const sketch = {
    version: 2,
    points: [{ id: 'p1', x: 0, y: 0 }, { id: 'p2', x: 20, y: 0 }],
    entities: [{ id: 'line1', type: 'line', startPointId: 'p1', endPointId: 'p2' }],
    relations: [{ id: 'horizontal1', type: 'horizontal', entityId: 'line1' }],
  }
  assert.deepEqual(validateModelSpaceSketch(sketch), sketch)
  const document = { version: 2, features: [
    { id: 'sketch1', type: 'sketch', name: 'Sketch1', support: { kind: 'principal', plane: 'XY' }, sketch },
    { id: 'extrude1', type: 'extrude', name: 'Boss-Extrude1', sketchId: 'sketch1', operation: 'boss', distance: 10, reversed: false },
  ] }
  assert.deepEqual(validateCadFeatureDocument(document), document)
  assert.deepEqual(normalizeCadFeatureDocument(document), document)

  assert.throws(() => validateModelSpaceSketch({ ...sketch, entities: [{ ...sketch.entities[0], endPointId: 'missing' }] }), /existing points/)
  assert.throws(() => validateModelSpaceSketch({ ...sketch, relations: [{ ...sketch.relations[0], entityId: 'missing' }] }), /missing entity/)
  assert.throws(() => validateCadFeatureDocument({ ...document, features: [{ ...document.features[1], sketchId: 'missing' }] }), /missing or later sketch/)
})
