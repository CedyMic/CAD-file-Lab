import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import fs from 'node:fs'

const files = ['sketchInference.ts', 'sketchContours.ts', 'sketchSession.ts']
const sources = files.map((file) => fs.readFileSync(new URL(`../src/cad/${file}`, import.meta.url), 'utf8'))
const compiled = sources.map((source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
const inferenceUrl = `data:text/javascript;base64,${Buffer.from(compiled[0]).toString('base64')}`
const contourUrl = `data:text/javascript;base64,${Buffer.from(compiled[1]).toString('base64')}`
const sessionSource = compiled[2].replace("'./sketchInference'", `'${inferenceUrl}'`)
const { inferSketchPoint } = await import(inferenceUrl)
const { validateClosedContour } = await import(contourUrl)
const { createSketchSession, beginLine, clickLine, escapeSketchCommand } = await import(`data:text/javascript;base64,${Buffer.from(sessionSource).toString('base64')}`)

test('endpoint and origin candidates outrank directional inference, while Ctrl suppresses proposals', () => {
  const candidates = [{ id: 'origin', x: 0, y: 0, origin: true }, { id: 'endpoint', x: 10, y: 0 }]
  assert.deepEqual(inferSketchPoint({ x: 10.1, y: 0.1 }, candidates, { id: 'previous', x: 10, y: 8 }), { point: { x: 10, y: 0 }, snappedPointId: 'endpoint', proposal: { type: 'coincident', pointId: 'endpoint' } })
  assert.deepEqual(inferSketchPoint({ x: 10.1, y: 0.1 }, candidates, { id: 'previous', x: 10, y: 8 }, { suppressAutomaticRelations: true }), { point: { x: 10, y: 0 }, snappedPointId: 'endpoint', proposal: undefined })
})

test('continuous line commits stable shared endpoints atomically and Escape has precise transitions', () => {
  let session = beginLine(createSketchSession())
  const first = clickLine(session, { x: 0, y: 0 })
  session = first.session
  assert.equal(session.points.length, 1)
  const second = clickLine(session, { x: 20, y: 0 })
  session = second.session
  assert.equal(session.segments.length, 1)
  assert.equal(session.points.length, 2)
  const third = clickLine(session, { x: 20, y: 10 })
  session = third.session
  assert.equal(session.segments[0].endPointId, session.segments[1].startPointId)
  assert.equal(escapeSketchCommand(session).command.mode, 'line-await-start')
  assert.equal(escapeSketchCommand(escapeSketchCommand(session)).command.mode, 'idle')
})

test('rejects open, zero-length, duplicate and self-intersecting contours', () => {
  const points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 0 }, { id: 'c', x: 10, y: 10 }, { id: 'd', x: 0, y: 10 }]
  const closed = [{ id: 'ab', startPointId: 'a', endPointId: 'b' }, { id: 'bc', startPointId: 'b', endPointId: 'c' }, { id: 'cd', startPointId: 'c', endPointId: 'd' }, { id: 'da', startPointId: 'd', endPointId: 'a' }]
  assert.deepEqual(validateClosedContour(points, closed), { valid: true })
  assert.equal(validateClosedContour(points, closed.slice(0, 3)).reason, 'open')
  assert.equal(validateClosedContour(points, [...closed, { id: 'ba', startPointId: 'b', endPointId: 'a' }]).reason, 'duplicate')
  assert.equal(validateClosedContour(points, [{ id: 'aa', startPointId: 'a', endPointId: 'a' }, ...closed.slice(1)]).reason, 'zero-length')
  assert.equal(validateClosedContour(points, [{ id: 'ac', startPointId: 'a', endPointId: 'c' }, { id: 'cb', startPointId: 'c', endPointId: 'b' }, { id: 'bd', startPointId: 'b', endPointId: 'd' }, { id: 'da', startPointId: 'd', endPointId: 'a' }]).reason, 'self-intersecting')
})
