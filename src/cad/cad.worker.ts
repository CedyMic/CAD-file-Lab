import opencascadeFactory from
  'replicad-opencascadejs/src/replicad_single.js'

import opencascadeWasm from
  'replicad-opencascadejs/src/replicad_single.wasm?url'

import {
  deserializeShape,
  importSTEP,
  setOC,
} from 'replicad'

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

type WorkerRequest =
  | ImportStepRequest
  | SerializeProjectRequest
  | RestoreProjectRequest

interface ImportedBodyData {
  bodyId: string
  fileName: string

  faces: ReturnType<CadShape['mesh']>

  edges: ReturnType<CadShape['meshEdges']>
}

type WorkerData =
  | ImportedBodyData
  | SerializedCadProject

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

let initializationPromise:
  Promise<void> | null = null

function initializeCadKernel(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const createOpenCascade =
        opencascadeFactory as unknown as
          OpenCascadeFactory

      const openCascade =
        await createOpenCascade({
          locateFile: (fileName) => {
            if (
              fileName.endsWith('.wasm')
            ) {
              return opencascadeWasm
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

function getFileExtension(
  fileName: string,
): string {
  return (
    fileName
      .split('.')
      .pop()
      ?.trim()
      .toLowerCase() ?? ''
  )
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
  return {
    bodyId,
    fileName,

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

async function importStepFile(
  file: File,
): Promise<ImportedBodyData> {
  const extension =
    getFileExtension(file.name)

  if (
    extension !== 'step' &&
    extension !== 'stp'
  ) {
    throw new Error(
      'The editable CAD importer currently accepts STEP and STP files.',
    )
  }

  if (file.size === 0) {
    throw new Error(
      'The selected CAD file is empty.',
    )
  }

  await initializeCadKernel()

  const shape =
    await importSTEP(file)

  const bodyId =
    crypto.randomUUID()

  bodies.set(bodyId, shape)
  bodyFileNames.set(
    bodyId,
    file.name,
  )

  return createRenderData(
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

  const existingShape =
    bodies.get(project.bodyId)

  if (existingShape) {
    existingShape.delete()
  }

  bodies.set(
    project.bodyId,
    restoredShape,
  )

  bodyFileNames.set(
    project.bodyId,
    project.fileName,
  )

  return createRenderData(
    project.bodyId,
    project.fileName,
    restoredShape,
  )
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

    default:
      throw new Error(
        'Unsupported CAD worker action.',
      )
  }
}

workerScope.onmessage = async (
  event: MessageEvent<WorkerRequest>,
) => {
  const request = event.data

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
}