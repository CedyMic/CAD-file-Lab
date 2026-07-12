import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_PRIMITIVE_DIMENSION_MM, getPrimitiveFileName, validateCadPrimitive } from '../src/cad/primitive.ts'

test('validates box and cylinder definitions without retaining caller objects', () => {
  const box = { type: 'box', width: 10, depth: 20, height: 30 }
  const result = validateCadPrimitive(box)
  assert.deepEqual(result, box)
  assert.notEqual(result, box)
  assert.equal(getPrimitiveFileName(result), 'Box.step')
  const cylinder = validateCadPrimitive({ type: 'cylinder', radius: 5.5, height: 12 })
  assert.deepEqual(cylinder, { type: 'cylinder', radius: 5.5, height: 12 })
  assert.equal(getPrimitiveFileName(cylinder), 'Cylinder.step')
})

test('rejects invalid and unsafe dimensions', () => {
  for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, MAX_PRIMITIVE_DIMENSION_MM + 1]) {
    assert.throws(() => validateCadPrimitive({ type: 'box', width, depth: 2, height: 3 }), /Width/)
  }
  assert.throws(() => validateCadPrimitive({ type: 'cylinder', radius: 0, height: 2 }), /Radius.*positive/)
})

test('rejects unknown primitive types at runtime', () => {
  assert.throws(() => validateCadPrimitive({ type: 'sphere', radius: 2 }), /supported primitive type/)
})
