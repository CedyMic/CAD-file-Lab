import opencascade from './vendor/replicad_single.js';
import {
  setOC,
  importSTEP,
  deserializeShape,
  makeBox,
  makeCylinder,
  makeSphere,
  sketchRectangle,
  sketchCircle,
  exportSTEP,
  measureArea,
  measureVolume,
  measureLength,
} from './vendor/replicad.js';

let initPromise = null;
let bodies = [];
let undoStack = [];
let redoStack = [];
let idCounter = 1;

function initKernel() {
  if (!initPromise) {
    initPromise = opencascade({
      locateFile: (file) => new URL(`./vendor/${file}`, import.meta.url).href,
    }).then((oc) => {
      setOC(oc);
      return true;
    });
  }
  return initPromise;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nextId(prefix = 'body') {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function bodyById(id) {
  const body = bodies.find((entry) => entry.id === id);
  if (!body) throw new Error('The selected body no longer exists.');
  return body;
}

function snapshot() {
  return bodies.map((body) => ({
    id: body.id,
    name: body.name,
    color: body.color,
    serialized: body.shape.serialize(),
  }));
}

function restore(serializedBodies) {
  bodies = serializedBodies.map((body) => ({
    id: body.id,
    name: body.name,
    color: body.color,
    shape: deserializeShape(body.serialized),
  }));
}

function commit() {
  undoStack.push(snapshot());
  if (undoStack.length > 15) undoStack.shift();
  redoStack = [];
}

function randomColor(index = bodies.length) {
  const palette = ['#78a8c8', '#8fb895', '#cf9f7f', '#a996c9', '#d0b568', '#7fb9b5', '#c58ea1'];
  return palette[index % palette.length];
}

function shapeStats(shape) {
  const box = shape.boundingBox;
  const [min, max] = box.bounds;
  let area = 0;
  let volume = 0;
  let edgeLength = 0;
  try { area = measureArea(shape); } catch {}
  try { volume = Math.abs(measureVolume(shape)); } catch {}
  try { edgeLength = measureLength(shape); } catch {}
  return {
    min,
    max,
    size: [box.width, box.height, box.depth],
    center: box.center,
    area,
    volume,
    edgeLength,
  };
}

function meshBody(body, tolerance = 0.12) {
  const mesh = body.shape.mesh({ tolerance, angularTolerance: 0.35 });
  const edges = body.shape.meshEdges({ tolerance, angularTolerance: 0.35 });
  return {
    id: body.id,
    name: body.name,
    color: body.color,
    stats: shapeStats(body.shape),
    mesh: {
      vertices: new Float32Array(mesh.vertices),
      normals: new Float32Array(mesh.normals),
      triangles: new Uint32Array(mesh.triangles),
      faceGroups: mesh.faceGroups || [],
    },
    edges: {
      lines: new Float32Array(edges.lines),
      edgeGroups: edges.edgeGroups || [],
    },
  };
}

function getSceneData() {
  const resultBodies = bodies.map((body) => meshBody(body));
  return {
    bodies: resultBodies,
    editable: true,
    history: { canUndo: undoStack.length > 1, canRedo: redoStack.length > 0 },
  };
}

function getTransferables(sceneData) {
  const transferables = [];
  for (const body of sceneData.bodies) {
    transferables.push(
      body.mesh.vertices.buffer,
      body.mesh.normals.buffer,
      body.mesh.triangles.buffer,
      body.edges.lines.buffer,
    );
  }
  return transferables;
}

async function importStep(payload) {
  await initKernel();
  const blob = new Blob([payload.buffer], { type: 'model/step' });
  const shape = await importSTEP(blob);
  const editableShape = shape.asShape3D();
  bodies = [{
    id: nextId('import'),
    name: payload.name || 'Imported STEP model',
    color: '#7fa9c5',
    shape: editableShape,
  }];
  undoStack = [snapshot()];
  redoStack = [];
  return getSceneData();
}

function addPrimitive(payload) {
  commit();
  const type = payload.type;
  const x = safeNumber(payload.x);
  const y = safeNumber(payload.y);
  const z = safeNumber(payload.z);
  let shape;
  let name;
  if (type === 'box') {
    const length = Math.max(0.001, safeNumber(payload.length, 50));
    const width = Math.max(0.001, safeNumber(payload.width, 40));
    const height = Math.max(0.001, safeNumber(payload.height, 30));
    shape = makeBox([x, y, z], [x + length, y + width, z + height]);
    name = payload.name || `Box ${bodies.length + 1}`;
  } else if (type === 'cylinder') {
    const radius = Math.max(0.001, safeNumber(payload.radius, 15));
    const height = Math.max(0.001, safeNumber(payload.height, 40));
    const direction = axisVector(payload.axis || 'z');
    shape = makeCylinder(radius, height, [x, y, z], direction);
    name = payload.name || `Cylinder ${bodies.length + 1}`;
  } else if (type === 'sphere') {
    const radius = Math.max(0.001, safeNumber(payload.radius, 20));
    shape = makeSphere(radius).translate(x, y, z);
    name = payload.name || `Sphere ${bodies.length + 1}`;
  } else {
    throw new Error('Unsupported primitive type.');
  }
  const body = { id: nextId(type), name, color: randomColor(), shape };
  bodies.push(body);
  undoStack[undoStack.length - 1] = snapshot();
  return getSceneData();
}

function axisVector(axis) {
  if (axis === 'x') return [1, 0, 0];
  if (axis === 'y') return [0, 1, 0];
  return [0, 0, 1];
}

function transformBody(payload) {
  const body = bodyById(payload.bodyId);
  commit();
  if (payload.mode === 'translate') {
    body.shape = body.shape.translate(
      safeNumber(payload.x),
      safeNumber(payload.y),
      safeNumber(payload.z),
    );
  } else if (payload.mode === 'rotate') {
    const boxCenter = body.shape.boundingBox.center;
    body.shape = body.shape.rotate(
      safeNumber(payload.angle),
      payload.useOrigin ? [0, 0, 0] : boxCenter,
      axisVector(payload.axis || 'z'),
    );
  } else if (payload.mode === 'scale') {
    const factor = safeNumber(payload.factor, 1);
    if (factor <= 0) throw new Error('Scale factor must be greater than zero.');
    body.shape = body.shape.scale(factor, body.shape.boundingBox.center);
  } else {
    throw new Error('Unsupported transform operation.');
  }
  undoStack[undoStack.length - 1] = snapshot();
  return getSceneData();
}

function duplicateBody(payload) {
  const source = bodyById(payload.bodyId);
  commit();
  const shape = deserializeShape(source.shape.serialize()).translate(
    safeNumber(payload.x, 10),
    safeNumber(payload.y, 10),
    safeNumber(payload.z, 10),
  );
  bodies.push({
    id: nextId('copy'),
    name: `${source.name} copy`,
    color: randomColor(),
    shape,
  });
  undoStack[undoStack.length - 1] = snapshot();
  return getSceneData();
}

function deleteBody(payload) {
  bodyById(payload.bodyId);
  if (bodies.length <= 1) throw new Error('A project must contain at least one body.');
  commit();
  bodies = bodies.filter((body) => body.id !== payload.bodyId);
  undoStack[undoStack.length - 1] = snapshot();
  return getSceneData();
}


function extrudeSketch(payload) {
  const axis = payload.axis || 'z';
  const plane = axis === 'x' ? 'YZ' : axis === 'y' ? 'XZ' : 'XY';
  const origin = [safeNumber(payload.x), safeNumber(payload.y), safeNumber(payload.z)];
  const distance = safeNumber(payload.distance, 20);
  if (Math.abs(distance) < 0.001) throw new Error('Extrusion distance must not be zero.');
  let sketch;
  if (payload.profile === 'circle') {
    sketch = sketchCircle(Math.max(0.001, safeNumber(payload.radius, 10)), { plane, origin });
  } else {
    sketch = sketchRectangle(
      Math.max(0.001, safeNumber(payload.width, 30)),
      Math.max(0.001, safeNumber(payload.height, 20)),
      { plane, origin },
    );
  }
  const extrusion = sketch.extrude(Math.abs(distance), {
    extrusionDirection: distance < 0 ? axisVector(axis).map((value) => -value) : axisVector(axis),
  }).asShape3D();
  const mode = payload.mode || 'new';
  commit();
  if (mode === 'new') {
    bodies.push({
      id: nextId('extrude'),
      name: payload.name || `Extrusion ${bodies.length + 1}`,
      color: randomColor(),
      shape: extrusion,
    });
  } else {
    const target = bodyById(payload.bodyId);
    if (mode === 'cut') target.shape = target.shape.cut(extrusion).asShape3D();
    else if (mode === 'union') target.shape = target.shape.fuse(extrusion).asShape3D();
    else throw new Error('Unsupported extrusion mode.');
  }
  undoStack[undoStack.length - 1] = snapshot();
  return getSceneData();
}

function booleanOperation(payload) {
  if (payload.targetId === payload.toolId) throw new Error('Choose two different bodies.');
  const target = bodyById(payload.targetId);
  const tool = bodyById(payload.toolId);
  commit();
  let result;
  if (payload.operation === 'union') result = target.shape.fuse(tool.shape);
  else if (payload.operation === 'subtract') result = target.shape.cut(tool.shape);
  else if (payload.operation === 'intersect') result = target.shape.intersect(tool.shape);
  else throw new Error('Unsupported Boolean operation.');
  target.shape = result.asShape3D();
  target.name = `${target.name} ${payload.operation}`;
  bodies = bodies.filter((body) => body.id !== tool.id);
  undoStack[undoStack.length - 1] = snapshot();
  return getSceneData();
}

function addHole(payload) {
  const body = bodyById(payload.bodyId);
  const radius = Math.max(0.001, safeNumber(payload.radius, 5));
  const depth = Math.max(0.001, safeNumber(payload.depth, 50));
  const location = [safeNumber(payload.x), safeNumber(payload.y), safeNumber(payload.z)];
  const direction = axisVector(payload.axis || 'z');
  commit();
  const tool = makeCylinder(radius, depth, location, direction);
  body.shape = body.shape.cut(tool).asShape3D();
  undoStack[undoStack.length - 1] = snapshot();
  return getSceneData();
}

function edgeFeature(payload) {
  const body = bodyById(payload.bodyId);
  const radius = Math.max(0.001, safeNumber(payload.radius, 1));
  commit();
  if (payload.operation === 'fillet') body.shape = body.shape.fillet(radius).asShape3D();
  else if (payload.operation === 'chamfer') body.shape = body.shape.chamfer(radius).asShape3D();
  else throw new Error('Unsupported edge operation.');
  undoStack[undoStack.length - 1] = snapshot();
  return getSceneData();
}

function undo() {
  if (undoStack.length <= 1) return getSceneData();
  redoStack.push(snapshot());
  undoStack.pop();
  restore(undoStack[undoStack.length - 1]);
  return getSceneData();
}

function redo() {
  if (!redoStack.length) return getSceneData();
  const next = redoStack.pop();
  undoStack.push(next);
  restore(next);
  return getSceneData();
}

async function exportProject() {
  await initKernel();
  if (!bodies.length) throw new Error('There is no CAD model to export.');
  const blob = exportSTEP(
    bodies.map((body) => ({ shape: body.shape, name: body.name, color: body.color })),
    { unit: 'MM', modelUnit: 'MM' },
  );
  const buffer = await blob.arrayBuffer();
  return { buffer, mimeType: 'model/step' };
}

async function dispatch(action, payload = {}) {
  await initKernel();
  const mutationActions = new Set([
    'addPrimitive', 'transformBody', 'duplicateBody', 'deleteBody',
    'booleanOperation', 'extrudeSketch', 'addHole', 'edgeFeature',
  ]);
  const transactional = mutationActions.has(action);
  const beforeBodies = transactional ? snapshot() : null;
  const beforeUndo = transactional ? [...undoStack] : null;
  const beforeRedo = transactional ? [...redoStack] : null;
  try {
    switch (action) {
      case 'ping': return { ready: true };
      case 'importStep': return importStep(payload);
      case 'addPrimitive': return addPrimitive(payload);
      case 'transformBody': return transformBody(payload);
      case 'duplicateBody': return duplicateBody(payload);
      case 'deleteBody': return deleteBody(payload);
      case 'booleanOperation': return booleanOperation(payload);
      case 'extrudeSketch': return extrudeSketch(payload);
      case 'addHole': return addHole(payload);
      case 'edgeFeature': return edgeFeature(payload);
      case 'undo': return undo();
      case 'redo': return redo();
      case 'getScene': return getSceneData();
      case 'exportProject': return exportProject();
      default: throw new Error(`Unknown CAD action: ${action}`);
    }
  } catch (error) {
    if (transactional && beforeBodies) {
      restore(beforeBodies);
      undoStack = beforeUndo;
      redoStack = beforeRedo;
    }
    throw error;
  }
}

self.addEventListener('message', async (event) => {
  const { id, action, payload } = event.data || {};
  try {
    const result = await dispatch(action, payload);
    if (action === 'exportProject') {
      self.postMessage({ id, ok: true, result }, [result.buffer]);
      return;
    }
    const transferables = result?.bodies ? getTransferables(result) : [];
    self.postMessage({ id, ok: true, result }, transferables);
  } catch (error) {
    console.error(error);
    self.postMessage({
      id,
      ok: false,
      error: error?.message || String(error),
    });
  }
});
