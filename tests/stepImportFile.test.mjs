import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_STEP_IMPORT_BYTES,
  validateStepImportFile,
} from '../src/cad/stepImportFile.ts'

test('accepts STEP and STP metadata at the size limit', () => {
  for (const name of [
    'assembly.step',
    'ASSEMBLY.STP',
  ]) {
    assert.doesNotThrow(() => {
      validateStepImportFile({
        name,
        size: MAX_STEP_IMPORT_BYTES,
      })
    })
  }
})

test('rejects unsupported or empty CAD files', () => {
  assert.throws(
    () => validateStepImportFile({
      name: 'mesh.stl',
      size: 1,
    }),
    /supports STEP and STP/,
  )

  assert.throws(
    () => validateStepImportFile({
      name: 'empty.step',
      size: 0,
    }),
    /empty/,
  )
})

test('rejects STEP files above the browser-local safety limit', () => {
  assert.equal(
    MAX_STEP_IMPORT_BYTES,
    256 * 1024 * 1024,
  )

  assert.throws(
    () => validateStepImportFile({
      name: 'oversized.step',
      size: MAX_STEP_IMPORT_BYTES + 1,
    }),
    /larger than 256 MiB.*browser-local parsing/,
  )
})
