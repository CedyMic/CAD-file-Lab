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
  faces: CadFaceMesh
  edges: CadEdgeMesh
}

interface ImportStepRequest {
  id: string
  action: 'importStep'
  file: File
}

interface WorkerSuccess {
  id: string
  ok: true
  data: ImportedCadBody
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
  resolve: (data: ImportedCadBody) => void
  reject: (error: Error) => void
}

const worker = new Worker(
  new URL('./cad.worker.ts', import.meta.url),
  {
    type: 'module',
  },
)

const pendingRequests = new Map<string, PendingRequest>()

worker.addEventListener(
  'message',
  (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const pending = pendingRequests.get(response.id)

    if (!pending) {
      return
    }

    pendingRequests.delete(response.id)

    if (response.ok) {
      pending.resolve(response.data)
    } else {
      pending.reject(new Error(response.error))
    }
  },
)

worker.addEventListener('error', (event) => {
  const error = new Error(
    event.message || 'The CAD worker stopped unexpectedly.',
  )

  for (const pending of pendingRequests.values()) {
    pending.reject(error)
  }

  pendingRequests.clear()
})

export function importStepFile(
  file: File,
): Promise<ImportedCadBody> {
  const id = crypto.randomUUID()

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      resolve,
      reject,
    })

    const request: ImportStepRequest = {
      id,
      action: 'importStep',
      file,
    }

    worker.postMessage(request)
  })
}