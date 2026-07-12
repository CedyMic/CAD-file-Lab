import assert from 'node:assert/strict'
import test from 'node:test'

import { updateBodySelection } from '../src/viewer/bodySelection.ts'

test('a normal click selects one body and clicking it again clears selection', () => {
  const selected = updateBodySelection(new Set(), 'body-1', false)
  assert.deepEqual([...selected], ['body-1'])
  assert.equal(updateBodySelection(selected, 'body-1', false).size, 0)
})

test('a normal click replaces a multi-selection', () => {
  const selected = updateBodySelection(new Set(['body-1', 'body-2']), 'body-2', false)
  assert.deepEqual([...selected], ['body-2'])
})

test('modifier clicks add and remove individual bodies', () => {
  const added = updateBodySelection(new Set(['body-1']), 'body-2', true)
  assert.deepEqual([...added], ['body-1', 'body-2'])
  assert.deepEqual([...updateBodySelection(added, 'body-1', true)], ['body-2'])
})
