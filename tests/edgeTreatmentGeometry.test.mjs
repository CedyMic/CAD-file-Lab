import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { setOC, makeBox } from 'replicad'

const require = createRequire(import.meta.url)
// The distributed Emscripten loader expects Node's CommonJS globals.
globalThis.__dirname = dirname(require.resolve('replicad-opencascadejs/src/replicad_single.js'))
globalThis.require = require
const opencascadeFactory = require('replicad-opencascadejs/src/replicad_single.js').default
const wasmBinary = readFileSync(require.resolve('replicad-opencascadejs/src/replicad_single.wasm'))

test('exact fillet and chamfer each modify one B-Rep edge', async () => {
  setOC(await opencascadeFactory({ wasmBinary }))
  const original = makeBox([0, 0, 0], [20, 20, 20])
  try {
    const edges = original.edges
    const edgeId = edges[0].hashCode
    const originalEdgeCount = edges.length
    edges.forEach((edge) => edge.delete())

    for (const treatment of ['fillet', 'chamfer']) {
      const modified = original[treatment]((edge) => edge.hashCode === edgeId ? 2 : null)
      try {
        assert.equal(modified.isNull, false, `${treatment} produced a null shape`)
        const modifiedEdges = modified.edges
        assert.ok(modifiedEdges.length > originalEdgeCount, `${treatment} did not change the topology`)
        modifiedEdges.forEach((edge) => edge.delete())
        assert.ok(modified.serialize().length > 0, `${treatment} is not serializable`)
      } finally {
        modified.delete()
      }
    }
  } finally {
    original.delete()
  }
})
