import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_EXACT_CAD_EXPORT_BYTES,
  getExactCadDownloadName,
  validateExactCadExportSize,
  validateStepExportBlob,
} from '../src/cad/exactCadExport.ts'

test('sanitizes exact CAD download names', () => {
  assert.equal(getExactCadDownloadName('../bad:name.step', 'step'), 'bad_name.step')
  assert.equal(getExactCadDownloadName('part.stp', 'brep'), 'part.brep')
  assert.equal(getExactCadDownloadName('...', 'step'), 'model.step')
})

test('enforces the exact CAD export size boundary', () => {
  assert.doesNotThrow(() => validateExactCadExportSize(MAX_EXACT_CAD_EXPORT_BYTES))
  assert.throws(() => validateExactCadExportSize(0), /empty|invalid/i)
  assert.throws(() => validateExactCadExportSize(MAX_EXACT_CAD_EXPORT_BYTES + 1), /256 MiB/i)
})

test('accepts a complete STEP Part 21 envelope', async () => {
  await assert.doesNotReject(() => validateStepExportBlob(new Blob([
    'ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;',
  ])))
})

test('rejects truncated or non-STEP exact output', async () => {
  await assert.rejects(() => validateStepExportBlob(new Blob(['HEADER;'])) , /ISO 10303-21/i)
  await assert.rejects(() => validateStepExportBlob(new Blob(['ISO-10303-21;\nHEADER;'])) , /ISO 10303-21/i)
})
