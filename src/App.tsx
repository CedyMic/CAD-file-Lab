import { useRef, useState } from 'react'
import './App.css'

import {
  importStepFile,
  type ImportedCadBody,
} from './cad/cadClient'

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

const tools: Array<{
  id: WorkspaceTool
  label: string
  description: string
}> = [
  {
    id: 'view',
    label: 'View',
    description: 'Orbit, pan, zoom and inspect the model',
  },
  {
    id: 'measure',
    label: 'Measure',
    description: 'Measure vertices, edges, faces and angles',
  },
  {
    id: 'section',
    label: 'Section',
    description: 'Preview or permanently cut the model',
  },
  {
    id: 'modify',
    label: 'Modify',
    description: 'Fillet, chamfer and edit selected geometry',
  },
  {
    id: 'export',
    label: 'Export',
    description: 'Save the project or export a CAD file',
  },
]

function getExtension(fileName: string): string {
  return (
    fileName
      .split('.')
      .pop()
      ?.trim()
      .toLowerCase() ?? ''
  )
}

function App() {
  const fileInputRef =
    useRef<HTMLInputElement>(null)

  const commandIdRef = useRef(0)

  const [activeTool, setActiveTool] =
    useState<WorkspaceTool>('view')

  const [fileName, setFileName] =
    useState<string | null>(null)

  const [model, setModel] =
    useState<ImportedCadBody | null>(null)

  const [isLoading, setIsLoading] =
    useState(false)

  const [status, setStatus] =
    useState('Ready')

  const [error, setError] =
    useState<string | null>(null)

  const [displaySettings, setDisplaySettings] =
    useState<DisplaySettings>(
      defaultDisplaySettings,
    )

  const [
    showVisualSettings,
    setShowVisualSettings,
  ] = useState(false)

  const [viewCommand, setViewCommand] =
    useState<ViewCommand | null>(null)

  const selectedTool =
    tools.find(
      (tool) => tool.id === activeTool,
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

      setStatus('Unsupported file format')
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
      setFileName(file.name)
      setStatus(
        `${file.name} loaded successfully`,
      )

      window.setTimeout(() => {
        sendViewCommand('fit')
      }, 100)
    } catch (caughtError) {
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
              ? 'Importing…'
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
            {tools.map((tool) => (
              <button
                key={tool.id}
                className={
                  activeTool === tool.id
                    ? 'tool-button active'
                    : 'tool-button'
                }
                type="button"
                onClick={() => {
                  setActiveTool(tool.id)
                }}
              >
                <strong>
                  {tool.label}
                </strong>

                <span>
                  {tool.description}
                </span>
              </button>
            ))}
          </nav>

          <section className="project-panel">
            <div>
              <span className="panel-label">
                Current project
              </span>

              <strong>
                {fileName ?? 'No file opened'}
              </strong>
            </div>

            <span className="autosave-status">
              Recovery autosave will be added next
            </span>

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
                {selectedTool.description}
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
                    (current) => !current,
                  )
                }}
              >
                Visual settings
              </button>

              <button
                type="button"
                className="toolbar-button"
                onClick={() => {
                  sendViewCommand('fit')
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
                event.dataTransfer.files?.[0],
              )
            }}
          >
            <CadViewport
              model={model}
              settings={displaySettings}
              viewCommand={viewCommand}
            />

            <div className="viewer-hint">
              <strong>
                {isLoading
                  ? 'Importing STEP model…'
                  : fileName ?? 'Test model'}
              </strong>

              <span>
                Drag to orbit · Scroll to zoom ·
                Right-drag to pan
              </span>
            </div>

            {showVisualSettings && (
              <div className="display-panel-overlay">
                <DisplayPanel
                  settings={displaySettings}
                  onChange={setDisplaySettings}
                  onFitView={() => {
                    sendViewCommand('fit')
                  }}
                  onResetView={() => {
                    sendViewCommand('isometric')
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
              No cloud upload
            </span>
          </footer>
        </section>
      </section>
    </main>
  )
}

export default App