import opencascadeFactory from
  'replicad-opencascadejs/src/replicad_single.js'

import opencascadeWasm from
  'replicad-opencascadejs/src/replicad_single.wasm?url'

import {
  deserializeShape,
  importSTEP,
  setOC,
} from 'replicad'

import { EdgesGeometry } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

import {
  validateStepImportFile,
} from './stepImportFile'

import {
  createAsyncOperationQueue,
} from '../storage/operationQueue'

type CadShape =
  Awaited<ReturnType<typeof importSTEP>>

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

  return {
    bodyId,
    fileName,
    editable: true,
    bodySummaries: Array.from(
      { length: bodyCount },
      (_, index) => ({
        id: `${bodyId}-body-${index + 1}`,
        name: bodyCount === 1
          ? 'Body 1'
          : `Body ${index + 1}`,
      }),
    ),

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

async function importStlFile(
  file: File,
): Promise<ImportedBodyData> {
  const geometry = new STLLoader().parse(await file.arrayBuffer())

  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals()
  }

  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.getIndex()
  const edgeGeometry = new EdgesGeometry(geometry, 15)
  const edgePosition = edgeGeometry.getAttribute('position')
  const bodyId = crypto.randomUUID()

  if (position.count === 0) {
    geometry.dispose()
    edgeGeometry.dispose()
    throw new Error('The selected STL file contains no triangles.')
  }

  const renderData: ImportedBodyData = {
    bodyId,
    fileName: file.name,
    editable: false,
    bodySummaries: [{ id: `${bodyId}-body-1`, name: 'Mesh 1' }],
    faces: {
      vertices: Array.from(position.array),
      normals: Array.from(normal.array),
      triangles: index
        ? Array.from(index.array)
        : Array.from({ length: position.count }, (_, triangleIndex) => triangleIndex),
      faceGroups: [],
    },
    edges: {
      lines: Array.from(edgePosition.array),
      edgeGroups: [],
    },
  }

  geometry.dispose()
  edgeGeometry.dispose()
  return renderData
}

async function importStepFile(
  file: File,
): Promise<ImportedBodyData> {
  validateStepImportFile(file)

  if (file.name.toLowerCase().endsWith('.stl')) {
    return importStlFile(file)
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
