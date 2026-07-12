import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const provenance = JSON.parse(
  await readFile('public/occt-provenance.json', 'utf8'),
)
const sourceOffer = await readFile('public/OCCT_SOURCE_OFFER.txt', 'utf8')
const wasm = await readFile(
  'node_modules/replicad-opencascadejs/src/replicad_single.wasm',
)

test('pins the distributed OCCT kernel to its exact source chain', () => {
  assert.equal(
    createHash('sha256').update(wasm).digest('hex'),
    provenance.artifact.sha256,
  )
  assert.match(
    provenance.buildImage.reference,
    /^donalffons\/opencascade\.js@sha256:[0-9a-f]{64}$/,
  )
  assert.match(provenance.opencascade.sourceCommit, /^[0-9a-f]{40}$/)
  assert.match(sourceOffer, new RegExp(provenance.opencascade.sourceCommit))
  assert.match(sourceOffer, new RegExp(provenance.replicad.releaseCommit))
  assert.match(sourceOffer, /GNU LGPL 2\.1/)
  assert.match(sourceOffer, /\/licenses\/OCCT-LGPL-2\.1\.txt/)
  assert.match(sourceOffer, /\/licenses\/OCCT-LGPL-EXCEPTION-1\.0\.txt/)
  assert.match(sourceOffer, /occt-kernel\.json/)
})
