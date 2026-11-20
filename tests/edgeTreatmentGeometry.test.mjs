import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { setOC, makeBox, importSTEP, exportSTEP, deserializeShape } from 'replicad'

const require = createRequire(import.meta.url)
// The distributed Emscripten loader expects Node's CommonJS globals.
globalThis.__dirname = dirname(require.resolve('replicad-opencascadejs/src/replicad_single.js'))
globalThis.require = require
const opencascadeFactory = require('replicad-opencascadejs/src/replicad_single.js').default
const wasmBinary = readFileSync(require.resolve('replicad-opencascadejs/src/replicad_single.wasm'))

test('STEP import, exact edge treatments, undo and STEP export round-trip', async () => {
  setOC(await opencascadeFactory({ wasmBinary }))
  const original = makeBox([0, 0, 0], [20, 20, 20])
  try {
    const sourceSTEP = exportSTEP([{ shape: original, name: 'Box' }], { unit: 'MM', modelUnit: 'MM' })
    assert.ok(sourceSTEP.size > 0)
    const imported = await importSTEP(sourceSTEP)
    try {
      const edges = imported.edges
      const edgeId = edges[0].hashCode
      const originalEdgeCount = edges.length
      edges.forEach((edge) => edge.delete())
      const undoSnapshot = imported.serialize()

      for (const treatment of ['fillet', 'chamfer']) {
        const modified = imported[treatment]((edge) => edge.hashCode === edgeId ? 2 : null)
        try {
          assert.equal(modified.isNull, false, `${treatment} produced a null shape`)
          const modifiedEdges = modified.edges
          assert.ok(modifiedEdges.length > originalEdgeCount, `${treatment} did not change the topology`)
          modifiedEdges.forEach((edge) => edge.delete())
          assert.ok(modified.serialize().length > 0, `${treatment} is not serializable`)

          const editedSTEP = exportSTEP([{ shape: modified, name: 'Edited' }], { unit: 'MM', modelUnit: 'MM' })
          const reimported = await importSTEP(editedSTEP)
          try {
            assert.equal(reimported.isNull, false, `${treatment} failed STEP reimport`)
            const roundtripEdges = reimported.edges
            assert.ok(roundtripEdges.length > originalEdgeCount, `${treatment} was lost in STEP export`)
            roundtripEdges.forEach((edge) => edge.delete())
          } finally {
            reimported.delete()
          }
        } finally {
          modified.delete()
        }
      }

      const undone = deserializeShape(undoSnapshot).asShape3D()
      try {
        assert.equal(undone.isNull, false)
        const restoredEdges = undone.edges
        assert.equal(restoredEdges.length, originalEdgeCount)
        restoredEdges.forEach((edge) => edge.delete())
      } finally {
        undone.delete()
      }
    } finally {
      imported.delete()
    }
  } finally {
    original.delete()
  }
})
