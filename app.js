import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { STLLoader } from './vendor/loaders/STLLoader.js';
import { OBJLoader } from './vendor/loaders/OBJLoader.js';
import { MTLLoader } from './vendor/loaders/MTLLoader.js';
import { PLYLoader } from './vendor/loaders/PLYLoader.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { DRACOLoader } from './vendor/loaders/DRACOLoader.js';
import { FBXLoader } from './vendor/loaders/FBXLoader.js';
import { ColladaLoader } from './vendor/loaders/ColladaLoader.js';
import { ThreeMFLoader } from './vendor/loaders/3MFLoader.js';
import { TDSLoader } from './vendor/loaders/TDSLoader.js';
import { VRMLLoader } from './vendor/loaders/VRMLLoader.js';
import { MeshoptDecoder } from './vendor/libs/meshopt_decoder.module.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const FORMAT_DEFINITIONS = {
  step: { label: 'STEP', kind: 'cad', parser: 'step', units: 'mm', up: 'z' },
  stp: { label: 'STEP', kind: 'cad', parser: 'step', units: 'mm', up: 'z' },
  iges: { label: 'IGES', kind: 'cad', parser: 'iges', units: 'mm', up: 'z' },
  igs: { label: 'IGES', kind: 'cad', parser: 'iges', units: 'mm', up: 'z' },
  brep: { label: 'BREP', kind: 'cad', parser: 'brep', units: 'model units', up: 'z' },
  stl: { label: 'STL', kind: 'mesh', units: 'model units', up: 'z' },
  obj: { label: 'OBJ', kind: 'mesh', units: 'model units', up: 'z' },
  ply: { label: 'PLY', kind: 'mesh', units: 'model units', up: 'z' },
  glb: { label: 'GLB', kind: 'scene', units: 'model units', up: 'y' },
  gltf: { label: 'glTF', kind: 'scene', units: 'model units', up: 'y' },
  fbx: { label: 'FBX', kind: 'scene', units: 'model units', up: 'y' },
  '3mf': { label: '3MF', kind: 'mesh', units: 'mm', up: 'z' },
  dae: { label: 'DAE', kind: 'scene', units: 'model units', up: 'y' },
  '3ds': { label: '3DS', kind: 'scene', units: 'model units', up: 'y' },
  wrl: { label: 'VRML', kind: 'scene', units: 'model units', up: 'y' },
  vrml: { label: 'VRML', kind: 'scene', units: 'model units', up: 'y' },
};

const SUPPORTED_EXTENSIONS = Object.keys(FORMAT_DEFINITIONS);
const COMPANION_EXTENSIONS = ['bin', 'mtl', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tga'];
const SUPPORTED_ACCEPT = [...SUPPORTED_EXTENSIONS, ...COMPANION_EXTENSIONS].map((extension) => `.${extension}`).join(',');
const SUPPORTED_LABELS = [...new Set(Object.values(FORMAT_DEFINITIONS).map((format) => format.label))].join(', ');

const elements = {
  viewport: $('#viewport'),
  canvas: $('#viewer-canvas'),
  fileInput: $('#file-input'),
  openButton: $('#open-button'),
  welcomeOpenButton: $('#welcome-open-button'),
  demoButton: $('#demo-button'),
  welcomeDemoButton: $('#welcome-demo-button'),
  clearButton: $('#clear-button'),
  fitButton: $('#fit-button'),
  screenshotButton: $('#screenshot-button'),
  fullscreenButton: $('#fullscreen-button'),
  welcomeOverlay: $('#welcome-overlay'),
  loadingOverlay: $('#loading-overlay'),
  loadingTitle: $('#loading-title'),
  loadingDetail: $('#loading-detail'),
  progressBar: $('#progress-bar'),
  dropZone: $('#drop-zone'),
  statusPill: $('#status-pill'),
  emptyModelCard: $('#empty-model-card'),
  fileCard: $('#file-card'),
  fileIcon: $('#file-icon'),
  fileName: $('#file-name'),
  fileSize: $('#file-size'),
  treeSection: $('#tree-section'),
  modelTree: $('#model-tree'),
  treeCount: $('#tree-count'),
  treeSearchInput: $('#tree-search-input'),
  edgesToggle: $('#edges-toggle'),
  wireframeToggle: $('#wireframe-toggle'),
  gridToggle: $('#grid-toggle'),
  backgroundInput: $('#background-input'),
  meshStat: $('#mesh-stat'),
  triangleStat: $('#triangle-stat'),
  vertexStat: $('#vertex-stat'),
  timeStat: $('#time-stat'),
  dimensionUnit: $('#dimension-unit'),
  dimensionX: $('#dimension-x'),
  dimensionY: $('#dimension-y'),
  dimensionZ: $('#dimension-z'),
  selectionEmpty: $('#selection-empty'),
  selectionDetails: $('#selection-details'),
  selectionName: $('#selection-name'),
  selectionType: $('#selection-type'),
  isolateButton: $('#isolate-button'),
  showAllButton: $('#show-all-button'),
  undoButton: $('#undo-button'),
  redoButton: $('#redo-button'),
  loadLocalButton: $('#load-local-button'),
  saveLocalButton: $('#save-local-button'),
  saveStepButton: $('#save-step-button'),
  measureMode: $('#measure-mode'),
  measureStartButton: $('#measure-start-button'),
  measureClearButton: $('#measure-clear-button'),
  measureResult: $('#measure-result'),
  measureDeltas: $('#measure-deltas'),
  measureHint: $('#measure-hint'),
  bodyArea: $('#body-area'),
  bodyVolume: $('#body-volume'),
  bodyEdgeLength: $('#body-edge-length'),
  sectionToggle: $('#section-toggle'),
  sectionOffset: $('#section-offset'),
  sectionOffsetValue: $('#section-offset-value'),
  sectionFlip: $('#section-flip'),
  sectionHelperToggle: $('#section-helper-toggle'),
  editStatus: $('#edit-status'),
  editDisabledNote: $('#edit-disabled-note'),
  editTools: $('#edit-tools'),
  moveX: $('#move-x'), moveY: $('#move-y'), moveZ: $('#move-z'),
  translateButton: $('#translate-button'),
  rotateAxis: $('#rotate-axis'), rotateAngle: $('#rotate-angle'), rotateButton: $('#rotate-button'),
  scaleFactor: $('#scale-factor'), scaleButton: $('#scale-button'),
  duplicateButton: $('#duplicate-button'), deleteBodyButton: $('#delete-body-button'),
  primitiveType: $('#primitive-type'), primitiveX: $('#primitive-x'), primitiveY: $('#primitive-y'), primitiveZ: $('#primitive-z'),
  boxFields: $('#box-fields'), roundFields: $('#round-fields'), primitiveAxisLabel: $('#primitive-axis-label'), primitiveHeightLabel: $('#primitive-height-label'),
  boxLength: $('#box-length'), boxWidth: $('#box-width'), boxHeight: $('#box-height'),
  primitiveRadius: $('#primitive-radius'), primitiveHeight: $('#primitive-height'), primitiveAxis: $('#primitive-axis'), addPrimitiveButton: $('#add-primitive-button'),
  extrudeProfile: $('#extrude-profile'), extrudeX: $('#extrude-x'), extrudeY: $('#extrude-y'), extrudeZ: $('#extrude-z'),
  extrudeRectangleFields: $('#extrude-rectangle-fields'), extrudeCircleFields: $('#extrude-circle-fields'),
  extrudeWidth: $('#extrude-width'), extrudeHeight: $('#extrude-height'), extrudeRadius: $('#extrude-radius'),
  extrudeAxis: $('#extrude-axis'), extrudeDistance: $('#extrude-distance'), extrudeMode: $('#extrude-mode'), extrudeButton: $('#extrude-button'),
  booleanTarget: $('#boolean-target'), booleanTool: $('#boolean-tool'), booleanOperation: $('#boolean-operation'), booleanButton: $('#boolean-button'),
  holeX: $('#hole-x'), holeY: $('#hole-y'), holeZ: $('#hole-z'), holeRadius: $('#hole-radius'), holeDepth: $('#hole-depth'), holeAxis: $('#hole-axis'), holeButton: $('#hole-button'),
  edgeRadius: $('#edge-radius'), filletButton: $('#fillet-button'), chamferButton: $('#chamfer-button'),
  toast: $('#toast'),
};

let renderer;
let scene;
let camera;
let controls;
let modelRoot;
let gridHelper;
let axesHelper;
let activeWorker = null;
let activeFileName = '';
let activeFormat = null;
let activeObjectUrls = [];
let modelBox = new THREE.Box3();
let modelCenter = new THREE.Vector3();
let modelRadius = 1;
let meshEntries = [];
let selectedMesh = null;
let selectedMaterialState = [];
let dragDepth = 0;
let pointerDown = null;
let toastTimer = null;
let worldUpAxis = 'z';
let cadWorker = null;
let cadRequestId = 0;
let cadPending = new Map();
let cadEditable = false;
let cadHistory = { canUndo: false, canRedo: false };
let cadBodies = [];
let measurementActive = false;
let measurementPoints = [];
let measurementGroup = null;
let sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
let sectionPlaneHelper = null;
let sectionAxis = 'x';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

initializeViewer();
bindEvents();
updatePrimitiveFields();
updateExtrudeFields();
updateCadInterface();
setStatus('Ready');
window.STEPscopeReady = true;
document.documentElement.dataset.stepscopeReady = 'true';
window.dispatchEvent(new Event('stepscope-ready'));

function initializeViewer() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: elements.canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    showToast('WebGL could not be initialized in this browser.', true);
    throw error;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(elements.backgroundInput.value, 1);
  renderer.localClippingEnabled = true;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000000);
  camera.up.set(0, 0, 1);
  camera.position.set(140, -140, 105);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xd9ecff, 0x202633, 2.15));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
  keyLight.position.set(2.5, -3, 4.5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8abfff, 1.05);
  fillLight.position.set(-4, 2, 1.5);
  scene.add(fillLight);

  modelRoot = new THREE.Group();
  modelRoot.name = 'Loaded model';
  scene.add(modelRoot);

  createGrid(200, 20, 0);
  axesHelper = new THREE.AxesHelper(28);
  axesHelper.renderOrder = 5;
  scene.add(axesHelper);

  measurementGroup = new THREE.Group();
  measurementGroup.name = 'Measurements';
  scene.add(measurementGroup);
  sectionPlaneHelper = new THREE.PlaneHelper(sectionPlane, 100, 0x48a8ff);
  sectionPlaneHelper.visible = false;
  sectionPlaneHelper.material.transparent = true;
  sectionPlaneHelper.material.opacity = 0.35;
  scene.add(sectionPlaneHelper);

  elements.fileInput.accept = SUPPORTED_ACCEPT;
  resizeViewer();
  renderer.setAnimationLoop(renderFrame);
}

function bindEvents() {
  const openFileDialog = () => elements.fileInput.click();
  elements.openButton.addEventListener('click', openFileDialog);
  elements.welcomeOpenButton.addEventListener('click', openFileDialog);
  elements.fileInput.addEventListener('change', (event) => {
    const files = [...event.target.files];
    if (files.length) loadModelFiles(files);
    event.target.value = '';
  });

  elements.demoButton.addEventListener('click', loadDemo);
  elements.welcomeDemoButton.addEventListener('click', loadDemo);
  elements.clearButton.addEventListener('click', clearModel);
  elements.fitButton.addEventListener('click', () => fitModel('iso'));
  elements.screenshotButton.addEventListener('click', saveScreenshot);
  elements.fullscreenButton.addEventListener('click', toggleFullscreen);

  $$('.view-button').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  elements.edgesToggle.addEventListener('change', applyDisplaySettings);
  elements.wireframeToggle.addEventListener('change', applyDisplaySettings);
  elements.gridToggle.addEventListener('change', applyDisplaySettings);
  elements.backgroundInput.addEventListener('input', () => renderer.setClearColor(elements.backgroundInput.value, 1));
  elements.treeSearchInput.addEventListener('input', filterTree);
  elements.isolateButton.addEventListener('click', isolateSelected);
  elements.showAllButton.addEventListener('click', showAllMeshes);

  elements.undoButton.addEventListener('click', () => runCadMutation('undo', {}, 'Undoing…'));
  elements.redoButton.addEventListener('click', () => runCadMutation('redo', {}, 'Redoing…'));
  elements.saveStepButton.addEventListener('click', exportModifiedStep);
  elements.saveLocalButton.addEventListener('click', saveProjectLocally);
  elements.loadLocalButton.addEventListener('click', loadLocalProject);

  elements.measureStartButton.addEventListener('click', toggleMeasurement);
  elements.measureClearButton.addEventListener('click', clearMeasurement);
  elements.measureMode.addEventListener('change', clearMeasurement);

  elements.sectionToggle.addEventListener('change', updateSectionView);
  elements.sectionOffset.addEventListener('input', updateSectionView);
  elements.sectionFlip.addEventListener('change', updateSectionView);
  elements.sectionHelperToggle.addEventListener('change', updateSectionView);
  $$('.section-axis').forEach((button) => button.addEventListener('click', () => {
    sectionAxis = button.dataset.axis;
    $$('.section-axis').forEach((item) => item.classList.toggle('is-active', item === button));
    updateSectionView();
  }));

  elements.translateButton.addEventListener('click', () => mutateSelected('transformBody', {
    mode: 'translate', x: elements.moveX.value, y: elements.moveY.value, z: elements.moveZ.value,
  }, 'Translating body…'));
  elements.rotateButton.addEventListener('click', () => mutateSelected('transformBody', {
    mode: 'rotate', axis: elements.rotateAxis.value, angle: elements.rotateAngle.value,
  }, 'Rotating body…'));
  elements.scaleButton.addEventListener('click', () => mutateSelected('transformBody', {
    mode: 'scale', factor: elements.scaleFactor.value,
  }, 'Scaling body…'));
  elements.duplicateButton.addEventListener('click', () => mutateSelected('duplicateBody', { x: 10, y: 10, z: 10 }, 'Duplicating body…'));
  elements.deleteBodyButton.addEventListener('click', () => mutateSelected('deleteBody', {}, 'Deleting body…'));
  elements.primitiveType.addEventListener('change', updatePrimitiveFields);
  elements.addPrimitiveButton.addEventListener('click', addPrimitive);
  elements.extrudeProfile.addEventListener('change', updateExtrudeFields);
  elements.extrudeMode.addEventListener('change', updateCadInterface);
  elements.extrudeButton.addEventListener('click', applySketchExtrusion);
  elements.booleanButton.addEventListener('click', applyBooleanOperation);
  elements.holeButton.addEventListener('click', () => mutateSelected('addHole', {
    x: elements.holeX.value, y: elements.holeY.value, z: elements.holeZ.value,
    radius: elements.holeRadius.value, depth: elements.holeDepth.value, axis: elements.holeAxis.value,
  }, 'Cutting hole…'));
  elements.filletButton.addEventListener('click', () => mutateSelected('edgeFeature', { operation: 'fillet', radius: elements.edgeRadius.value }, 'Applying fillet…'));
  elements.chamferButton.addEventListener('click', () => mutateSelected('edgeFeature', { operation: 'chamfer', radius: elements.edgeRadius.value }, 'Applying chamfer…'));

  window.addEventListener('resize', resizeViewer);
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('pointerup', onViewportClick);

  window.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    elements.dropZone.hidden = false;
  });
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('dragleave', (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) elements.dropZone.hidden = true;
  });
  window.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    elements.dropZone.hidden = true;
    const files = [...event.dataTransfer.files];
    if (!files.some(isSupportedModelFile)) {
      showToast(`Unsupported file type. Supported formats: ${SUPPORTED_LABELS}.`, true);
      return;
    }
    loadModelFiles(files);
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) runCadMutation('redo', {}, 'Redoing…');
      else runCadMutation('undo', {}, 'Undoing…');
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      runCadMutation('redo', {}, 'Redoing…');
      return;
    }
    if (key === 'escape' && measurementActive) {
      clearMeasurement();
      return;
    }
    if (event.target.matches('input, select, textarea')) return;
    if (key === 'f' && meshEntries.length) fitModel('iso');
    if (key === '1' && meshEntries.length) setView('iso');
    if (key === '2' && meshEntries.length) setView('front');
    if (key === '3' && meshEntries.length) setView('top');
    if (key === '4' && meshEntries.length) setView('right');
    if (key === 'w' && meshEntries.length) {
      elements.wireframeToggle.checked = !elements.wireframeToggle.checked;
      applyDisplaySettings();
    }
  });
}

async function loadDemo() {
  try {
    setLoading(true, 'Loading demo model', 'Downloading the bundled STEP sample…', 12);
    const response = await fetch('./samples/cube.step');
    if (!response.ok) throw new Error(`Demo request failed (${response.status})`);
    const blob = await response.blob();
    const file = new File([blob], 'demo-cube.step', { type: 'model/step' });
    await loadModelFiles([file]);
  } catch (error) {
    handleLoadError(error);
  }
}

async function loadModelFiles(inputFiles) {
  const files = inputFiles.filter(Boolean);
  const primaryFile = choosePrimaryModelFile(files);
  if (!primaryFile) {
    showToast(`Unsupported file type. Supported formats: ${SUPPORTED_LABELS}.`, true);
    return;
  }

  const extension = getExtension(primaryFile.name);
  const format = FORMAT_DEFINITIONS[extension];
  if (!format) return;

  if (activeWorker) activeWorker.terminate();
  const startedAt = performance.now();
  activeFileName = primaryFile.name;
  activeFormat = format;
  worldUpAxis = format.up;
  deselectMesh();

  try {
    setLoading(true, `Reading ${format.label} model`, 'Loading the selected file into memory…', 8);
    setStatus('Processing locally', 'busy');

    let importedObject;
    if (extension === 'step' || extension === 'stp') {
      const buffer = await primaryFile.arrayBuffer();
      updateLoading('Starting the exact CAD kernel…', 18);
      const cadScene = await cadCall('importStep', { buffer, name: primaryFile.name }, [buffer]);
      cadEditable = true;
      cadBodies = cadScene.bodies || [];
      cadHistory = cadScene.history || { canUndo: false, canRedo: false };
      updateLoading('Tessellating editable STEP geometry…', 58);
      importedObject = buildEditableCadObject(cadScene);
    } else if (format.kind === 'cad') {
      cadEditable = false;
      cadBodies = [];
      cadHistory = { canUndo: false, canRedo: false };
      const buffer = await primaryFile.arrayBuffer();
      updateLoading('Initializing the CAD viewer engine…', 22);
      const result = await parseCadInWorker(buffer, format.parser);
      if (!result?.success) throw new Error(`The CAD engine could not import this ${format.label} file.`);
      updateLoading('Building renderable geometry…', 55);
      importedObject = await buildCadObject(result, (ratio) => {
        const progress = 55 + Math.round(ratio * 32);
        updateLoading(`Creating CAD geometry…`, progress);
      });
    } else {
      cadEditable = false;
      cadBodies = [];
      cadHistory = { canUndo: false, canRedo: false };
      updateLoading(`Parsing ${format.label} data…`, 28);
      importedObject = await parseThreeFormat(primaryFile, files, extension);
      updateLoading('Preparing the 3D scene…', 68);
    }

    clearMeasurement();
    await installModel(importedObject, format);
    updateLoading('Finalizing model information…', 94);
    const elapsedMs = performance.now() - startedAt;
    updateModelInterface(primaryFile, files, format, elapsedMs);
    updateCadInterface();
    updateSectionView();
    setLoading(false);
    setStatus('Model ready');
    showToast(`${primaryFile.name} loaded successfully.`);
  } catch (error) {
    handleLoadError(error);
  } finally {
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
  }
}

function ensureCadWorker() {
  if (cadWorker) return cadWorker;
  cadWorker = new Worker('./cad-worker.js', { type: 'module' });
  cadWorker.addEventListener('message', (event) => {
    const { id, ok, result, error } = event.data || {};
    const pending = cadPending.get(id);
    if (!pending) return;
    cadPending.delete(id);
    if (ok) pending.resolve(result);
    else pending.reject(new Error(error || 'The CAD operation failed.'));
  });
  cadWorker.addEventListener('error', (event) => {
    const error = new Error(event.message || 'The CAD worker stopped unexpectedly.');
    cadPending.forEach(({ reject }) => reject(error));
    cadPending.clear();
    cadWorker?.terminate();
    cadWorker = null;
  });
  return cadWorker;
}

function cadCall(action, payload = {}, transfer = []) {
  const worker = ensureCadWorker();
  cadRequestId += 1;
  const id = cadRequestId;
  return new Promise((resolve, reject) => {
    cadPending.set(id, { resolve, reject });
    worker.postMessage({ id, action, payload }, transfer);
  });
}

function parseCadInWorker(arrayBuffer, format) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./vendor/occt-import-js-worker.js');
    activeWorker = worker;
    worker.addEventListener('message', (event) => resolve(event.data), { once: true });
    worker.addEventListener('error', (event) => reject(new Error(event.message || 'CAD parsing worker failed.')), { once: true });

    const bytes = new Uint8Array(arrayBuffer);
    worker.postMessage({
      format,
      buffer: bytes,
      params: {
        linearUnit: 'millimeter',
        linearDeflectionType: 'bounding_box_ratio',
        linearDeflection: 0.001,
        angularDeflection: 0.45,
      },
    }, [bytes.buffer]);
  });
}

async function buildCadObject(result, onProgress) {
  const importedMeshes = [];
  const total = Math.max(1, result.meshes.length);

  for (let index = 0; index < result.meshes.length; index += 1) {
    const source = result.meshes[index];
    importedMeshes[index] = source?.attributes?.position?.array && source?.index?.array
      ? buildCadMesh(source, index)
      : null;
    if (index % 12 === 0) {
      onProgress(index / total);
      await nextFrame();
    }
  }
  onProgress(1);

  const addedMeshes = new Set();
  function buildNode(node, isRoot = false) {
    const group = new THREE.Group();
    group.name = node?.name || (isRoot ? activeFileName : 'CAD assembly');
    for (const index of node?.meshes || []) {
      const mesh = importedMeshes[index];
      if (mesh && !addedMeshes.has(index)) {
        group.add(mesh);
        addedMeshes.add(index);
      }
    }
    for (const child of node?.children || []) group.add(buildNode(child));
    return group;
  }

  const root = result.root ? buildNode(result.root, true) : new THREE.Group();
  root.name ||= activeFileName;
  importedMeshes.forEach((mesh, index) => {
    if (mesh && !addedMeshes.has(index)) root.add(mesh);
  });
  return root;
}

function buildEditableCadObject(sceneData) {
  const root = new THREE.Group();
  root.name = activeFileName || 'Editable STEP project';
  for (const body of sceneData.bodies || []) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(body.mesh.vertices, 3));
    if (body.mesh.normals?.length === body.mesh.vertices?.length) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(body.mesh.normals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    geometry.setIndex(new THREE.BufferAttribute(body.mesh.triangles, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = createCadMaterial(new THREE.Color(body.color || 0x7fa9c5));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = body.name || 'CAD body';
    mesh.userData.bodyId = body.id;
    mesh.userData.bodyStats = body.stats || null;
    mesh.userData.isCadMesh = true;
    mesh.userData.exactEdgePositions = body.edges?.lines || null;
    root.add(mesh);
  }
  return root;
}

function buildCadMesh(importedMesh, meshIndex) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(importedMesh.attributes.position.array, 3));
  if (importedMesh.attributes.normal?.array) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(importedMesh.attributes.normal.array, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(importedMesh.index.array), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = importedMesh.name || `Component ${meshIndex + 1}`;

  const defaultColor = importedMesh.color ? new THREE.Color(...importedMesh.color) : new THREE.Color(0x86a6c0);
  const materials = [createCadMaterial(defaultColor)];
  const materialMap = new Map([[defaultColor.getHexString(), 0]]);
  const triangleCount = importedMesh.index.array.length / 3;

  if (Array.isArray(importedMesh.brep_faces) && importedMesh.brep_faces.length > 0) {
    let triangleIndex = 0;
    let faceIndex = 0;
    while (triangleIndex < triangleCount) {
      let lastIndex;
      let materialIndex = 0;
      const face = importedMesh.brep_faces[faceIndex];
      if (!face) {
        lastIndex = triangleCount;
      } else if (triangleIndex < face.first) {
        lastIndex = face.first;
      } else {
        lastIndex = Math.min(face.last + 1, triangleCount);
        if (face.color) {
          const color = new THREE.Color(...face.color);
          const key = color.getHexString();
          if (!materialMap.has(key)) {
            materialMap.set(key, materials.length);
            materials.push(createCadMaterial(color));
          }
          materialIndex = materialMap.get(key);
        }
        faceIndex += 1;
      }
      geometry.addGroup(triangleIndex * 3, (lastIndex - triangleIndex) * 3, materialIndex);
      triangleIndex = lastIndex;
    }
  }

  const mesh = new THREE.Mesh(geometry, materials.length === 1 ? materials[0] : materials);
  mesh.name = importedMesh.name || `Component ${meshIndex + 1}`;
  mesh.userData.meshIndex = meshIndex;
  mesh.userData.isCadMesh = true;
  return mesh;
}

function createCadMaterial(color) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.04,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    clippingPlanes: elements.sectionToggle?.checked ? [sectionPlane] : [],
    clipShadows: true,
  });
  material.userData.baseColor = color.clone();
  return material;
}

async function parseThreeFormat(primaryFile, files, extension) {
  releaseObjectUrls();
  const manager = new THREE.LoadingManager();
  const resolver = createAssetResolver(files);
  manager.setURLModifier(resolver);
  manager.onError = (url) => console.warn(`Could not load companion resource: ${url}`);

  const buffer = await primaryFile.arrayBuffer();
  const text = () => new TextDecoder().decode(buffer);
  const objectName = stripExtension(primaryFile.name);

  switch (extension) {
    case 'stl': {
      const geometry = new STLLoader(manager).parse(buffer);
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      const hasVertexColors = Boolean(geometry.attributes.color);
      const material = new THREE.MeshStandardMaterial({
        color: hasVertexColors ? 0xffffff : 0x8aa8bf,
        vertexColors: hasVertexColors,
        roughness: 0.58,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
      if (Number.isFinite(geometry.alpha)) material.opacity = geometry.alpha;
      material.transparent = material.opacity < 1;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = objectName;
      return mesh;
    }
    case 'ply': {
      const geometry = new PLYLoader(manager).parse(buffer);
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: geometry.attributes.color ? 0xffffff : 0x8aa8bf,
        vertexColors: Boolean(geometry.attributes.color),
        roughness: 0.58,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = objectName;
      return mesh;
    }
    case 'obj': {
      const objLoader = new OBJLoader(manager);
      const mtlFile = findCompanionFile(files, `${objectName}.mtl`, 'mtl');
      if (mtlFile) {
        updateLoading('Reading OBJ materials…', 42);
        const materials = new MTLLoader(manager).parse(await mtlFile.text(), '');
        materials.preload();
        objLoader.setMaterials(materials);
      }
      const group = objLoader.parse(text());
      group.name ||= objectName;
      return group;
    }
    case 'glb':
    case 'gltf': {
      const loader = new GLTFLoader(manager);
      const dracoLoader = new DRACOLoader(manager);
      dracoLoader.setDecoderPath('./vendor/libs/draco/gltf/');
      loader.setDRACOLoader(dracoLoader);
      loader.setMeshoptDecoder(MeshoptDecoder);
      const data = extension === 'gltf' ? text() : buffer;
      const gltf = await new Promise((resolve, reject) => loader.parse(data, '', resolve, reject));
      dracoLoader.dispose();
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) throw new Error('The glTF file does not contain a renderable scene.');
      root.name ||= objectName;
      return root;
    }
    case 'fbx': {
      const root = new FBXLoader(manager).parse(buffer, '');
      root.name ||= objectName;
      return root;
    }
    case '3mf': {
      const root = new ThreeMFLoader(manager).parse(buffer);
      root.name ||= objectName;
      return root;
    }
    case 'dae': {
      const result = new ColladaLoader(manager).parse(text(), '');
      if (!result.scene) throw new Error('The DAE file does not contain a renderable scene.');
      result.scene.name ||= objectName;
      return result.scene;
    }
    case '3ds': {
      const root = new TDSLoader(manager).parse(buffer, '');
      root.name ||= objectName;
      return root;
    }
    case 'wrl':
    case 'vrml': {
      const root = new VRMLLoader(manager).parse(text(), '');
      root.name ||= objectName;
      return root;
    }
    default:
      throw new Error(`No loader is available for .${extension} files.`);
  }
}

function createAssetResolver(files) {
  const fileMap = new Map();
  files.forEach((file) => {
    const relativePath = normalizePath(file.webkitRelativePath || '');
    const name = normalizePath(file.name);
    if (relativePath) fileMap.set(relativePath.toLowerCase(), file);
    fileMap.set(name.toLowerCase(), file);
    fileMap.set(basename(name).toLowerCase(), file);
  });

  return (url) => {
    if (!url || /^(data:|blob:|https?:)/i.test(url)) return url;
    const clean = normalizePath(decodeURIComponent(url.split(/[?#]/)[0])).replace(/^\.\//, '');
    const file = fileMap.get(clean.toLowerCase()) || fileMap.get(basename(clean).toLowerCase());
    if (!file) return url;
    const objectUrl = URL.createObjectURL(file);
    activeObjectUrls.push(objectUrl);
    return objectUrl;
  };
}

async function installModel(importedObject, format, { fit = true } = {}) {
  disposeModel();
  modelRoot = new THREE.Group();
  modelRoot.name = importedObject.name || activeFileName || `${format.label} model`;
  modelRoot.add(importedObject);
  scene.add(modelRoot);

  meshEntries = [];
  modelRoot.updateMatrixWorld(true);
  decorateMeshes(modelRoot);
  if (!meshEntries.length) throw new Error(`The ${format.label} file contains no renderable mesh geometry.`);

  modelRoot.updateMatrixWorld(true);
  modelBox.setFromObject(modelRoot);
  if (modelBox.isEmpty()) throw new Error('The model has no measurable geometry.');

  modelBox.getCenter(modelCenter);
  const sphere = modelBox.getBoundingSphere(new THREE.Sphere());
  modelRadius = Math.max(sphere.radius, 0.001);
  const size = modelBox.getSize(new THREE.Vector3());
  const gridBase = worldUpAxis === 'y' ? Math.max(size.x, size.z) : Math.max(size.x, size.y);
  const groundPosition = worldUpAxis === 'y' ? modelBox.min.y : modelBox.min.z;
  createGrid(niceGridSize(Math.max(gridBase, size.length() / 3) * 2.4), 20, groundPosition);
  axesHelper.position.copy(modelBox.min);
  axesHelper.scale.setScalar(Math.max(size.length() / 180, 0.25));

  applyDisplaySettings();
  buildSceneTree();
  updateSectionView();
  if (fit) fitModel('iso');
  await nextFrame();
}

function decorateMeshes(root) {
  let unnamedIndex = 0;
  root.traverse((object) => {
    if (!object.isMesh || object.userData.isGeneratedEdges) return;
    unnamedIndex += 1;
    object.name ||= `Component ${unnamedIndex}`;
    const geometry = object.geometry;
    if (!geometry?.attributes?.position) return;
    if (!geometry.attributes.normal && geometry.index) geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    if (!object.material) object.material = createCadMaterial(new THREE.Color(0x86a6c0));
    let edgeGeometry;
    if (object.userData.exactEdgePositions?.length) {
      edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute('position', new THREE.BufferAttribute(object.userData.exactEdgePositions, 3));
    } else {
      edgeGeometry = new THREE.EdgesGeometry(geometry, 24);
    }
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x13202c,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      clippingPlanes: elements.sectionToggle?.checked ? [sectionPlane] : [],
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.name = `${object.name} edges`;
    edges.renderOrder = 2;
    edges.userData.isGeneratedEdges = true;
    object.add(edges);

    const instances = object.isInstancedMesh ? object.count : 1;
    const triangleCount = getTriangleCount(geometry) * instances;
    const vertexCount = geometry.attributes.position.count * instances;
    meshEntries.push({
      name: object.name,
      mesh: object,
      edges,
      triangleCount,
      vertexCount,
      bodyId: object.userData.bodyId || null,
      bodyStats: object.userData.bodyStats || null,
    });
  });
}

function updateModelInterface(primaryFile, files, format, elapsedMs) {
  const size = modelBox.getSize(new THREE.Vector3());
  const triangles = meshEntries.reduce((sum, entry) => sum + entry.triangleCount, 0);
  const vertices = meshEntries.reduce((sum, entry) => sum + entry.vertexCount, 0);
  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);

  elements.welcomeOverlay.hidden = true;
  elements.emptyModelCard.hidden = true;
  elements.fileCard.hidden = false;
  elements.treeSection.hidden = false;
  elements.fileIcon.textContent = format.label.toUpperCase();
  elements.fileName.textContent = primaryFile.name;
  elements.fileName.title = primaryFile.name;
  elements.fileSize.textContent = `${formatBytes(totalBytes)}${files.length > 1 ? ` · ${files.length} files` : ''}`;
  elements.meshStat.textContent = formatNumber(meshEntries.length);
  elements.triangleStat.textContent = formatNumber(triangles);
  elements.vertexStat.textContent = formatNumber(vertices);
  elements.timeStat.textContent = `${(elapsedMs / 1000).toFixed(2)} s`;
  elements.dimensionUnit.textContent = format.units;
  elements.dimensionX.textContent = formatDimension(size.x);
  elements.dimensionY.textContent = formatDimension(size.y);
  elements.dimensionZ.textContent = formatDimension(size.z);
  elements.clearButton.disabled = false;
  elements.fitButton.disabled = false;
  elements.screenshotButton.disabled = false;
  elements.measureStartButton.disabled = false;
  elements.measureClearButton.disabled = false;
  $$('.view-button').forEach((button) => { button.disabled = false; });
}

function buildSceneTree() {
  elements.modelTree.replaceChildren();
  let nodeCount = 0;

  function hasRenderableDescendant(object) {
    if (object.isMesh && !object.userData.isGeneratedEdges) return true;
    return object.children.some((child) => !child.userData.isGeneratedEdges && hasRenderableDescendant(child));
  }

  function createNode(object, depth = 0) {
    nodeCount += 1;
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node';
    wrapper.style.setProperty('--depth', depth);

    const row = document.createElement('div');
    row.className = 'tree-row';
    const children = object.children.filter((child) => !child.userData.isGeneratedEdges && hasRenderableDescendant(child));

    if (children.length) {
      const toggle = document.createElement('button');
      toggle.className = 'tree-toggle';
      toggle.type = 'button';
      toggle.title = 'Expand or collapse';
      toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>';
      toggle.addEventListener('click', () => wrapper.classList.toggle('is-collapsed'));
      row.append(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tree-spacer';
      row.append(spacer);
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = object.visible;
    checkbox.title = 'Toggle visibility';
    checkbox.addEventListener('change', () => { object.visible = checkbox.checked; });
    row.append(checkbox);

    const displayName = object.name || object.type || `Object ${nodeCount}`;
    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'tree-name tree-name-button';
    name.textContent = displayName;
    name.title = displayName;
    name.addEventListener('click', () => {
      const target = object.isMesh ? object : findFirstMesh(object);
      if (target) selectMesh(target);
    });
    row.dataset.searchText = displayName.toLowerCase();
    row.append(name);
    wrapper.append(row);

    if (children.length) {
      const childContainer = document.createElement('div');
      childContainer.className = 'tree-children';
      children.forEach((child) => childContainer.append(createNode(child, depth + 1)));
      wrapper.append(childContainer);
    }
    return wrapper;
  }

  elements.modelTree.append(createNode(modelRoot, 0));
  elements.treeCount.textContent = nodeCount;
}

function filterTree() {
  const query = elements.treeSearchInput.value.trim().toLowerCase();
  $$('.tree-row').forEach((row) => row.classList.toggle('is-match', Boolean(query && row.dataset.searchText.includes(query))));
  $$('.tree-node').forEach((node) => {
    if (!query) {
      node.hidden = false;
      return;
    }
    const ownMatch = node.firstElementChild?.dataset.searchText?.includes(query);
    const descendantMatch = [...node.querySelectorAll('.tree-row')].some((row) => row.dataset.searchText.includes(query));
    node.hidden = !(ownMatch || descendantMatch);
    if (descendantMatch) node.classList.remove('is-collapsed');
  });
}

function applyDisplaySettings() {
  const visitedMaterials = new Set();
  meshEntries.forEach((entry) => {
    entry.edges.visible = elements.edgesToggle.checked;
    if (entry.edges.material) {
      entry.edges.material.clippingPlanes = elements.sectionToggle.checked ? [sectionPlane] : [];
      entry.edges.material.needsUpdate = true;
    }
    const materials = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material];
    materials.filter(Boolean).forEach((material) => {
      if (visitedMaterials.has(material)) return;
      visitedMaterials.add(material);
      if ('wireframe' in material) material.wireframe = elements.wireframeToggle.checked;
      material.clippingPlanes = elements.sectionToggle.checked ? [sectionPlane] : [];
      material.clipShadows = true;
      material.needsUpdate = true;
    });
  });
  if (gridHelper) gridHelper.visible = elements.gridToggle.checked;
}

function createGrid(size, divisions, groundPosition) {
  if (gridHelper) {
    scene.remove(gridHelper);
    gridHelper.geometry.dispose();
    gridHelper.material.dispose();
  }
  gridHelper = new THREE.GridHelper(size, divisions, 0x42617d, 0x26384a);
  if (worldUpAxis === 'z') {
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.set(0, 0, groundPosition);
  } else {
    gridHelper.rotation.set(0, 0, 0);
    gridHelper.position.set(0, groundPosition, 0);
  }
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.32;
  gridHelper.material.depthWrite = false;
  gridHelper.visible = elements.gridToggle.checked;
  scene.add(gridHelper);
}

function fitModel(view = 'iso') {
  if (!meshEntries.length) return;
  setView(view, true);
}

function setView(view, isFit = false) {
  if (!meshEntries.length) return;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = Math.max((modelRadius / Math.sin(fov / 2)) * 1.28, modelRadius * 2.2);
  const directions = worldUpAxis === 'y'
    ? {
      iso: new THREE.Vector3(1, 0.78, 1),
      front: new THREE.Vector3(0, 0, 1),
      top: new THREE.Vector3(0, 1, 0),
      right: new THREE.Vector3(1, 0, 0),
    }
    : {
      iso: new THREE.Vector3(1, -1, 0.78),
      front: new THREE.Vector3(0, -1, 0),
      top: new THREE.Vector3(0, 0, 1),
      right: new THREE.Vector3(1, 0, 0),
    };
  const direction = (directions[view] || directions.iso).normalize();

  if (worldUpAxis === 'y') {
    camera.up.set(0, 1, 0);
    if (view === 'top') camera.up.set(0, 0, -1);
  } else {
    camera.up.set(0, 0, 1);
    if (view === 'top') camera.up.set(0, 1, 0);
  }
  camera.position.copy(modelCenter).addScaledVector(direction, distance);
  camera.near = Math.max(distance / 10000, 0.001);
  camera.far = Math.max(distance * 100, modelRadius * 1000);
  camera.updateProjectionMatrix();
  controls.target.copy(modelCenter);
  controls.maxDistance = distance * 30;
  controls.update();
  controls.saveState();

  $$('.view-button').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  if (!isFit) setStatus(`${view[0].toUpperCase()}${view.slice(1)} view`);
}

function onViewportClick(event) {
  if (!meshEntries.length || !pointerDown) return;
  const movement = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (movement > 4) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const visibleMeshes = meshEntries.map((entry) => entry.mesh).filter((mesh) => mesh.visible && areParentsVisible(mesh));
  const [hit] = raycaster.intersectObjects(visibleMeshes, false);
  if (measurementActive) {
    if (hit?.point) addMeasurementPoint(hit.point);
    else showToast('Pick a point on the model surface.', true);
    return;
  }
  if (hit?.object) selectMesh(hit.object);
  else deselectMesh();
}

function selectMesh(mesh) {
  if (!mesh?.isMesh || selectedMesh === mesh) return;
  deselectMesh();
  selectedMesh = mesh;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  selectedMaterialState = materials.filter(Boolean).map((material) => ({
    material,
    emissive: material.emissive?.clone(),
    emissiveIntensity: material.emissiveIntensity,
    color: material.color?.clone(),
  }));
  selectedMaterialState.forEach(({ material }) => {
    if (material.emissive) {
      material.emissive.set(0x1c72a9);
      material.emissiveIntensity = 0.42;
    } else if (material.color) {
      material.color.lerp(new THREE.Color(0x49a8e8), 0.38);
    }
  });

  const entry = meshEntries.find((item) => item.mesh === mesh);
  elements.selectionEmpty.hidden = true;
  elements.selectionDetails.hidden = false;
  elements.selectionName.textContent = mesh.name || 'Unnamed component';
  elements.selectionName.title = elements.selectionName.textContent;
  elements.selectionType.textContent = entry ? `${formatNumber(entry.triangleCount)} triangles` : 'Mesh';
  const stats = entry?.bodyStats;
  elements.bodyArea.textContent = stats ? `${formatDimension(stats.area)} mm²` : '—';
  elements.bodyVolume.textContent = stats ? `${formatDimension(stats.volume)} mm³` : '—';
  elements.bodyEdgeLength.textContent = stats ? `${formatDimension(stats.edgeLength)} mm` : '—';
  updateCadInterface();
}

function deselectMesh() {
  selectedMaterialState.forEach(({ material, emissive, emissiveIntensity, color }) => {
    if (material.emissive && emissive) material.emissive.copy(emissive);
    if (Number.isFinite(emissiveIntensity)) material.emissiveIntensity = emissiveIntensity;
    if (material.color && color) material.color.copy(color);
  });
  selectedMaterialState = [];
  selectedMesh = null;
  elements.selectionEmpty.hidden = false;
  elements.selectionDetails.hidden = true;
  elements.bodyArea.textContent = '—';
  elements.bodyVolume.textContent = '—';
  elements.bodyEdgeLength.textContent = '—';
  updateCadInterface();
}

function isolateSelected() {
  if (!selectedMesh) return;
  meshEntries.forEach((entry) => { entry.mesh.visible = entry.mesh === selectedMesh; });
  showToast(`Isolated ${selectedMesh.name || 'selected component'}.`);
}

function showAllMeshes() {
  modelRoot.traverse((object) => {
    if (!object.userData.isGeneratedEdges) object.visible = true;
  });
  elements.modelTree.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = true; });
  showToast('All components are visible.');
}

function selectedBodyId() {
  return selectedMesh?.userData?.bodyId || null;
}

function updateCadInterface() {
  const bodyId = selectedBodyId();
  const hasSelection = Boolean(cadEditable && bodyId);
  elements.editTools.hidden = !cadEditable;
  elements.editDisabledNote.hidden = cadEditable;
  elements.editStatus.textContent = cadEditable ? `${cadBodies.length} bod${cadBodies.length === 1 ? 'y' : 'ies'} · exact B-Rep` : 'Open a STEP file';
  elements.undoButton.disabled = !cadEditable || !cadHistory.canUndo;
  elements.redoButton.disabled = !cadEditable || !cadHistory.canRedo;
  elements.saveStepButton.disabled = !cadEditable || !cadBodies.length;
  elements.saveLocalButton.disabled = !cadEditable || !cadBodies.length;

  [
    elements.translateButton, elements.rotateButton, elements.scaleButton,
    elements.duplicateButton, elements.deleteBodyButton, elements.holeButton,
    elements.filletButton, elements.chamferButton,
  ].forEach((button) => { button.disabled = !hasSelection; });

  const currentTarget = elements.booleanTarget.value;
  const currentTool = elements.booleanTool.value;
  elements.booleanTarget.replaceChildren();
  elements.booleanTool.replaceChildren();
  for (const body of cadBodies) {
    for (const select of [elements.booleanTarget, elements.booleanTool]) {
      const option = document.createElement('option');
      option.value = body.id;
      option.textContent = body.name;
      select.append(option);
    }
  }
  if (cadBodies.some((body) => body.id === currentTarget)) elements.booleanTarget.value = currentTarget;
  else if (bodyId) elements.booleanTarget.value = bodyId;
  if (cadBodies.some((body) => body.id === currentTool)) elements.booleanTool.value = currentTool;
  if (elements.booleanTool.value === elements.booleanTarget.value && cadBodies.length > 1) {
    const alternate = cadBodies.find((body) => body.id !== elements.booleanTarget.value);
    if (alternate) elements.booleanTool.value = alternate.id;
  }
  elements.booleanButton.disabled = !cadEditable || cadBodies.length < 2;
  elements.addPrimitiveButton.disabled = !cadEditable;
  elements.extrudeButton.disabled = !cadEditable || (elements.extrudeMode.value !== 'new' && !hasSelection);
}

async function runCadMutation(action, payload = {}, loadingText = 'Updating CAD model…', preferredBodyId = null) {
  if (!cadEditable) {
    showToast('Open a STEP or STP file to use exact CAD modification tools.', true);
    return;
  }
  const cameraPosition = camera.position.clone();
  const cameraUp = camera.up.clone();
  const controlTarget = controls.target.clone();
  const previousBodyId = preferredBodyId || selectedBodyId();
  try {
    setLoading(true, 'Modifying STEP geometry', loadingText, 28);
    setStatus('Computing exact geometry', 'busy');
    const sceneData = await cadCall(action, payload);
    cadBodies = sceneData.bodies || [];
    cadHistory = sceneData.history || { canUndo: false, canRedo: false };
    updateLoading('Rebuilding the display mesh…', 76);
    await refreshCadScene(sceneData, previousBodyId, { cameraPosition, cameraUp, controlTarget });
    setLoading(false);
    setStatus('CAD model updated');
    showToast('CAD operation completed.');
  } catch (error) {
    handleLoadError(error);
    setStatus('CAD operation failed', 'error');
  }
}

function mutateSelected(action, payload = {}, loadingText) {
  const bodyId = selectedBodyId();
  if (!bodyId) {
    showToast('Select a CAD body first.', true);
    return;
  }
  return runCadMutation(action, { ...payload, bodyId }, loadingText, bodyId);
}

async function refreshCadScene(sceneData, preferredBodyId, savedView) {
  deselectMesh();
  const object = buildEditableCadObject(sceneData);
  await installModel(object, activeFormat, { fit: false });
  updateEditableModelStatistics();
  if (savedView) {
    camera.position.copy(savedView.cameraPosition);
    camera.up.copy(savedView.cameraUp);
    controls.target.copy(savedView.controlTarget);
    camera.updateProjectionMatrix();
    controls.update();
  }
  let targetMesh = meshEntries.find((entry) => entry.bodyId === preferredBodyId)?.mesh;
  if (!targetMesh && meshEntries.length) targetMesh = meshEntries[meshEntries.length - 1].mesh;
  if (targetMesh) selectMesh(targetMesh);
  updateCadInterface();
  updateSectionView();
}

function updateEditableModelStatistics() {
  const size = modelBox.getSize(new THREE.Vector3());
  const triangles = meshEntries.reduce((sum, entry) => sum + entry.triangleCount, 0);
  const vertices = meshEntries.reduce((sum, entry) => sum + entry.vertexCount, 0);
  elements.meshStat.textContent = formatNumber(meshEntries.length);
  elements.triangleStat.textContent = formatNumber(triangles);
  elements.vertexStat.textContent = formatNumber(vertices);
  elements.dimensionUnit.textContent = 'mm';
  elements.dimensionX.textContent = formatDimension(size.x);
  elements.dimensionY.textContent = formatDimension(size.y);
  elements.dimensionZ.textContent = formatDimension(size.z);
}

function updatePrimitiveFields() {
  const type = elements.primitiveType.value;
  elements.boxFields.hidden = type !== 'box';
  elements.roundFields.hidden = type === 'box';
  elements.primitiveAxisLabel.hidden = type !== 'cylinder';
  elements.primitiveHeightLabel.hidden = type === 'sphere';
}

function addPrimitive() {
  if (!cadEditable) return;
  const type = elements.primitiveType.value;
  const payload = {
    type,
    x: elements.primitiveX.value,
    y: elements.primitiveY.value,
    z: elements.primitiveZ.value,
    length: elements.boxLength.value,
    width: elements.boxWidth.value,
    height: type === 'box' ? elements.boxHeight.value : elements.primitiveHeight.value,
    radius: elements.primitiveRadius.value,
    axis: elements.primitiveAxis.value,
  };
  runCadMutation('addPrimitive', payload, `Creating ${type}…`);
}

function updateExtrudeFields() {
  const circle = elements.extrudeProfile.value === 'circle';
  elements.extrudeRectangleFields.hidden = circle;
  elements.extrudeCircleFields.hidden = !circle;
}

function applySketchExtrusion() {
  if (!cadEditable) return;
  const mode = elements.extrudeMode.value;
  const bodyId = selectedBodyId();
  if (mode !== 'new' && !bodyId) {
    showToast('Select the body to cut or join.', true);
    return;
  }
  runCadMutation('extrudeSketch', {
    bodyId,
    mode,
    profile: elements.extrudeProfile.value,
    x: elements.extrudeX.value,
    y: elements.extrudeY.value,
    z: elements.extrudeZ.value,
    width: elements.extrudeWidth.value,
    height: elements.extrudeHeight.value,
    radius: elements.extrudeRadius.value,
    axis: elements.extrudeAxis.value,
    distance: elements.extrudeDistance.value,
  }, mode === 'cut' ? 'Computing cut extrusion…' : 'Creating sketch extrusion…', bodyId);
}

function applyBooleanOperation() {
  const targetId = elements.booleanTarget.value;
  const toolId = elements.booleanTool.value;
  if (!targetId || !toolId || targetId === toolId) {
    showToast('Choose two different CAD bodies.', true);
    return;
  }
  runCadMutation('booleanOperation', {
    targetId,
    toolId,
    operation: elements.booleanOperation.value,
  }, 'Computing Boolean operation…', targetId);
}

async function exportModifiedStep() {
  if (!cadEditable) return;
  try {
    setLoading(true, 'Exporting STEP model', 'Writing exact B-Rep geometry…', 40);
    const { buffer, mimeType } = await cadCall('exportProject');
    const baseName = stripExtension(activeFileName) || 'stepscope-model';
    downloadBlob(new Blob([buffer], { type: mimeType || 'model/step' }), `${baseName}-modified.step`);
    setLoading(false);
    setStatus('STEP saved');
    showToast('Modified STEP file downloaded.');
  } catch (error) {
    handleLoadError(error);
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openProjectDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('STEPscope-local-projects', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('projects')) request.result.createObjectStore('projects');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
  });
}

async function storeLocalProject(record) {
  const db = await openProjectDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    transaction.objectStore('projects').put(record, 'latest');
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function readLocalProject() {
  const db = await openProjectDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readonly');
    const request = transaction.objectStore('projects').get('latest');
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function saveProjectLocally() {
  if (!cadEditable) return;
  try {
    setLoading(true, 'Saving browser copy', 'Exporting an editable STEP snapshot…', 35);
    const { buffer, mimeType } = await cadCall('exportProject');
    const fileName = `${stripExtension(activeFileName) || 'stepscope-model'}-local.step`;
    await storeLocalProject({
      fileName,
      blob: new Blob([buffer], { type: mimeType || 'model/step' }),
      savedAt: new Date().toISOString(),
    });
    setLoading(false);
    showToast('A STEP copy was stored locally in this browser.');
  } catch (error) {
    handleLoadError(error);
  }
}

async function loadLocalProject() {
  try {
    const record = await readLocalProject();
    if (!record?.blob) {
      showToast('No locally stored STEP project was found in this browser.', true);
      return;
    }
    const file = new File([record.blob], record.fileName || 'local-project.step', { type: 'model/step' });
    await loadModelFiles([file]);
  } catch (error) {
    showToast(error?.message || 'The locally stored project could not be opened.', true);
  }
}

function toggleMeasurement() {
  if (!meshEntries.length) return;
  if (measurementActive) {
    measurementActive = false;
    elements.measureStartButton.textContent = 'Start measuring';
    elements.measureHint.hidden = true;
    setStatus('Measurement paused');
    return;
  }
  clearMeasurement();
  measurementActive = true;
  elements.measureStartButton.textContent = 'Stop measuring';
  elements.measureHint.hidden = false;
  elements.measureHint.textContent = measurementInstruction();
  setStatus('Measurement active', 'busy');
}

function measurementInstruction() {
  const required = elements.measureMode.value === 'distance' ? 2 : 3;
  return `Pick ${required - measurementPoints.length} more point${required - measurementPoints.length === 1 ? '' : 's'} on the model`;
}

function clearMeasurement() {
  measurementActive = false;
  measurementPoints = [];
  elements.measureStartButton.textContent = 'Start measuring';
  elements.measureHint.hidden = true;
  elements.measureResult.textContent = '—';
  elements.measureDeltas.textContent = '—';
  if (measurementGroup) {
    while (measurementGroup.children.length) {
      const child = measurementGroup.children.pop();
      child.geometry?.dispose?.();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach((material) => material.dispose?.());
    }
  }
}

function addMeasurementPoint(point) {
  measurementPoints.push(point.clone());
  rebuildMeasurementVisual();
  const mode = elements.measureMode.value;
  const required = mode === 'distance' ? 2 : 3;
  if (measurementPoints.length < required) {
    elements.measureHint.textContent = measurementInstruction();
    if (measurementPoints.length === 1) {
      const p = measurementPoints[0];
      elements.measureResult.textContent = `P1 (${formatDimension(p.x)}, ${formatDimension(p.y)}, ${formatDimension(p.z)})`;
    }
    return;
  }

  if (mode === 'distance') calculateDistanceMeasurement();
  else if (mode === 'angle') calculateAngleMeasurement();
  else calculateCircleMeasurement();
  measurementActive = false;
  elements.measureStartButton.textContent = 'Start measuring';
  elements.measureHint.hidden = true;
  setStatus('Measurement complete');
}

function rebuildMeasurementVisual() {
  if (!measurementGroup) return;
  while (measurementGroup.children.length) {
    const child = measurementGroup.children.pop();
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => material.dispose?.());
  }
  const radius = Math.max(modelRadius * 0.008, 0.15);
  for (const point of measurementPoints) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffbd4a, depthTest: false }),
    );
    marker.position.copy(point);
    marker.renderOrder = 20;
    measurementGroup.add(marker);
  }
  if (measurementPoints.length > 1) {
    const points = [...measurementPoints];
    if (elements.measureMode.value === 'circle' && points.length === 3) points.push(points[0]);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffbd4a, depthTest: false }));
    line.renderOrder = 19;
    measurementGroup.add(line);
  }
}

function calculateDistanceMeasurement() {
  const [a, b] = measurementPoints;
  const delta = b.clone().sub(a);
  elements.measureResult.textContent = `${formatDimension(delta.length())} ${activeFormat?.units === 'mm' ? 'mm' : 'units'}`;
  elements.measureDeltas.textContent = `${formatDimension(delta.x)} / ${formatDimension(delta.y)} / ${formatDimension(delta.z)}`;
}

function calculateAngleMeasurement() {
  const [a, vertex, c] = measurementPoints;
  const v1 = a.clone().sub(vertex);
  const v2 = c.clone().sub(vertex);
  if (v1.lengthSq() < 1e-12 || v2.lengthSq() < 1e-12) {
    elements.measureResult.textContent = 'Invalid points';
    return;
  }
  const angle = THREE.MathUtils.radToDeg(v1.angleTo(v2));
  elements.measureResult.textContent = `${angle.toFixed(3)}°`;
  elements.measureDeltas.textContent = 'P2 is the angle vertex';
}

function calculateCircleMeasurement() {
  const [a, b, c] = measurementPoints;
  const ab = a.distanceTo(b);
  const bc = b.distanceTo(c);
  const ca = c.distanceTo(a);
  const doubleArea = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).length();
  if (doubleArea < 1e-9) {
    elements.measureResult.textContent = 'Points are collinear';
    elements.measureDeltas.textContent = '—';
    return;
  }
  const radius = (ab * bc * ca) / (2 * doubleArea);
  elements.measureResult.textContent = `R ${formatDimension(radius)} · Ø ${formatDimension(radius * 2)}`;
  elements.measureDeltas.textContent = activeFormat?.units === 'mm' ? 'mm' : 'model units';
}

function updateSectionView() {
  if (!meshEntries.length || modelBox.isEmpty()) {
    if (sectionPlaneHelper) sectionPlaneHelper.visible = false;
    applyDisplaySettings();
    return;
  }
  const enabled = Boolean(elements.sectionToggle?.checked);
  const normal = sectionAxis === 'x'
    ? new THREE.Vector3(1, 0, 0)
    : sectionAxis === 'y'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
  if (elements.sectionFlip?.checked) normal.negate();
  const ratio = Number(elements.sectionOffset?.value || 50) / 100;
  const point = new THREE.Vector3(
    THREE.MathUtils.lerp(modelBox.min.x, modelBox.max.x, ratio),
    THREE.MathUtils.lerp(modelBox.min.y, modelBox.max.y, ratio),
    THREE.MathUtils.lerp(modelBox.min.z, modelBox.max.z, ratio),
  );
  sectionPlane.setFromNormalAndCoplanarPoint(normal, point);
  if (elements.sectionOffsetValue) elements.sectionOffsetValue.textContent = `${Math.round(ratio * 100)}%`;
  if (sectionPlaneHelper) {
    sectionPlaneHelper.visible = enabled && elements.sectionHelperToggle.checked;
    sectionPlaneHelper.scale.setScalar(Math.max((modelRadius * 2.4) / 100, 0.01));
  }
  applyDisplaySettings();
  if (enabled) setStatus(`Section ${sectionAxis.toUpperCase()} active`);
}

function saveScreenshot() {
  if (!meshEntries.length) return;
  renderFrame();
  const anchor = document.createElement('a');
  const baseName = stripExtension(activeFileName) || '3d-model';
  anchor.download = `${baseName}-view.png`;
  anchor.href = renderer.domElement.toDataURL('image/png');
  anchor.click();
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await elements.viewport.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    showToast('Fullscreen mode is not available.', true);
  }
}

function clearModel() {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
  if (cadWorker) {
    cadWorker.terminate();
    cadWorker = null;
  }
  cadPending.forEach(({ reject }) => reject(new Error('CAD project cleared.')));
  cadPending.clear();
  cadEditable = false;
  cadBodies = [];
  cadHistory = { canUndo: false, canRedo: false };
  clearMeasurement();
  elements.sectionToggle.checked = false;
  elements.sectionHelperToggle.checked = false;
  updateSectionView();
  deselectMesh();
  disposeModel();
  releaseObjectUrls();
  modelRoot = new THREE.Group();
  scene.add(modelRoot);
  activeFileName = '';
  activeFormat = null;
  meshEntries = [];
  worldUpAxis = 'z';
  elements.welcomeOverlay.hidden = false;
  elements.emptyModelCard.hidden = false;
  elements.fileCard.hidden = true;
  elements.treeSection.hidden = true;
  elements.modelTree.replaceChildren();
  elements.treeSearchInput.value = '';
  elements.meshStat.textContent = '—';
  elements.triangleStat.textContent = '—';
  elements.vertexStat.textContent = '—';
  elements.timeStat.textContent = '—';
  elements.dimensionUnit.textContent = 'units';
  elements.dimensionX.textContent = '—';
  elements.dimensionY.textContent = '—';
  elements.dimensionZ.textContent = '—';
  elements.clearButton.disabled = true;
  elements.fitButton.disabled = true;
  elements.screenshotButton.disabled = true;
  elements.measureStartButton.disabled = true;
  elements.measureClearButton.disabled = true;
  elements.undoButton.disabled = true;
  elements.redoButton.disabled = true;
  elements.saveStepButton.disabled = true;
  elements.saveLocalButton.disabled = true;
  $$('.view-button').forEach((button) => { button.disabled = true; });
  createGrid(200, 20, 0);
  axesHelper.position.set(0, 0, 0);
  axesHelper.scale.setScalar(1);
  camera.up.set(0, 0, 1);
  camera.position.set(140, -140, 105);
  controls.target.set(0, 0, 0);
  controls.update();
  updateCadInterface();
  setStatus('Ready');
}

function disposeModel() {
  if (!modelRoot) return;
  scene.remove(modelRoot);
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  modelRoot.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });
  geometries.forEach((geometry) => geometry.dispose?.());
  textures.forEach((texture) => texture.dispose?.());
  materials.forEach((material) => material.dispose?.());
}

function releaseObjectUrls() {
  activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activeObjectUrls = [];
}

function resizeViewer() {
  const { width, height } = elements.viewport.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function renderFrame() {
  controls.update();
  renderer.render(scene, camera);
}

function setLoading(isLoading, title = '', detail = '', progress = 0) {
  elements.loadingOverlay.hidden = !isLoading;
  if (isLoading) {
    elements.loadingTitle.textContent = title;
    elements.loadingDetail.textContent = detail;
    elements.progressBar.style.width = `${progress}%`;
  }
}

function updateLoading(detail, progress) {
  elements.loadingDetail.textContent = detail;
  elements.progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
}

function handleLoadError(error) {
  console.error(error);
  setLoading(false);
  setStatus('Import failed', 'error');
  showToast(error?.message || 'The 3D file could not be loaded.', true);
}

function setStatus(text, mode = 'ready') {
  elements.statusPill.classList.toggle('is-busy', mode === 'busy');
  elements.statusPill.classList.toggle('is-error', mode === 'error');
  elements.statusPill.lastElementChild.textContent = text;
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', isError);
  elements.toast.classList.add('is-visible');
  toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 4200);
}

function choosePrimaryModelFile(files) {
  return files.find(isSupportedModelFile) || null;
}

function isSupportedModelFile(file) {
  return Boolean(file && FORMAT_DEFINITIONS[getExtension(file.name)]);
}

function findCompanionFile(files, preferredName, extension) {
  const preferred = preferredName.toLowerCase();
  return files.find((file) => file.name.toLowerCase() === preferred)
    || files.find((file) => getExtension(file.name) === extension)
    || null;
}

function getExtension(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : '';
}

function stripExtension(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/, '');
}

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function basename(path) {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function findFirstMesh(object) {
  let result = null;
  object.traverse((child) => {
    if (!result && child.isMesh && !child.userData.isGeneratedEdges) result = child;
  });
  return result;
}

function areParentsVisible(object) {
  let current = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function getTriangleCount(geometry) {
  if (!geometry?.attributes?.position) return 0;
  if (geometry.index) return geometry.index.count / 3;
  return geometry.attributes.position.count / 3;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function formatDimension(value) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(1);
  if (Math.abs(value) >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function niceGridSize(value) {
  const safeValue = Math.max(value, 1);
  const exponent = 10 ** Math.floor(Math.log10(safeValue));
  const fraction = safeValue / exponent;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * exponent;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
