import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import './App.css'

import {
  importStepFile,
  restoreCadProject,
  serializeCadProject,
  type ImportedCadBody,
} from './cad/cadClient'

import {
  getLatestRecovery,
  requestPersistentStorage,
  saveRecovery,
  type CadRecoveryRecord,
} from './storage/recoveryStore'

import {
  CadViewport,
  type ViewCommand,
  type ViewCommandType,
} from './viewer/CadViewport'

import {
  DisplayPanel,
  defaultDisplaySettings,
  type DisplaySettings,
} from './viewer/DisplayPanel'

type WorkspaceTool =
  | 'view'
  | 'measure'
  | 'section'
  | 'modify'
  | 'export'

const AUTOSAVE_INTERVAL =
  5 * 60 * 1000

const tools: Array<{
  id: WorkspaceTool
  label: string
  description: string
}> = [
  {
    id: 'view',
    label: 'View',
    description:
      'Orbit, pan, zoom and inspect the model',
  },
  {
    id: 'measure',
    label: 'Measure',
    description:
      'Measure vertices, edges, faces and angles',
  },
  {
    id: 'section',
    label: 'Section',
    description:
      'Preview or permanently cut the model',
  },
  {
    id: 'modify',
    label: 'Modify',
    description:
      'Fillet, chamfer and edit selected geometry',
  },
  {
    id: 'export',
    label: 'Export',
    description:
      'Save the project or export a CAD file',
  },
]

function getExtension(
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

function formatRecoveryTime(
  timestamp: number,
): string {
  return new Date(
    timestamp,
  ).toLocaleString()
}

function App() {
  const fileInputRef =
    useRef<HTMLInputElement>(null)

  const commandIdRef =
    useRef(0)

  const recoverySaveInProgressRef =
    useRef(false)

  const [activeTool, setActiveTool] =
    useState<WorkspaceTool>('view')

  const [fileName, setFileName] =
    useState<string | null>(null)

  const [model, setModel] =
    useState<ImportedCadBody | null>(
      null,
    )

  const [isLoading, setIsLoading] =
    useState(false)

  const [
    isSavingRecovery,
    setIsSavingRecovery,
  ] = useState(false)

  const [status, setStatus] =
    useState('Ready')

  const [error, setError] =
    useState<string | null>(null)

  const [
    displaySettings,
    setDisplaySettings,
  ] =
    useState<DisplaySettings>(
      defaultDisplaySettings,
    )

  const [
    showVisualSettings,
    setShowVisualSettings,
  ] = useState(false)

  const [
    viewCommand,
    setViewCommand,
  ] =
    useState<ViewCommand | null>(
      null,
    )

  const [
    latestRecovery,
    setLatestRecovery,
  ] =
    useState<CadRecoveryRecord | null>(
      null,
    )

  const [
    lastRecoverySavedAt,
    setLastRecoverySavedAt,
  ] =
    useState<number | null>(null)

  const [
    storageIsPersistent,
    setStorageIsPersistent,
  ] =
    useState<boolean | null>(null)

  const selectedTool =
    tools.find(
      (tool) =>
        tool.id === activeTool,
    ) ?? tools[0]

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function sendViewCommand(
    type: ViewCommandType,
  ) {
    commandIdRef.current += 1

    setViewCommand({
      id: commandIdRef.current,
      type,
    })
  }

  const refreshLatestRecovery =
    useCallback(async () => {
      try {
        const recovery =
          await getLatestRecovery()

        setLatestRecovery(
          recovery ?? null,
        )
      } catch {
        setLatestRecovery(null)
      }
    }, [])

  useEffect(() => {
    void (async () => {
      const isPersistent =
        await requestPersistentStorage()

      setStorageIsPersistent(
        isPersistent,
      )

      await refreshLatestRecovery()
    })()
  }, [refreshLatestRecovery])

  const saveCurrentRecovery =
    useCallback(async () => {
      if (
        !model ||
        recoverySaveInProgressRef.current
      ) {
        return
      }

      recoverySaveInProgressRef.current =
        true

      setIsSavingRecovery(true)

      try {
        const project =
          await serializeCadProject(
            model.bodyId,
          )

        const recovery =
          await saveRecovery(
            project,
            displaySettings,
          )

        setLatestRecovery(recovery)

        setLastRecoverySavedAt(
          recovery.updatedAt,
        )

        setStatus(
          `Recovery saved locally at ${new Date(
            recovery.updatedAt,
          ).toLocaleTimeString()}`,
        )
      } catch (
        caughtError
      ) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Local recovery could not be saved.'

        setError(message)

        setStatus(
          'Recovery save failed',
        )
      } finally {
        recoverySaveInProgressRef.current =
          false

        setIsSavingRecovery(false)
      }
    }, [
      displaySettings,
      model,
    ])

  useEffect(() => {
    if (!model) {
      return
    }

    const autosaveTimer =
      window.setInterval(() => {
        void saveCurrentRecovery()
      }, AUTOSAVE_INTERVAL)

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        'hidden'
      ) {
        void saveCurrentRecovery()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      window.clearInterval(
        autosaveTimer,
      )

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [
    model,
    saveCurrentRecovery,
  ])

  async function saveImportedModelRecovery(
    importedModel: ImportedCadBody,
  ): Promise<void> {
    try {
      const project =
        await serializeCadProject(
          importedModel.bodyId,
        )

      const recovery =
        await saveRecovery(
          project,
          displaySettings,
        )

      setLatestRecovery(recovery)

      setLastRecoverySavedAt(
        recovery.updatedAt,
      )
    } catch (
      caughtError
    ) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'The initial recovery could not be saved.'

      setError(message)
    }
  }

  async function handleFile(
    file: File | undefined,
  ): Promise<void> {
    if (!file) {
      return
    }

    const extension =
      getExtension(file.name)

    if (
      extension !== 'step' &&
      extension !== 'stp'
    ) {
      setError(
        'This editable version currently supports STEP and STP files.',
      )

      setStatus(
        'Unsupported file format',
      )

      return
    }

    setIsLoading(true)
    setError(null)

    setStatus(
      `Importing ${file.name} locally…`,
    )

    try {
      const importedModel =
        await importStepFile(file)

      setModel(importedModel)

      setFileName(
        importedModel.fileName,
      )

      setStatus(
        `${importedModel.fileName} loaded successfully`,
      )

      await saveImportedModelRecovery(
        importedModel,
      )

      window.setTimeout(() => {
        sendViewCommand('fit')
      }, 100)
    } catch (
      caughtError
    ) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'The STEP file could not be imported.'

      setError(message)

      setStatus('Import failed')
    } finally {
      setIsLoading(false)
    }
  }

  async function recoverLatestProject():
    Promise<void> {
    if (!latestRecovery) {
      return
    }

    setIsLoading(true)
    setError(null)

    setStatus(
      `Recovering ${latestRecovery.project.fileName}…`,
    )

    try {
      const recoveredModel =
        await restoreCadProject(
          latestRecovery.project,
        )

      setModel(recoveredModel)

      setFileName(
        recoveredModel.fileName,
      )

      setDisplaySettings({
        ...latestRecovery
          .displaySettings,
      })

      setLastRecoverySavedAt(
        latestRecovery.updatedAt,
      )

      setStatus(
        `${recoveredModel.fileName} recovered locally`,
      )

      window.setTimeout(() => {
        sendViewCommand('fit')
      }, 100)
    } catch (
      caughtError
    ) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'The local project could not be recovered.'

      setError(message)

      setStatus(
        'Recovery failed',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function getRecoveryStatus():
    string {
    if (isSavingRecovery) {
      return 'Saving local recovery…'
    }

    if (lastRecoverySavedAt) {
      return `Recovery saved ${formatRecoveryTime(
        lastRecoverySavedAt,
      )}`
    }

    if (model) {
      return 'Recovery save pending'
    }

    if (latestRecovery) {
      return `Recovery available from ${formatRecoveryTime(
        latestRecovery.updatedAt,
      )}`
    }

    return 'No local recovery yet'
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            C
          </span>

          <div>
            <strong>
              CAD File Labs
            </strong>

            <span>
              Local-first CAD workspace
            </span>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="privacy-badge">
            Files stay on this device
          </span>

          <button
            className="primary-button"
            type="button"
            disabled={isLoading}
            onClick={openFilePicker}
          >
            {isLoading
              ? 'Working…'
              : 'Open STEP file'}
          </button>

          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".step,.stp"
            onChange={(event) => {
              const file =
                event.target.files?.[0]

              event.target.value = ''

              void handleFile(file)
            }}
          />
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <p>
              Workspace
            </p>

            <h1>
              View, measure and modify
              3D CAD files online
            </h1>
          </div>

          <nav
            className="tool-navigation"
            aria-label="CAD workspace tools"
          >
            {tools.map(
              (tool) => (
                <button
                  key={tool.id}
                  className={
                    activeTool ===
                    tool.id
                      ? 'tool-button active'
                      : 'tool-button'
                  }
                  type="button"
                  onClick={() => {
                    setActiveTool(
                      tool.id,
                    )
                  }}
                >
                  <strong>
                    {tool.label}
                  </strong>

                  <span>
                    {
                      tool.description
                    }
                  </span>
                </button>
              ),
            )}
          </nav>

          <section className="project-panel">
            <div>
              <span className="panel-label">
                Current project
              </span>

              <strong>
                {fileName ??
                  'No file opened'}
              </strong>
            </div>

            <span className="autosave-status">
              {getRecoveryStatus()}
            </span>

            <span className="autosave-status">
              {storageIsPersistent ===
              true
                ? 'Protected browser storage enabled'
                : 'Stored locally in this browser'}
            </span>

            {model && (
              <button
                type="button"
                className="secondary-button"
                disabled={
                  isSavingRecovery
                }
                onClick={() => {
                  void saveCurrentRecovery()
                }}
              >
                Save recovery now
              </button>
            )}

            {!model &&
              latestRecovery && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    isLoading
                  }
                  onClick={() => {
                    void recoverLatestProject()
                  }}
                >
                  Recover{' '}
                  {
                    latestRecovery
                      .project.fileName
                  }
                </button>
              )}

            {error && (
              <span
                className="project-error"
                role="alert"
              >
                {error}
              </span>
            )}
          </section>
        </aside>

        <section className="viewer-panel">
          <div className="viewer-toolbar">
            <div>
              <strong>
                {selectedTool.label}
              </strong>

              <span>
                {
                  selectedTool.description
                }
              </span>
            </div>

            <div className="viewer-actions">
              <button
                type="button"
                className={
                  showVisualSettings
                    ? 'toolbar-button active'
                    : 'toolbar-button'
                }
                onClick={() => {
                  setShowVisualSettings(
                    (current) =>
                      !current,
                  )
                }}
              >
                Visual settings
              </button>

              <button
                type="button"
                className="toolbar-button"
                onClick={() => {
                  sendViewCommand(
                    'fit',
                  )
                }}
              >
                Fit
              </button>

              <button
                type="button"
                disabled
              >
                Undo
              </button>

              <button
                type="button"
                disabled
              >
                Redo
              </button>
            </div>
          </div>

          <div
            className="viewport-placeholder"
            onDragOver={(event) => {
              event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()

              void handleFile(
                event.dataTransfer
                  .files?.[0],
              )
            }}
          >
            <CadViewport
              model={model}
              settings={
                displaySettings
              }
              viewCommand={
                viewCommand
              }
            />

            <div className="viewer-hint">
              <strong>
                {isLoading
                  ? 'Processing CAD model…'
                  : fileName ??
                    'Test model'}
              </strong>

              <span>
                Drag to orbit · Scroll
                to zoom · Right-drag
                to pan
              </span>
            </div>

            {showVisualSettings && (
              <div className="display-panel-overlay">
                <DisplayPanel
                  settings={
                    displaySettings
                  }
                  onChange={
                    setDisplaySettings
                  }
                  onFitView={() => {
                    sendViewCommand(
                      'fit',
                    )
                  }}
                  onResetView={() => {
                    sendViewCommand(
                      'isometric',
                    )
                  }}
                />
              </div>
            )}
          </div>

          <footer className="statusbar">
            <span>
              {status}
            </span>

            <span>
              Local processing
            </span>

            <span>
              Autosave every 5 minutes
            </span>
          </footer>
        </section>
      </section>
    </main>
  )
}

export default App