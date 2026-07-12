import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAsyncOperationQueue,
} from '../src/storage/operationQueue.ts'

function createDeferred() {
  let resolve
  let reject

  const promise = new Promise(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    },
  )

  return {
    promise,
    reject,
    resolve,
  }
}

test('runs async operations in invocation order', async () => {
  const enqueue =
    createAsyncOperationQueue()
  const firstGate = createDeferred()
  const events = []

  const first = enqueue(async () => {
    events.push('old-start')
    await firstGate.promise
    events.push('old-finish')
  })

  const second = enqueue(async () => {
    events.push('new-save')
  })

  await Promise.resolve()

  assert.deepEqual(events, ['old-start'])

  firstGate.resolve()
  await Promise.all([first, second])

  assert.deepEqual(events, [
    'old-start',
    'old-finish',
    'new-save',
  ])
})

test('continues after a failed async operation', async () => {
  const enqueue =
    createAsyncOperationQueue()
  const expectedError =
    new Error('save failed')
  const events = []

  const failed = enqueue(async () => {
    throw expectedError
  })

  const next = enqueue(async () => {
    events.push('clear')
  })

  await assert.rejects(
    failed,
    expectedError,
  )
  await next

  assert.deepEqual(events, ['clear'])
})
