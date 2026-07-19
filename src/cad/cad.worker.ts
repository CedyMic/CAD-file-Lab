import opencascadeFactory from
  'replicad-opencascadejs/src/replicad_single.js'

import opencascadeWasm from
  'replicad-opencascadejs/src/replicad_single.wasm?url'

import { DOMParser as XmlDomParser } from '@xmldom/xmldom'

import {
  deserializeShape,
  draw,
  importSTEP,
  drawCircle,
  drawRectangle,
  exportSTEP,
  makeBox,
  makeCylinder,
  makeSphere,
  Plane,
  setOC,
  Solid,
} from 'replicad'

import {
  EdgesGeometry,
  Mesh,
  type BufferGeometry,
  type Object3D,
} from 'three'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

import {
  validateStepImportFile,
} from './stepImportFile'

import { getPrimitiveFileName, validateCadPrimitive, type CadPrimitive } from './primitive'
import { getFeatureModelFileName, validateCadFeatureModel, type CadFeatureModel, type SketchExtrudeFeature } from './featureModel'
import {
  getExactCadDownloadName,
  validateExactCadExportSize,
  validateStepExportBlob,
  type ExactCadExportFormat,
} from './exactCadExport'

import {
  createAsyncOperationQueue,
} from '../storage/operationQueue'

type CadShape =
  Awaited<ReturnType<typeof importSTEP>>

;(globalThis as unknown as { DOMParser: typeof XmlDomParser }).DOMParser = XmlDomParser

interface OpenCascadeFactoryOptions {
  locateFile?: (fileName: string) => string
}

type OpenCascadeFactory = (
  options?: OpenCascadeFactoryOptions,
) => Promise<Parameters<typeof setOC>[0]>

export interface SerializedCadProject {
  version: 1
  bodyId: string
  fileName: string
  serializedShape: string
  savedAt: number
  primitive?: CadPrimitive
  featureModel?: CadFeatureModel
}

interface ImportStepRequest {
  id: string
  action: 'importStep'
  file: File
}

interface SerializeProjectRequest {
  id: string
  action: 'serializeProject'
  bodyId: string
}

interface RestoreProjectRequest {
  id: string
  action: 'restoreProject'
  project: SerializedCadProject
}

interface DisposeBodyRequest {
  id: string
  action: 'disposeBody'
  bodyId: string
}

interface CreatePrimitiveRequest { id: string; action: 'createPrimitive'; primitive: CadPrimitive }
interface UpdatePrimitiveRequest { id: string; action: 'updatePrimitive'; bodyId: string; primitive: CadPrimitive }
interface CreateFeatureModelRequest { id: string; action: 'createFeatureModel'; featureModel: CadFeatureModel }
interface UpdateFeatureModelRequest { id: string; action: 'updateFeatureModel'; bodyId: string; featureModel: CadFeatureModel }
interface ExportExactCadRequest { id: string; action: 'exportExactCad'; bodyId: string; format: ExactCadExportFormat }

type WorkerRequest =
  | ImportStepRequest
  | SerializeProjectRequest
  | RestoreProjectRequest
  | CreatePrimitiveRequest
  | UpdatePrimitiveRequest
  | CreateFeatureModelRequest
  | UpdateFeatureModelRequest
  | ExportExactCadRequest
  | DisposeBodyRequest

interface ImportedBodyData {
  bodyId: string
  fileName: string
  editable: boolean
  bodySummaries: Array<{
    id: string
    name: string
  }>
  renderParts: Array<{
    id: string
    name: string
    faces: ReturnType<CadShape['mesh']>
    edges: ReturnType<CadShape['meshEdges']>
  }>

  faces: ReturnType<CadShape['mesh']>

  edges: ReturnType<CadShape['meshEdges']>
  primitive?: CadPrimitive
  featureModel?: CadFeatureModel
}

interface DisposedBodyData {
  disposedBodyId: string
}

interface ExactCadExportData {
  bodyId: string
  format: ExactCadExportFormat
  blob: Blob
  fileName: string
}

type WorkerData =
  | ImportedBodyData
  | SerializedCadProject
  | ExactCadExportData
  | DisposedBodyData

interface WorkerSuccess {
  id: string
  ok: true
  data: WorkerData
}

interface WorkerFailure {
  id: string
  ok: false
  error: string
}

type WorkerResponse =
  | WorkerSuccess
  | WorkerFailure

const workerScope = self as unknown as {
  onmessage:
    | ((event: MessageEvent<WorkerRequest>) => void)
    | null

  postMessage: (response: WorkerResponse) => void
}

const bodies =
  new Map<string, CadShape>()

const bodyFileNames =
  new Map<string, string>()

const bodyPrimitives =
  new Map<string, CadPrimitive>()

const bodyFeatureModels =
  new Map<string, CadFeatureModel>()

const enqueueCadOperation =
  createAsyncOperationQueue()

let initializationPromise:
  Promise<void> | null = null

interface KernelRuntimeConfig {
  wasmUrl?: unknown
}

async function getKernelWasmUrl(): Promise<string> {
  const baseUrl = new URL(
    import.meta.env.BASE_URL,
    self.location.origin,
  )

  const configUrl = new URL(
    'occt-kernel.json',
    baseUrl,
  )

  let response: Response

  try {
    response = await fetch(
      configUrl,
      {
        cache: 'no-store',
      },
    )
  } catch {
    return opencascadeWasm
  }

  if (response.status === 404) {
    return opencascadeWasm
  }

  if (!response.ok) {
    throw new Error(
      `The OCCT kernel configuration could not be loaded (${response.status}).`,
    )
  }

  let config: KernelRuntimeConfig

  try {
    config =
      await response.json() as KernelRuntimeConfig
  } catch {
    throw new Error(
      'The OCCT kernel configuration is not valid JSON.',
    )
  }

  if (
    config.wasmUrl === undefined ||
    config.wasmUrl === null ||
    config.wasmUrl === ''
  ) {
    return opencascadeWasm
  }

  if (typeof config.wasmUrl !== 'string') {
    throw new Error(
      'The OCCT kernel configuration has an invalid wasmUrl.',
    )
  }

  const configuredUrl = new URL(
    config.wasmUrl,
    configUrl,
  )

  if (
    configuredUrl.origin !==
    self.location.origin
  ) {
    throw new Error(
      'The replacement OCCT kernel must be hosted on the same origin.',
    )
  }

  return configuredUrl.href
}

function initializeCadKernel(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const createOpenCascade =
        opencascadeFactory as unknown as
          OpenCascadeFactory

      const kernelWasmUrl =
        await getKernelWasmUrl()

      const openCascade =
        await createOpenCascade({
          locateFile: (fileName) => {
            if (
              fileName.endsWith('.wasm')
            ) {
              return kernelWasmUrl
            }

            return fileName
          },
        })

      setOC(openCascade)
    })()
  }

  return initializationPromise
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'The CAD operation failed for an unknown reason.'
}

function getBody(
  bodyId: string,
): CadShape {
  const shape = bodies.get(bodyId)

  if (!shape) {
    throw new Error(
      'The editable CAD body could not be found.',
    )
  }

  return shape
}

function createRenderData(
  bodyId: string,
  fileName: string,
  shape: CadShape,
): ImportedBodyData {
  const solidShapes = (
    shape as unknown as {
      _listTopo: (topology: 'solid') => unknown[]
    }
  )._listTopo('solid')

  const bodyCount = Math.max(solidShapes.length, 1)
  const bodySummaries = Array.from(
    { length: bodyCount },
    (_, index) => ({
      id: `${bodyId}-body-${index + 1}`,
      name: bodyCount === 1 ? 'Body 1' : `Body ${index + 1}`,
    }),
  )

  const renderParts = solidShapes.length > 0
    ? solidShapes.map((rawSolid, index) => {
        const solid = new Solid(rawSolid as never)
        try {
          return {
            ...bodySummaries[index],
            faces: solid.mesh({ tolerance: 0.1, angularTolerance: 0.3 }),
            edges: solid.meshEdges({ tolerance: 0.1, angularTolerance: 0.3 }),
          }
        } finally {
          solid.delete()
        }
      })
    : [{
        ...bodySummaries[0],
        faces: shape.mesh({ tolerance: 0.1, angularTolerance: 0.3 }),
        edges: shape.meshEdges({ tolerance: 0.1, angularTolerance: 0.3 }),
      }]

  return {
    bodyId,
    fileName,
    editable: true,
    bodySummaries,
    renderParts,

    faces: shape.mesh({
      tolerance: 0.1,
      angularTolerance: 0.3,
    }),

    edges: shape.meshEdges({
      tolerance: 0.1,
      angularTolerance: 0.3,
    }),
  }
}

function createMeshRenderData(
  fileName: string,
  parts: Array<{ name: string; geometry: BufferGeometry }>,
): ImportedBodyData {
  const bodyId = crypto.randomUUID()
  const vertices: number[] = []
  const normals: number[] = []
  const triangles: number[] = []
  const lines: number[] = []
  const renderParts: ImportedBodyData['renderParts'] = []

  for (const part of parts) {
    const { geometry } = part

    if (!geometry.getAttribute('normal')) {
      geometry.computeVertexNormals()
    }

    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    const index = geometry.getIndex()
    const vertexOffset = vertices.length / 3
    const edgeGeometry = new EdgesGeometry(geometry, 15)
    const partId = `${bodyId}-mesh-${renderParts.length + 1}`
    const partName = part.name || `Mesh ${renderParts.length + 1}`
    const partVertices = Array.from(position.array)
    const partNormals = Array.from(normal.array)
    const partTriangles = index
      ? Array.from(index.array, Number)
      : Array.from({ length: position.count }, (_, triangleIndex) => triangleIndex)
    const partLines = Array.from(edgeGeometry.getAttribute('position').array)

    vertices.push(...partVertices)
    normals.push(...partNormals)
    lines.push(...partLines)
    renderParts.push({
      id: partId,
      name: partName,
      faces: { vertices: partVertices, normals: partNormals, triangles: partTriangles, faceGroups: [] },
      edges: { lines: partLines, edgeGroups: [] },
    })

    if (index) {
      triangles.push(...Array.from(index.array, (value) => Number(value) + vertexOffset))
    } else {
      triangles.push(...Array.from(
        { length: position.count },
        (_, triangleIndex) => triangleIndex + vertexOffset,
      ))
    }

    edgeGeometry.dispose()
  }

  if (vertices.length === 0) {
    throw new Error('The selected mesh file contains no triangles.')
  }

  return {
    bodyId,
    fileName,
    editable: false,
    bodySummaries: parts.map((part, index) => ({
      id: `${bodyId}-mesh-${index + 1}`,
      name: part.name || `Mesh ${index + 1}`,
    })),
    renderParts,
    faces: {
      vertices,
      normals,
      triangles,
      faceGroups: [],
    },
    edges: {
      lines,
      edgeGroups: [],
    },
  }
}

async function importMeshFile(
  file: File,
  extension: string,
): Promise<ImportedBodyData> {
  const parts: Array<{ name: string; geometry: BufferGeometry }> = []

  function collectObjectParts(object: Object3D) {
    object.updateMatrixWorld(true)
    object.traverse((child) => {
      if (child instanceof Mesh && child.geometry) {
        const geometry = child.geometry.clone()
        geometry.applyMatrix4(child.matrixWorld)
        parts.push({
          name: child.name || `Mesh ${parts.length + 1}`,
          geometry,
        })
      }
    })
  }

  if (extension === 'stl') {
    parts.push({
      name: 'Mesh 1',
      geometry: new STLLoader().parse(await file.arrayBuffer()),
    })
  } else if (extension === 'ply') {
    parts.push({
      name: 'Mesh 1',
      geometry: new PLYLoader().parse(await file.arrayBuffer()),
    })
  } else if (extension === 'obj') {
    const object = new OBJLoader().parse(await file.text())
    collectObjectParts(object)
  } else if (extension === '3mf') {
    const object = new ThreeMFLoader().parse(await file.arrayBuffer())
    collectObjectParts(object)
  } else {
    const data = extension === 'gltf' ? await file.text() : await file.arrayBuffer()

    if (extension === 'gltf') {
      const json = JSON.parse(data as string) as {
        buffers?: Array<{ uri?: string }>
        images?: Array<{ uri?: string }>
      }
      const externalUri = [...(json.buffers ?? []), ...(json.images ?? [])]
        .map((entry) => entry.uri)
        .find((uri) => uri && !uri.startsWith('data:'))
      if (externalUri) {
        throw new Error('This glTF references external files. Use GLB or an embedded glTF so every dependency stays in one local file.')
      }
    }

    const gltf = await new Promise<GLTF>((resolve, reject) => {
      new GLTFLoader().parse(data, '', resolve, reject)
    })
    collectObjectParts(gltf.scene)
  }

  try {
    return createMeshRenderData(file.name, parts)
  } finally {
    for (const part of parts) {
      part.geometry.dispose()
    }
  }
}

async function importStepFile(
  file: File,
): Promise<ImportedBodyData> {
  validateStepImportFile(file)

  const extension = file.name.toLowerCase().split('.').pop() ?? ''

  if (['stl', 'obj', 'ply', 'glb', 'gltf', '3mf'].includes(extension)) {
    return importMeshFile(file, extension)
  }

  await initializeCadKernel()

  const shape =
    await importSTEP(file)

  const bodyId =
    crypto.randomUUID()

  return registerBodyAfterMeshing(
    bodyId,
    file.name,
    shape,
  )
}

function serializeProject(
  bodyId: string,
): SerializedCadProject {
  const shape =
    getBody(bodyId)

  const fileName =
    bodyFileNames.get(bodyId) ??
    'Recovered CAD project.step'

  return {
    version: 1,
    bodyId,
    fileName,
    serializedShape:
      shape.serialize(),
    savedAt: Date.now(),
    primitive: bodyPrimitives.get(bodyId),
    featureModel: bodyFeatureModels.get(bodyId),
  }
}

async function restoreProject(
  project: SerializedCadProject,
): Promise<ImportedBodyData> {
  if (
    !project ||
    project.version !== 1
  ) {
    throw new Error(
      'This recovery project version is not supported.',
    )
  }

  if (
    typeof project.bodyId !== 'string' ||
    project.bodyId.length === 0
  ) {
    throw new Error(
      'The recovery project has no valid body ID.',
    )
  }

  if (
    typeof project.fileName !== 'string' ||
    project.fileName.length === 0
  ) {
    throw new Error(
      'The recovery project has no valid filename.',
    )
  }

  if (
    typeof project.serializedShape !==
      'string' ||
    project.serializedShape.length === 0
  ) {
    throw new Error(
      'The recovery project contains no editable CAD model.',
    )
  }

  await initializeCadKernel()

  const restoredShape =
    deserializeShape(
      project.serializedShape,
    ).asShape3D()

  if (restoredShape.isNull) {
    restoredShape.delete()

    throw new Error(
      'The recovered CAD model is empty.',
    )
  }

  const body = registerBodyAfterMeshing(
    project.bodyId,
    project.fileName,
    restoredShape,
  )
  const primitive = project.primitive
    ? validateCadPrimitive(project.primitive)
    : undefined
  if (primitive) bodyPrimitives.set(project.bodyId, primitive)
  const featureModel = project.featureModel
    ? validateCadFeatureModel(project.featureModel)
    : undefined
  if (featureModel) bodyFeatureModels.set(project.bodyId, featureModel)
  return { ...body, ...(primitive ? { primitive } : {}), ...(featureModel ? { featureModel } : {}) }
}

function disposeBody(
  bodyId: string,
): DisposedBodyData {
  const shape = bodies.get(bodyId)

  try {
    shape?.delete()
  } finally {
    bodies.delete(bodyId)
    bodyFileNames.delete(bodyId)
    bodyPrimitives.delete(bodyId)
    bodyFeatureModels.delete(bodyId)
  }

  return {
    disposedBodyId: bodyId,
  }
}

function makePrimitiveShape(primitiveInput: CadPrimitive): CadShape {
  const primitive = validateCadPrimitive(primitiveInput)
  if (primitive.type === 'box') {
    return makeBox(
      [-primitive.width / 2, -primitive.depth / 2, 0],
      [primitive.width / 2, primitive.depth / 2, primitive.height],
    )
  }
  if (primitive.type === 'cylinder') {
    return makeCylinder(primitive.radius, primitive.height)
  }
  if (primitive.type === 'sphere') {
    return makeSphere(primitive.radius)
  }
  const sketch = drawCircle(primitive.baseRadius).sketchOnPlane('XY')
  return sketch.extrude(primitive.height, {
    extrusionProfile: {
      profile: 'linear',
      endFactor: primitive.topRadius / primitive.baseRadius,
    },
  }) as CadShape
}

async function createPrimitive(primitiveInput: CadPrimitive): Promise<ImportedBodyData> {
  const primitive = validateCadPrimitive(primitiveInput)
  await initializeCadKernel()
  const bodyId = crypto.randomUUID()
  const body = registerBodyAfterMeshing(
    bodyId,
    getPrimitiveFileName(primitive),
    makePrimitiveShape(primitive),
  )
  bodyPrimitives.set(bodyId, primitive)
  return { ...body, primitive }
}

async function updatePrimitive(
  bodyId: string,
  primitiveInput: CadPrimitive,
): Promise<ImportedBodyData> {
  getBody(bodyId)
  const primitive = validateCadPrimitive(primitiveInput)
  await initializeCadKernel()
  const replacement = makePrimitiveShape(primitive)
  const fileName = getPrimitiveFileName(primitive)

  try {
    const renderData = createRenderData(bodyId, fileName, replacement)
    const previous = bodies.get(bodyId)
    bodies.set(bodyId, replacement)
    bodyFileNames.set(bodyId, fileName)
    bodyPrimitives.set(bodyId, primitive)
    previous?.delete()
    return { ...renderData, primitive }
  } catch (error) {
    replacement.delete()
    throw error
  }
}

function makeSketchExtrusion(feature: SketchExtrudeFeature): Solid {
  const drawing = feature.profile.type === 'rectangle'
    ? drawRectangle(feature.profile.width, feature.profile.height)
    : feature.profile.type === 'circle'
      ? drawCircle(feature.profile.radius)
      : feature.profile.points.slice(1).reduce((pen, point) => pen.lineTo(point), draw(feature.profile.points[0])).close()
  let sketch
  if (feature.planeAngle) {
    const bases = {
      XY: { normal: [0, 0, 1] as [number, number, number], horizontal: [1, 0, 0] as [number, number, number], vertical: [0, 1, 0] as [number, number, number] },
      XZ: { normal: [0, -1, 0] as [number, number, number], horizontal: [1, 0, 0] as [number, number, number], vertical: [0, 0, 1] as [number, number, number] },
      YZ: { normal: [1, 0, 0] as [number, number, number], horizontal: [0, 1, 0] as [number, number, number], vertical: [0, 0, 1] as [number, number, number] },
    }
    const base = bases[feature.plane]
    const axis = base[feature.planeAngleAxis ?? 'horizontal']
    const radians = feature.planeAngle * Math.PI / 180
    const dot = axis[0] * base.normal[0] + axis[1] * base.normal[1] + axis[2] * base.normal[2]
    const cross = [axis[1] * base.normal[2] - axis[2] * base.normal[1], axis[2] * base.normal[0] - axis[0] * base.normal[2], axis[0] * base.normal[1] - axis[1] * base.normal[0]]
    const normal = base.normal.map((value, index) => value * Math.cos(radians) + cross[index] * Math.sin(radians) + axis[index] * dot * (1 - Math.cos(radians))) as [number, number, number]
    const origin = base.normal.map((value) => value * (feature.planeOffset ?? 0)) as [number, number, number]
    const customPlane = new Plane(origin, axis, normal)
    sketch = drawing.sketchOnPlane(customPlane)
    customPlane.delete()
  } else sketch = drawing.sketchOnPlane(feature.plane, feature.planeOffset ?? 0)
  return sketch.extrude(feature.reversed ? -feature.length : feature.length) as Solid
}

function makeFeatureModelShape(featureModelInput: CadFeatureModel): CadShape {
  const featureModel = validateCadFeatureModel(featureModelInput)
  let result: Solid | null = null
  try {
    for (const feature of featureModel.features) {
      const tool = makeSketchExtrusion(feature)
      if (!result) {
        result = tool
        continue
      }
      const previous: Solid = result
      try {
        result = feature.operation === 'boss' ? previous.fuse(tool) : previous.cut(tool)
      } finally {
        previous.delete()
        tool.delete()
      }
    }
    if (!result || result.isNull) throw new Error('The feature history produced an empty solid.')
    return result
  } catch (error) {
    result?.delete()
    throw error
  }
}

async function createFeatureModel(featureModelInput: CadFeatureModel): Promise<ImportedBodyData> {
  const featureModel = validateCadFeatureModel(featureModelInput)
  await initializeCadKernel()
  const bodyId = crypto.randomUUID()
  const body = registerBodyAfterMeshing(bodyId, getFeatureModelFileName(featureModel), makeFeatureModelShape(featureModel))
  bodyFeatureModels.set(bodyId, featureModel)
  return { ...body, featureModel }
}

async function updateFeatureModel(bodyId: string, featureModelInput: CadFeatureModel): Promise<ImportedBodyData> {
  getBody(bodyId)
  const featureModel = validateCadFeatureModel(featureModelInput)
  await initializeCadKernel()
  const replacement = makeFeatureModelShape(featureModel)
  const fileName = getFeatureModelFileName(featureModel)
  try {
    const renderData = createRenderData(bodyId, fileName, replacement)
    const previous = bodies.get(bodyId)
    bodies.set(bodyId, replacement)
    bodyFileNames.set(bodyId, fileName)
    bodyFeatureModels.set(bodyId, featureModel)
    bodyPrimitives.delete(bodyId)
    previous?.delete()
    return { ...renderData, featureModel }
  } catch (error) {
    replacement.delete()
    throw error
  }
}

async function exportExactCad(
  bodyId: string,
  format: ExactCadExportFormat,
): Promise<ExactCadExportData> {
  const shape = getBody(bodyId)
  const sourceName = bodyFileNames.get(bodyId) ?? 'model.step'
  let blob: Blob

  if (format === 'step') {
    blob = exportSTEP(
      [{ shape, name: sourceName }],
      { unit: 'MM', modelUnit: 'MM' },
    )
    await validateStepExportBlob(blob)
  } else if (format === 'brep') {
    const serializedShape = shape.serialize()
    blob = new Blob([serializedShape], { type: 'application/octet-stream' })
    validateExactCadExportSize(blob.size)

    const restoredShape = deserializeShape(serializedShape).asShape3D()
    try {
      if (restoredShape.isNull) {
        throw new Error('The generated BREP file does not contain valid exact geometry.')
      }
    } finally {
      restoredShape.delete()
    }
  } else {
    throw new Error('The requested exact CAD format is not supported.')
  }

  validateExactCadExportSize(blob.size)
  return {
    bodyId,
    format,
    blob,
    fileName: getExactCadDownloadName(sourceName, format),
  }
}

function registerBodyAfterMeshing(
  bodyId: string,
  fileName: string,
  shape: CadShape,
): ImportedBodyData {
  if (bodies.has(bodyId)) {
    shape.delete()

    throw new Error(
      'The CAD body ID is already in use.',
    )
  }

  try {
    const renderData = createRenderData(
      bodyId,
      fileName,
      shape,
    )

    bodies.set(bodyId, shape)
    bodyFileNames.set(bodyId, fileName)

    return renderData
  } catch (error) {
    shape.delete()

    throw error
  }
}

async function handleRequest(
  request: WorkerRequest,
): Promise<WorkerData> {
  switch (request.action) {
    case 'importStep':
      return importStepFile(
        request.file,
      )

    case 'serializeProject':
      return serializeProject(
        request.bodyId,
      )

    case 'restoreProject':
      return restoreProject(
        request.project,
      )

    case 'createPrimitive':
      return createPrimitive(request.primitive)

    case 'updatePrimitive':
      return updatePrimitive(request.bodyId, request.primitive)

    case 'createFeatureModel':
      return createFeatureModel(request.featureModel)

    case 'updateFeatureModel':
      return updateFeatureModel(request.bodyId, request.featureModel)

    case 'exportExactCad':
      return exportExactCad(request.bodyId, request.format)

    case 'disposeBody':
      return disposeBody(
        request.bodyId,
      )

    default:
      throw new Error(
        'Unsupported CAD worker action.',
      )
  }
}

workerScope.onmessage = (
  event: MessageEvent<WorkerRequest>,
) => {
  const request = event.data

  void enqueueCadOperation(
    async () => {
      try {
        const data =
          await handleRequest(request)

        workerScope.postMessage({
          id: request.id,
          ok: true,
          data,
        })
      } catch (error) {
        workerScope.postMessage({
          id: request.id,
          ok: false,
          error:
            getErrorMessage(error),
        })
      }
    },
  )
}
