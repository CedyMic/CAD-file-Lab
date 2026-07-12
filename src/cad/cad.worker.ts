import opencascadeFactory from
  'replicad-opencascadejs/src/replicad_single.js'

import opencascadeWasm from
  'replicad-opencascadejs/src/replicad_single.wasm?url'

import { DOMParser as XmlDomParser } from '@xmldom/xmldom'

import {
  deserializeShape,
  importSTEP,
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

type WorkerRequest =
  | ImportStepRequest
  | SerializeProjectRequest
  | RestoreProjectRequest
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
}

interface DisposedBodyData {
  disposedBodyId: string
}

type WorkerData =
  | ImportedBodyData
  | SerializedCadProject
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

  return registerBodyAfterMeshing(
    project.bodyId,
    project.fileName,
    restoredShape,
  )
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
  }

  return {
    disposedBodyId: bodyId,
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
