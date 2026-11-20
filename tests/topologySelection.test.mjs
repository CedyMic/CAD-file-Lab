import assert from 'node:assert/strict'
import test from 'node:test'
import { findTopologyGroup, validateTopologyReference } from '../src/cad/topologySelection.ts'

test('locates the exact face or edge group', () => {
  const groups = [{ start: 0, count: 6, edgeId: 11 }, { start: 6, count: 4, edgeId: 12 }]
  assert.equal(findTopologyGroup(groups, 7)?.edgeId, 12)
  assert.equal(findTopologyGroup(groups, 12), null)
  assert.equal(findTopologyGroup(groups, -1), null)
})

test('rejects stale topology identifiers after edits and undo', () => {
  const selected = { kind: 'face', bodyId: 'body-1', entityId: 42, revision: 3 }
  assert.deepEqual(validateTopologyReference(selected, 'body-1', 3), selected)
  assert.throws(() => validateTopologyReference(selected, 'body-1', 4), /out of date/)
  assert.throws(() => validateTopologyReference(selected, 'body-2', 3), /out of date/)
  assert.throws(() => validateTopologyReference({ ...selected, entityId: 0 }, 'body-1', 3), /invalid topology/)
})
