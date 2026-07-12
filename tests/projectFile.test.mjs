import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAD_LAB_PROJECT_EXTENSION,
  MAX_CAD_LAB_PROJECT_BYTES,
  createCadLabProjectFile,
  getCadLabDownloadName,
  parseCadLabProjectFile,
} from '../src/cad/projectFile.ts'

const displaySettings = {
  displayStyle: 'shaded-edges',
  projection: 'perspective',
  modelColor: '#dce8f5',
  edgeColor: '#17212b',
  backgroundColor: '#f4f7fa',
  gridColor: '#8091a3',
  showGrid: true,
  showAxes: true,
  showViewCube: true,
  brightness: 1.25,
  edgeOpacity: 0.8,
  modelOpacity: 1,
}

const serializedProject = {
  version: 1,
  bodyId: 'body-123',
  fileName: 'bracket.step',
  serializedShape: '{"shape":"exact-browser-local-data"}',
  savedAt: 1_750_000_000_000,
}

function createValidProjectFile() {
  return {
    format: 'cad-file-lab-project',
    version: 1,
    exportedAt: 1_750_000_000_100,
    project: { ...serializedProject },
    displaySettings: { ...displaySettings },
  }
}

function expectInvalid(projectFile) {
  assert.throws(
    () => parseCadLabProjectFile(JSON.stringify(projectFile)),
    /invalid or uses an unsupported version/,
  )
}

test('creates and parses a versioned project envelope', () => {
  const created = createCadLabProjectFile(
    serializedProject,
    displaySettings,
  )

  assert.equal(created.format, 'cad-file-lab-project')
  assert.equal(created.version, 1)
  assert.ok(created.exportedAt > 0)
  assert.deepEqual(created.project, serializedProject)
  assert.deepEqual(created.displaySettings, displaySettings)
  assert.deepEqual(
    parseCadLabProjectFile(JSON.stringify(created)),
    created,
  )
})

test('preserves editable primitive parameters and rejects invalid metadata', () => {
  const file = createValidProjectFile()
  file.project.primitive = { type: 'cone', baseRadius: 24, topRadius: 6, height: 50 }
  assert.deepEqual(parseCadLabProjectFile(JSON.stringify(file)).project.primitive, file.project.primitive)

  file.project.primitive = { type: 'sphere', radius: 0 }
  expectInvalid(file)
})

test('rejects malformed JSON with a user-facing error', () => {
  assert.throws(
    () => parseCadLabProjectFile('{not-json'),
    /not a valid CAD File Lab project file/,
  )
})

test('rejects unsupported envelopes and incomplete geometry', () => {
  for (const mutate of [
    (file) => { file.format = 'another-format' },
    (file) => { file.version = 2 },
    (file) => { file.exportedAt = 0 },
    (file) => { file.project.version = 2 },
    (file) => { file.project.bodyId = '' },
    (file) => { file.project.fileName = '' },
    (file) => { file.project.serializedShape = '' },
    (file) => { file.project.savedAt = -1 },
  ]) {
    const file = createValidProjectFile()
    mutate(file)
    expectInvalid(file)
  }
})

test('rejects invalid display settings and out-of-range values', () => {
  for (const mutate of [
    (settings) => { settings.displayStyle = 'x-ray' },
    (settings) => { settings.projection = 'fisheye' },
    (settings) => { settings.modelColor = 'red' },
    (settings) => { settings.showGrid = 'yes' },
    (settings) => { settings.brightness = 4.01 },
    (settings) => { settings.edgeOpacity = -0.01 },
    (settings) => { settings.modelOpacity = 1.01 },
  ]) {
    const file = createValidProjectFile()
    mutate(file.displaySettings)
    expectInvalid(file)
  }
})

test('sanitizes portable project download names', () => {
  assert.equal(CAD_LAB_PROJECT_EXTENSION, '.cadlab')
  assert.equal(
    getCadLabDownloadName('My bracket (final).STEP'),
    'My-bracket-final.cadlab',
  )
  assert.equal(
    getCadLabDownloadName('../../secret.step'),
    'secret.cadlab',
  )
  assert.equal(
    getCadLabDownloadName('.step'),
    'cad-project.cadlab',
  )
  assert.ok(
    getCadLabDownloadName(`${'a'.repeat(200)}.step`).length <=
      120 + CAD_LAB_PROJECT_EXTENSION.length,
  )
})

test('keeps the pre-parse size limit at 512 MiB', () => {
  assert.equal(MAX_CAD_LAB_PROJECT_BYTES, 512 * 1024 * 1024)
})
