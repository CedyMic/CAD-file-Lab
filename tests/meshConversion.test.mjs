import assert from 'node:assert/strict'
import test from 'node:test'
import { convertTriangleMesh, reduceTriangleMesh } from '../src/cad/meshConversion.ts'
const mesh = { vertices: [0,0,0,1,0,0,0,1,0,2,0,0,3,0,0,2,1,0,4,0,0,5,0,0,4,1,0,6,0,0,7,0,0,6,1,0], triangles: [0,1,2,3,4,5,6,7,8,9,10,11] }
test('reduces triangles evenly and removes unused vertices', () => { const reduced = reduceTriangleMesh(mesh, .5); assert.equal(reduced.triangles.length / 3, 2); assert.equal(reduced.vertices.length / 3, 6); assert.deepEqual(reduced.vertices.slice(9), [4,0,0,5,0,0,4,1,0]) })
test('exports a compact binary STL', async () => { const converted = convertTriangleMesh(mesh, { format: 'stl', reductionRatio: .5, fileName: '../gear.step' }); assert.equal(converted.fileName, 'gear.stl'); assert.equal(converted.blob.size, 184); assert.equal(new DataView(await converted.blob.arrayBuffer()).getUint32(80, true), 2) })
test('exports OBJ and PLY', async () => { assert.match(await convertTriangleMesh(mesh, { format: 'obj' }).blob.text(), /^f 1 2 3$/m); assert.match(await convertTriangleMesh(mesh, { format: 'ply', reductionRatio: .25 }).blob.text(), /element face 1/) })
test('rejects invalid inputs', () => { assert.throws(() => convertTriangleMesh({ vertices: [], triangles: [] }, { format: 'stl' }), /no triangles/i); assert.throws(() => reduceTriangleMesh(mesh, 0), /reduction ratio/i) })
