import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/cad/sketchModel.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
const { createSketchEditorState, reduceSketch, snapSketchPoint, validateSketchDocument } = await import(moduleUrl)

const line = { id: 'line-1', type: 'line', start: [0, 0], end: [40, 0] }

test('adds, selects, updates, removes, undoes and redoes sketch entities', () => {
  let state = createSketchEditorState()
  state = reduceSketch(state, { type: 'addEntity', entity: line })
  state = reduceSketch(state, { type: 'select', entityId: line.id })
  assert.deepEqual(state.selectedEntityIds, [line.id])
  state = reduceSketch(state, { type: 'updateEntity', entity: { ...line, end: [50, 0] } })
  assert.equal(state.document.entities[0].end[0], 50)
  state = reduceSketch(state, { type: 'undo' })
  assert.equal(state.document.entities[0].end[0], 40)
  state = reduceSketch(state, { type: 'redo' })
  assert.equal(state.document.entities[0].end[0], 50)
  state = reduceSketch(state, { type: 'removeEntities', entityIds: [line.id] })
  assert.equal(state.document.entities.length, 0)
})

test('removes dependent constraints and dimensions with an entity', () => {
  let state = createSketchEditorState({ version: 1, entities: [line], constraints: [{ id: 'horizontal-1', type: 'horizontal', entityId: line.id }], dimensions: [{ id: 'length-1', type: 'length', entityId: line.id, value: 40, position: [20, -5] }] })
  state = reduceSketch(state, { type: 'removeEntities', entityIds: [line.id] })
  assert.equal(state.document.constraints.length, 0)
  assert.equal(state.document.dimensions.length, 0)
})

test('snaps endpoints before horizontal and vertical inference', () => {
  const document = { version: 1, entities: [line], constraints: [], dimensions: [] }
  assert.deepEqual(snapSketchPoint([39, 2], document, [20, 20]), { point: [40, 0], inference: 'coincident' })
  assert.deepEqual(snapSketchPoint([22, 60], document, [20, 20]), { point: [20, 60], inference: 'vertical' })
  assert.deepEqual(snapSketchPoint([70, 18], document, [20, 20]), { point: [70, 20], inference: 'horizontal' })
})

test('validates lines, circles, arcs, constraints and dimensions', () => {
  const document = { version: 1, entities: [line, { id: 'circle-1', type: 'circle', center: [20, 20], radius: 10 }, { id: 'arc-1', type: 'arc', center: [0, 0], radius: 5, startAngle: 0, endAngle: 90 }], constraints: [], dimensions: [] }
  assert.equal(validateSketchDocument(document).entities.length, 3)
  assert.throws(() => validateSketchDocument({ ...document, entities: [{ ...line, end: [0, 0] }] }), /different valid points/)
})
