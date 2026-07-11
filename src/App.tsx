import { useRef, useState } from 'react'
import './App.css'
import { CadViewport } from './viewer/CadViewport'

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

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTool, setActiveTool] =
    useState<WorkspaceTool>('view')

  const [fileName, setFileName] = useState<string | null>(null)

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function handleFile(file: File | undefined) {
    if (!file) {
      return
    }

    setFileName(file.name)
  }

  const selectedTool =
    tools.find((tool) => tool.id === activeTool) ?? tools[0]

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">C</span>

          <div>
            <strong>CAD File Labs</strong>
            <span>Local-first CAD workspace</span>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="privacy-badge">
            Files stay on this device
          </span>

          <button
            className="primary-button"
            type="button"
            onClick={openFilePicker}
          >
            Open CAD file
          </button>

          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".step,.stp,.iges,.igs,.brep,.stl,.obj,.ply,.3mf,.gltf,.glb"
            onChange={(event) => {
              handleFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <p>Workspace</p>

            <h1>
              View, measure and modify 3D CAD files online
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
                onClick={() => setActiveTool(tool.id)}
              >
                <strong>{tool.label}</strong>
                <span>{tool.description}</span>
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
              Recovery autosave will appear here
            </span>
          </section>
        </aside>

        <section className="viewer-panel">
          <div className="viewer-toolbar">
            <div>
              <strong>{selectedTool.label}</strong>
              <span>{selectedTool.description}</span>
            </div>

            <div className="viewer-actions">
              <button type="button" disabled>
                Undo
              </button>

              <button type="button" disabled>
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
              handleFile(event.dataTransfer.files?.[0])
            }}
          >
            <CadViewport />

            <div className="viewer-hint">
              <strong>{fileName ?? 'Test model'}</strong>

              <span>
                Drag to orbit · Scroll to zoom · Right-drag to pan
              </span>
            </div>
          </div>

          <footer className="statusbar">
            <span>Ready</span>
            <span>Local processing</span>
            <span>No cloud upload</span>
          </footer>
        </section>
      </section>
    </main>
  )
}

export default App