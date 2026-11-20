import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyEditHistory, commitEdit, stepEditHistory, MAX_EDIT_UNDO_STEPS } from '../src/cad/editHistory.ts'

test('undo and redo return exact geometry and metadata snapshots', () => {
  const a = { geometry: 'BREP-A', metadata: [] }
  const b = { geometry: 'BREP-B', metadata: ['Move Face1'] }
  const afterEdit = commitEdit(emptyEditHistory(), a)
  const undone = stepEditHistory(afterEdit, 'undo', b)
  assert.deepEqual(undone.target, a)
  const redone = stepEditHistory(undone.history, 'redo', a)
  assert.deepEqual(redone.target, b)
})

test('new edit invalidates redo and history stays bounded', () => {
  let history = emptyEditHistory()
  for (let index = 0; index < 15; index++) history = commitEdit(history, { geometry: `BREP-${index}`, metadata: [] })
  assert.equal(history.undo.length, MAX_EDIT_UNDO_STEPS)
  const undone = stepEditHistory(history, 'undo', { geometry: 'current', metadata: [] })
  assert.equal(undone.history.redo.length, 1)
  assert.equal(commitEdit(undone.history, undone.target).redo.length, 0)
})

test('unavailable operations fail cleanly', () => {
  assert.throws(() => stepEditHistory(emptyEditHistory(), 'undo', { geometry: 'a', metadata: [] }), /no CAD edit/i)
})
