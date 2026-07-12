import assert from 'node:assert/strict'
import test from 'node:test'

import {
  convertTriangleMesh,
  reduceTriangleMesh,
} from '../src/cad/meshConversion.ts'

const mesh = {
  vertices: [
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    2, 0, 0, 3, 0, 0, 2, 1, 0,
    4, 0, 0, 5, 0, 0, 4, 1, 0,
    6, 0, 0, 7, 0, 0, 6, 1, 0,
  ],
  triangles: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

test('reduces triangles evenly and removes unused vertices', () => {
  const reduced = reduceTriangleMesh(mesh, 0.5)
  assert.equal(reduced.triangles.length / 3, 2)
  assert.equal(reduced.vertices.length / 3, 6)
  assert.deepEqual(reduced.vertices.slice(9), [4, 0, 0, 5, 0, 0, 4, 1, 0])
})
test('exports a compact binary STL', async () => {
  const converted = convertTriangleMesh(mesh, {
    format: 'stl', reductionRatio: 0.5, fileName: '../gear.step',
  })
  assert.equal(converted.fileName, 'gear.stl')
  assert.equal(converted.blob.type, 'model/stl')
  assert.equal(converted.blob.size, 84 + 2 * 50)
  assert.equal(new DataView(await converted.blob.arrayBuffer()).getUint32(80, true), 2)
})

test('exports OBJ with one-based face indices', async () => {
  const converted = convertTriangleMesh(mesh, { format: 'obj' })
  const text = await converted.blob.text()
  assert.match(text, /^# Exported by CAD File Lab/m)
  assert.match(text, /^f 1 2 3$/m)
  assert.equal(converted.triangleCount, 4)
})

test('exports valid ASCII PLY counts', async () => {
  const converted = convertTriangleMesh(mesh, { format: 'ply', reductionRatio: 0.25 })
  const text = await converted.blob.text()
  assert.match(text, /element vertex 3/)
  assert.match(text, /element face 1/)
  assert.match(text, /end_header\n0 0 0/)
})

test('exports self-contained glTF with typed geometry accessors', async () => {
  const converted = convertTriangleMesh(mesh, { format: 'gltf', fileName: 'part.step' })
  const gltf = JSON.parse(await converted.blob.text())
  assert.equal(converted.fileName, 'part.gltf')
  assert.equal(converted.blob.type, 'model/gltf+json')
  assert.equal(gltf.asset.version, '2.0')
  assert.match(gltf.buffers[0].uri, /^data:application\/octet-stream;base64,/)
  assert.deepEqual(gltf.accessors.map(accessor => accessor.count), [12, 12])
  assert.equal(gltf.meshes[0].primitives[0].mode, 4)
  const binary = Buffer.from(gltf.buffers[0].uri.split(',')[1], 'base64')
  assert.equal(binary.length, gltf.buffers[0].byteLength)
  assert.equal(binary.readFloatLE(4), 0)
  assert.equal(binary.readUInt32LE(gltf.bufferViews[1].byteOffset + 4), 1)
})

test('exports GLB 2.0 with parseable JSON and BIN chunks', async () => {
  const converted = convertTriangleMesh(mesh, { format: 'glb', reductionRatio: 0.5 })
  const buffer = Buffer.from(await converted.blob.arrayBuffer())
  assert.equal(converted.blob.type, 'model/gltf-binary')
  assert.equal(buffer.readUInt32LE(0), 0x46546c67)
  assert.equal(buffer.readUInt32LE(4), 2)
  assert.equal(buffer.readUInt32LE(8), buffer.length)
  const jsonLength = buffer.readUInt32LE(12)
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a)
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString().trim())
  const binaryHeader = 20 + jsonLength
  assert.equal(buffer.readUInt32LE(binaryHeader + 4), 0x004e4942)
  assert.equal(gltf.accessors[1].count, 6)
  assert.equal(buffer.readUInt32LE(binaryHeader + 8 + gltf.bufferViews[1].byteOffset), 0)
})

test('exports a deterministic 3MF OPC package with model geometry', async () => {
  const first = convertTriangleMesh(mesh, { format: '3mf', reductionRatio: 0.25, fileName: 'part.obj' })
  const second = convertTriangleMesh(mesh, { format: '3mf', reductionRatio: 0.25, fileName: 'part.obj' })
  const bytes = Buffer.from(await first.blob.arrayBuffer())
  assert.equal(first.fileName, 'part.3mf')
  assert.equal(first.blob.type, 'model/3mf')
  assert.deepEqual(bytes, Buffer.from(await second.blob.arrayBuffer()))
  const entries = new Map()
  let offset = 0
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18)
    const nameLength = bytes.readUInt16LE(offset + 26)
    const extraLength = bytes.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    entries.set(bytes.subarray(nameStart, nameStart + nameLength).toString(), bytes.subarray(dataStart, dataStart + size).toString())
    offset = dataStart + size
  }
  assert.deepEqual([...entries.keys()], ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model'])
  assert.match(entries.get('_rels/.rels'), /Target="\/3D\/3dmodel\.model"/)
  assert.match(entries.get('3D/3dmodel.model'), /<model[^>]+unit="millimeter"/)
  assert.equal(entries.get('3D/3dmodel.model').match(/<vertex /g).length, 3)
  assert.equal(entries.get('3D/3dmodel.model').match(/<triangle /g).length, 1)
})

test('rejects empty, corrupt, and invalid reduction inputs', () => {
  assert.throws(() => convertTriangleMesh({ vertices: [], triangles: [] }, { format: 'stl' }), /no triangles/i)
  assert.throws(() => reduceTriangleMesh(mesh, 0), /reduction ratio/i)
  assert.throws(() => reduceTriangleMesh({ ...mesh, triangles: [99, 1, 2] }), /invalid triangle index/i)
  assert.throws(() => reduceTriangleMesh({ ...mesh, vertices: [Number.NaN, 0, 0] }), /non-finite/i)
  assert.throws(() => convertTriangleMesh(mesh, { format: 'step' }), /not supported/i)
})
