export interface CadFaceMesh {
  vertices: number[] | Float32Array
  normals: number[] | Float32Array
  triangles: number[] | Uint32Array
  faceGroups?: unknown[]
}

export interface CadEdgeMesh {
  lines: number[] | Float32Array
  edgeGroups?: unknown[]
}

export interface ImportedCadBody {
  bodyId: string
  fileName: string
  editable: boolean
  bodySummaries: Array<{
    id: string
    name: string
  }>
  faces: CadFaceMesh
  edges: CadEdgeMesh
}

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

interface DisposedCadBody {
  disposedBodyId: string
}

type WorkerData =
  | ImportedCadBody
  | SerializedCadProject
  | DisposedCadBody

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

interface PendingRequest {
  resolve: (data: WorkerData) => void
  reject: (error: Error) => void
}

const worker = new Worker(
  new URL(
    './cad.worker.ts',
    import.meta.url,
  ),
  {
    type: 'module',
  },
)

const pendingRequests =
  new Map<string, PendingRequest>()

function isImportedCadBody(
  data: WorkerData,
): data is ImportedCadBody {
  return (
    'faces' in data &&
    'edges' in data &&
    'bodySummaries' in data &&
    Array.isArray(data.bodySummaries) &&
    typeof data.editable === 'boolean' &&
    typeof data.bodyId === 'string'
  )
}

function isSerializedCadProject(
  data: WorkerData,
): data is SerializedCadProject {
  return (
    'serializedShape' in data &&
    data.version === 1 &&
    typeof data.bodyId === 'string'
  )
}

function isDisposedCadBody(
  data: WorkerData,
): data is DisposedCadBody {
  return (
    'disposedBodyId' in data &&
    typeof data.disposedBodyId === 'string'
  )
}

worker.addEventListener(
  'message',
  (
    event: MessageEvent<WorkerResponse>,
  ) => {
    const response = event.data

    const pending =
      pendingRequests.get(response.id)

    if (!pending) {
      return
    }

    pendingRequests.delete(response.id)

    if (response.ok) {
      pending.resolve(response.data)
    } else {
      pending.reject(
        new Error(response.error),
      )
    }
  },
)

worker.addEventListener(
  'error',
  (event) => {
    const error = new Error(
      event.message ||
        'The CAD worker stopped unexpectedly.',
    )

    for (
      const pending
      of pendingRequests.values()
    ) {
      pending.reject(error)
    }

    pendingRequests.clear()
  },
)

function sendRequest(
  request: WorkerRequest,
): Promise<WorkerData> {
  return new Promise(
    (resolve, reject) => {
      pendingRequests.set(
        request.id,
        {
          resolve,
          reject,
        },
      )

      worker.postMessage(request)
    },
  )
}

export async function importStepFile(
  file: File,
): Promise<ImportedCadBody> {
  const response =
    await sendRequest({
      id: crypto.randomUUID(),
      action: 'importStep',
      file,
    })

  if (!isImportedCadBody(response)) {
    throw new Error(
      'The CAD worker returned invalid model data.',
    )
  }

  return response
}

export async function serializeCadProject(
  bodyId: string,
): Promise<SerializedCadProject> {
  const response =
    await sendRequest({
      id: crypto.randomUUID(),
      action: 'serializeProject',
      bodyId,
    })

  if (
    !isSerializedCadProject(response)
  ) {
    throw new Error(
      'The CAD worker returned invalid project data.',
    )
  }

  return response
}

export async function restoreCadProject(
  project: SerializedCadProject,
): Promise<ImportedCadBody> {
  const response =
    await sendRequest({
      id: crypto.randomUUID(),
      action: 'restoreProject',
      project,
    })

  if (!isImportedCadBody(response)) {
    throw new Error(
      'The CAD worker could not restore the project.',
    )
  }

  return response
}

export async function disposeCadBody(
  bodyId: string,
): Promise<void> {
  const response =
    await sendRequest({
      id: crypto.randomUUID(),
      action: 'disposeBody',
      bodyId,
    })

  if (
    !isDisposedCadBody(response) ||
    response.disposedBodyId !== bodyId
  ) {
    throw new Error(
      'The CAD worker could not release the model.',
    )
  }
}
