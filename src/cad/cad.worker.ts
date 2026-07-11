import opencascadeFactory from 'replicad-opencascadejs/src/replicad_single.js'
import opencascadeWasm from 'replicad-opencascadejs/src/replicad_single.wasm?url'

import {
  importSTEP,
  setOC,
} from 'replicad'

type CadShape = Awaited<ReturnType<typeof importSTEP>>

interface OpenCascadeFactoryOptions {
  locateFile?: (fileName: string) => string
}

type OpenCascadeFactory = (
  options?: OpenCascadeFactoryOptions,
) => Promise<Parameters<typeof setOC>[0]>

interface ImportStepRequest {
  id: string
  action: 'importStep'
  file: File
}

type WorkerRequest = ImportStepRequest

interface ImportedBodyData {
  bodyId: string
  fileName: string
  faces: ReturnType<CadShape['mesh']>
  edges: ReturnType<CadShape['meshEdges']>
}

interface WorkerSuccess {
  id: string
  ok: true
  data: ImportedBodyData
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

const bodies = new Map<string, CadShape>()

let initializationPromise: Promise<void> | null = null

function initializeCadKernel(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const createOpenCascade =
        opencascadeFactory as unknown as OpenCascadeFactory

      const openCascade = await createOpenCascade({
        locateFile: (fileName) => {
          if (fileName.endsWith('.wasm')) {
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'The CAD operation failed for an unknown reason.'
}

function getFileExtension(fileName: string): string {
  return (
    fileName
      .split('.')
      .pop()
      ?.trim()
      .toLowerCase() ?? ''
  )
}

async function importStepFile(
  file: File,
): Promise<ImportedBodyData> {
  const extension = getFileExtension(file.name)

  if (extension !== 'step' && extension !== 'stp') {
    throw new Error(
      'The editable CAD importer currently accepts STEP and STP files.',
    )
  }

  if (file.size === 0) {
    throw new Error('The selected CAD file is empty.')
  }

  await initializeCadKernel()

  const shape = await importSTEP(file)
  const bodyId = crypto.randomUUID()

  /*
   * Keep the editable B-Rep inside the worker.
   * Measurement, section cuts, fillets, chamfers,
   * undo and recovery will operate on this shape.
   */
  bodies.set(bodyId, shape)

  return {
    bodyId,
    fileName: file.name,

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

async function handleRequest(
  request: WorkerRequest,
): Promise<ImportedBodyData> {
  switch (request.action) {
    case 'importStep':
      return importStepFile(request.file)

    default:
      throw new Error('Unsupported CAD worker action.')
  }
}

workerScope.onmessage = async (
  event: MessageEvent<WorkerRequest>,
) => {
  const request = event.data

  try {
    const data = await handleRequest(request)

    workerScope.postMessage({
      id: request.id,
      ok: true,
      data,
    })
  } catch (error) {
    workerScope.postMessage({
      id: request.id,
      ok: false,
      error: getErrorMessage(error),
    })
  }
}