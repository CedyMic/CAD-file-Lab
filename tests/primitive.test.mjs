import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_PRIMITIVE_DIMENSION_MM, getPrimitiveFileName, validateCadPrimitive } from '../src/cad/primitive.ts'

test('validates all primitive definitions without retaining caller objects', () => {
  const box = { type: 'box', width: 10, depth: 20, height: 30 }
  const result = validateCadPrimitive(box)
  assert.deepEqual(result, box)
  assert.notEqual(result, box)
  assert.equal(getPrimitiveFileName(result), 'Box.step')
  const cylinder = validateCadPrimitive({ type: 'cylinder', radius: 5.5, height: 12 })
  assert.deepEqual(cylinder, { type: 'cylinder', radius: 5.5, height: 12 })
  assert.equal(getPrimitiveFileName(cylinder), 'Cylinder.step')
  const sphere = validateCadPrimitive({ type: 'sphere', radius: 8 })
  assert.deepEqual(sphere, { type: 'sphere', radius: 8 })
  assert.equal(getPrimitiveFileName(sphere), 'Sphere.step')
  const cone = validateCadPrimitive({ type: 'cone', baseRadius: 8, topRadius: 0, height: 16 })
  assert.deepEqual(cone, { type: 'cone', baseRadius: 8, topRadius: 0, height: 16 })
  assert.equal(getPrimitiveFileName(cone), 'Cone.step')
})

test('rejects invalid and unsafe dimensions', () => {
  for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, MAX_PRIMITIVE_DIMENSION_MM + 1]) {
    assert.throws(() => validateCadPrimitive({ type: 'box', width, depth: 2, height: 3 }), /Width/)
  }
  assert.throws(() => validateCadPrimitive({ type: 'cylinder', radius: 0, height: 2 }), /Radius.*positive/)
  assert.throws(() => validateCadPrimitive({ type: 'sphere', radius: -1 }), /Radius.*positive/)
  assert.throws(() => validateCadPrimitive({ type: 'cone', baseRadius: 2, topRadius: -1, height: 3 }), /Top radius/)
  assert.throws(() => validateCadPrimitive({ type: 'cone', baseRadius: 2, topRadius: 2, height: 3 }), /must differ/)
})

test('rejects unknown primitive types at runtime', () => {
  assert.throws(() => validateCadPrimitive({ type: 'torus', radius: 2 }), /supported primitive type/)
})
