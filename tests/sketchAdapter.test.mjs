import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SketchAdapterError,
  cadFeatureDocumentToLegacyModel,
  deriveClosedSketchProfile,
  modelSpaceToSketchDocument,
  sketchDocumentToModelSpace,
} from '../src/cad/sketchAdapter.ts'
import { migrateCadFeatureModel } from '../src/cad/featureModel.ts'

const rectangleDocument = {
  version: 1,
  entities: [
    { id: 'bottom', type: 'line', start: [0, 0], end: [40, 0] },
    { id: 'right', type: 'line', start: [40, 0], end: [40, 20] },
    { id: 'top', type: 'line', start: [40, 20], end: [0, 20] },
    { id: 'left', type: 'line', start: [0, 20], end: [0, 0], construction: true },
  ],
  constraints: [
    { id: 'bottom-horizontal', type: 'horizontal', entityId: 'bottom' },
    { id: 'right-vertical', type: 'vertical', entityId: 'right' },
    { id: 'join-bottom-right', type: 'coincident', firstEntityId: 'bottom', firstEnd: 'end', secondEntityId: 'right', secondEnd: 'start' },
    { id: 'parallel-sides', type: 'parallel', firstEntityId: 'right', secondEntityId: 'left' },
  ],
  dimensions: [],
}

test('adapts coordinate entities to stable shared points and preserves supported relations', () => {
  const canonical = sketchDocumentToModelSpace(rectangleDocument)
  assert.equal(canonical.version, 2)
  assert.equal(canonical.points.length, 4)
  assert.equal(canonical.entities[0].endPointId, canonical.entities[1].startPointId)
  assert.equal(canonical.entities[3].construction, true)
  assert.deepEqual(canonical.relations.map(({ type }) => type), ['horizontal', 'vertical', 'parallel'])

  const restored = modelSpaceToSketchDocument(canonical)
  assert.deepEqual(restored.entities, rectangleDocument.entities)
  assert.ok(restored.constraints.some((constraint) => constraint.type === 'horizontal' && constraint.entityId === 'bottom'))
  assert.ok(restored.constraints.some((constraint) => constraint.type === 'parallel' && constraint.firstEntityId === 'right'))
  assert.ok(restored.constraints.some((constraint) => constraint.type === 'coincident' && constraint.firstEntityId === 'bottom' && constraint.secondEntityId === 'right'))
})

test('preserves explicit coincident relations between different model-space point IDs', () => {
  const source = {
    version: 1,
    entities: [
      { id: 'first', type: 'line', start: [0, 0], end: [10, 0] },
      { id: 'second', type: 'line', start: [11, 0], end: [20, 0] },
    ],
    constraints: [{ id: 'join', type: 'coincident', firstEntityId: 'first', firstEnd: 'end', secondEntityId: 'second', secondEnd: 'start' }],
    dimensions: [],
  }
  const canonical = sketchDocumentToModelSpace(source)
  assert.deepEqual(canonical.relations, [{ id: 'join', type: 'coincident', firstPointId: canonical.entities[0].endPointId, secondPointId: canonical.entities[1].startPointId }])
  assert.deepEqual(modelSpaceToSketchDocument(canonical).constraints, source.constraints)
})

test('refuses unsupported V1 data instead of dropping it silently', () => {
  assert.throws(
    () => sketchDocumentToModelSpace({ version: 1, entities: [{ id: 'arc', type: 'arc', center: [0, 0], radius: 10, startAngle: 0, endAngle: 90 }], constraints: [], dimensions: [] }),
    (error) => error instanceof SketchAdapterError && error.code === 'unsupported-arc',
  )
  assert.throws(
    () => sketchDocumentToModelSpace({ ...rectangleDocument, dimensions: [{ id: 'length', type: 'length', entityId: 'bottom', value: 40, position: [20, -5] }] }),
    (error) => error instanceof SketchAdapterError && error.code === 'unsupported-dimension',
  )
})

test('derives closed line and circle profiles with actionable diagnostics', () => {
  const rectangle = sketchDocumentToModelSpace({
    ...rectangleDocument,
    entities: rectangleDocument.entities.map((entity) => ({ ...entity, construction: false })),
  })
  const closed = deriveClosedSketchProfile(rectangle)
  assert.equal(closed.valid, true)
  assert.equal(closed.profile.type, 'polyline')
  assert.equal(closed.profile.points.length, 4)

  const open = deriveClosedSketchProfile({ ...rectangle, entities: rectangle.entities.slice(0, 3), relations: rectangle.relations.filter((relation) => !('entityId' in relation) || relation.entityId !== 'left').filter((relation) => !('secondEntityId' in relation) || relation.secondEntityId !== 'left') })
  assert.deepEqual(open, { valid: false, diagnostic: 'open' })

  const circle = sketchDocumentToModelSpace({ version: 1, entities: [{ id: 'circle', type: 'circle', center: [5, 7], radius: 12 }], constraints: [], dimensions: [] })
  assert.deepEqual(deriveClosedSketchProfile(circle), {
    valid: true,
    profile: { type: 'circle', centerPointId: circle.points[0].id, center: { x: 5, y: 7 }, radius: 12 },
  })
})

test('opens canonical sketch and extrusion history in the current editor', () => {
  const legacy = {
    version: 1,
    features: [{ id: 'boss', type: 'sketchExtrude', name: 'Boss-Extrude1', plane: 'XZ', planeOffset: 5, profile: { type: 'rectangle', width: 40, height: 20 }, operation: 'boss', length: 12, reversed: true }],
  }
  const restored = cadFeatureDocumentToLegacyModel(migrateCadFeatureModel(legacy))
  assert.equal(restored.features[0].plane, 'XZ')
  assert.equal(restored.features[0].planeOffset, 5)
  assert.equal(restored.features[0].profile.type, 'polyline')
  assert.equal(restored.features[0].length, 12)
  assert.equal(restored.features[0].reversed, true)
})
