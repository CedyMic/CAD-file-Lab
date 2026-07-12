import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import './App.css'

import { LandingPage } from './marketing/LandingPage'

import {
  disposeCadBody,
  importStepFile,
  restoreCadProject,
  serializeCadProject,
  type ImportedCadBody,
} from './cad/cadClient'

import {
  CAD_LAB_PROJECT_EXTENSION,
  MAX_CAD_LAB_PROJECT_BYTES,
  createCadLabProjectFile,
  getCadLabDownloadName,
  parseCadLabProjectFile,
} from './cad/projectFile'

import {
  validateStepImportFile,
} from './cad/stepImportFile'

import {
  clearRecoveries,
  getLatestRecovery,
  requestPersistentStorage,
  saveRecovery,
  type CadRecoveryRecord,
} from './storage/recoveryStore'

import {
  createAsyncOperationQueue,
} from './storage/operationQueue'

import {
  CadViewport,
  type ViewCommand,
  type ViewCommandType,
} from './viewer/CadViewport'

import {
  DisplayPanel,
} from './viewer/DisplayPanel'

import {
  defaultDisplaySettings,
  type DisplaySettings,
} from './viewer/displaySettings'

type WorkspaceTool =
  | 'view'
  | 'measure'
  | 'section'
  | 'modify'
  | 'export'

type InformationPanel =
  | 'help'
  | 'feedback'
  | null

const AUTOSAVE_INTERVAL =
  5 * 60 * 1000

const tools: Array<{
  id: WorkspaceTool
  label: string
  description: string
  available: boolean
}> = [
  {
    id: 'view',
    label: 'View',
    description:
      'Orbit, pan, zoom and inspect the model',
    available: true,
  },
  {
    id: 'measure',
    label: 'Measure',
    description:
      'Vertices, edges, faces and angles',
    available: false,
  },
  {
    id: 'modify',
    label: 'Modify',
    description:
      'Fillet, chamfer and edit selected geometry',
    available: false,
  },
  {
    id: 'export',
    label: 'Export',
    description:
      'Export STEP or another CAD format',
    available: false,
  },
]

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

  const projectFileInputRef =
    useRef<HTMLInputElement>(null)

  const commandIdRef =
    useRef(0)

  const recoverySaveInProgressRef =
    useRef(false)

  const recoveryOperationQueueRef =
    useRef(
      createAsyncOperationQueue(),
    )

  const modelLoadInProgressRef =
    useRef(false)

  const informationPanelRef =
    useRef<HTMLElement>(null)

  const informationReturnFocusRef =
    useRef<HTMLElement | null>(null)

  const [activeTool, setActiveTool] =
    useState<WorkspaceTool>('view')

  const [informationPanel, setInformationPanel] =
    useState<InformationPanel>(null)

  const [feedbackCategory, setFeedbackCategory] =
    useState('General feedback')

  const [feedbackMessage, setFeedbackMessage] =
    useState('')

  const [feedbackStatus, setFeedbackStatus] =
    useState<string | null>(null)

  const [localRecoveryEnabled, setLocalRecoveryEnabled] =
    useState(true)

  const [fileName, setFileName] =
    useState<string | null>(null)

  const [model, setModel] =
    useState<ImportedCadBody | null>(
      null,
    )

  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(() => new Set())
  const [hiddenPartIds, setHiddenPartIds] = useState<Set<string>>(() => new Set())
  const [partColors, setPartColors] = useState<Map<string, string>>(() => new Map())
  const [partOpacities, setPartOpacities] = useState<Map<string, number>>(() => new Map())

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

  const selectedParts = model?.renderParts.filter((part) => selectedPartIds.has(part.id)) ?? []
  const selectedPart = selectedParts[0] ?? null

  function installModel(nextModel: ImportedCadBody) {
    setModel(nextModel)
    setSelectedPartIds(new Set(nextModel.renderParts[0] ? [nextModel.renderParts[0].id] : []))
    setHiddenPartIds(new Set())
    setPartColors(new Map())
    setPartOpacities(new Map())
  }

  function togglePartVisibility(partId: string) {
    setHiddenPartIds((current) => {
      const next = new Set(current)
      if (next.has(partId)) next.delete(partId)
      else next.add(partId)
      return next
    })
  }

  function togglePartSelection(partId: string) {
    setSelectedPartIds((current) => {
      const next = new Set(current)
      if (next.has(partId)) next.delete(partId)
      else next.add(partId)
      return next
    })
  }

  function selectAllParts() {
    setSelectedPartIds(new Set(model?.renderParts.map((part) => part.id) ?? []))
  }

  function setSelectedPartsColor(color: string) {
    setPartColors((current) => {
      const next = new Map(current)
      for (const part of selectedParts) next.set(part.id, color)
      return next
    })
  }

  function setSelectedPartsOpacity(opacity: number) {
    setPartOpacities((current) => {
      const next = new Map(current)
      for (const part of selectedParts) next.set(part.id, opacity)
      return next
    })
  }

  function setSelectedPartsVisibility(visible: boolean) {
    setHiddenPartIds((current) => {
      const next = new Set(current)
      for (const part of selectedParts) {
        if (visible) next.delete(part.id)
        else next.add(part.id)
      }
      return next
    })
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function openProjectFilePicker() {
    projectFileInputRef.current?.click()
  }

  function openInformationPanel(
    panel: Exclude<InformationPanel, null>,
  ) {
    informationReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    setInformationPanel(panel)
  }

  const closeInformationPanel =
    useCallback(() => {
      setInformationPanel(null)

      window.setTimeout(() => {
        informationReturnFocusRef.current?.focus()
        informationReturnFocusRef.current = null
      }, 0)
    }, [])

  useEffect(() => {
    if (!informationPanel) {
      return
    }

    const panel = informationPanelRef.current

    const focusableSelector = [
      'button:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      '[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')

    panel
      ?.querySelector<HTMLElement>(focusableSelector)
      ?.focus()

    function handleDialogKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeInformationPanel()
        return
      }

      if (event.key !== 'Tab' || !panel) {
        return
      }

      const focusableElements =
        Array.from(
          panel.querySelectorAll<HTMLElement>(
            focusableSelector,
          ),
        )

      const first = focusableElements[0]
      const last = focusableElements.at(-1)

      if (!first || !last) {
        event.preventDefault()
        return
      }

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener(
      'keydown',
      handleDialogKeyDown,
    )

    return () => {
      document.removeEventListener(
        'keydown',
        handleDialogKeyDown,
      )
    }
  }, [
    closeInformationPanel,
    informationPanel,
  ])

  async function copyFeedback(): Promise<void> {
    const feedback = [
      `Category: ${feedbackCategory}`,
      '',
      feedbackMessage.trim(),
      '',
      `Browser: ${navigator.userAgent}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(feedback)
      setFeedbackStatus('Report copied successfully. Paste it into an email to admin@cadfilelab.com.')
    } catch {
      setFeedbackStatus('Report was not copied. Select your message manually and email it to admin@cadfilelab.com.')
    }
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

  function enqueueRecoveryOperation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    return recoveryOperationQueueRef.current(
      operation,
    )
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
        !model.editable ||
        !localRecoveryEnabled ||
        recoverySaveInProgressRef.current
      ) {
        return
      }

      recoverySaveInProgressRef.current =
        true

      setIsSavingRecovery(true)

      try {
        const recovery =
          await enqueueRecoveryOperation(
            async () => {
              const project =
                await serializeCadProject(
                  model.bodyId,
                )

              return saveRecovery(
                project,
                displaySettings,
              )
            },
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
    localRecoveryEnabled,
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
    recoveryDisplaySettings = displaySettings,
  ): Promise<void> {
    if (!localRecoveryEnabled || !importedModel.editable) {
      return
    }

    try {
      const recovery =
        await enqueueRecoveryOperation(
          async () => {
            const project =
              await serializeCadProject(
                importedModel.bodyId,
              )

            return saveRecovery(
              project,
              recoveryDisplaySettings,
            )
          },
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

  async function clearLocalRecoveryData(): Promise<void> {
    const confirmed = window.confirm(
      'Clear every locally saved CAD recovery from this browser? The open model will remain visible, but autosave will be paused for it.',
    )

    if (!confirmed) {
      return
    }

    setLocalRecoveryEnabled(false)
    setError(null)

    try {
      await enqueueRecoveryOperation(
        clearRecoveries,
      )
      setLatestRecovery(null)
      setLastRecoverySavedAt(null)
      setStatus(
        'Local recovery data cleared; autosave paused',
      )
    } catch (caughtError) {
      setLocalRecoveryEnabled(true)

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Local recovery data could not be cleared.',
      )

      setStatus('Recovery clear failed')
    }
  }

  async function releaseSupersededCadBody(
    previousBodyId: string | undefined,
    currentBodyId: string,
  ): Promise<void> {
    if (
      !previousBodyId ||
      previousBodyId === currentBodyId
    ) {
      return
    }

    try {
      await disposeCadBody(previousBodyId)
    } catch {
      setError(
        'The new model loaded, but memory from the previous model could not be released. Reload this tab before opening more large files.',
      )
    }
  }

  async function handleFile(
    file: File | undefined,
  ): Promise<void> {
    if (!file) {
      return
    }

    if (modelLoadInProgressRef.current) {
      setStatus(
        'Finish the current model operation before opening another file.',
      )
      return
    }

    try {
      validateStepImportFile(file)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The selected CAD file is not valid.',
      )

      setStatus(
        'Unsupported or invalid 3D file',
      )

      return
    }

    modelLoadInProgressRef.current = true
    setIsLoading(true)
    setError(null)

    setStatus(
      `Importing ${file.name} locally…`,
    )

    try {
      const previousBodyId =
        model?.bodyId

      const importedModel =
        await importStepFile(file)

      installModel(importedModel)

      await releaseSupersededCadBody(
        previousBodyId,
        importedModel.bodyId,
      )

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
          : 'The 3D file could not be imported.'

      setError(message)

      setStatus('Import failed')
    } finally {
      modelLoadInProgressRef.current = false
      setIsLoading(false)
    }
  }

  async function saveProjectFile(): Promise<void> {
    if (!model || !model.editable) {
      return
    }

    setIsLoading(true)
    setError(null)
    setStatus('Preparing project file locally…')

    try {
      const project =
        await serializeCadProject(model.bodyId)

      const projectFile =
        createCadLabProjectFile(
          project,
          displaySettings,
        )

      const blob = new Blob(
        [JSON.stringify(projectFile)],
        { type: 'application/json' },
      )

      const downloadUrl =
        URL.createObjectURL(blob)

      const downloadLink =
        document.createElement('a')

      downloadLink.href = downloadUrl
      downloadLink.download =
        getCadLabDownloadName(
          project.fileName,
        )

      downloadLink.click()

      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl)
      }, 0)

      setStatus(
        `${downloadLink.download} saved locally`,
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The project file could not be saved.',
      )

      setStatus('Project save failed')
    } finally {
      setIsLoading(false)
    }
  }

  async function openProjectFile(
    file: File | undefined,
  ): Promise<void> {
    if (!file) {
      return
    }

    if (modelLoadInProgressRef.current) {
      setStatus(
        'Finish the current model operation before opening another project.',
      )
      return
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(CAD_LAB_PROJECT_EXTENSION)
    ) {
      setError(
        `Choose a ${CAD_LAB_PROJECT_EXTENSION} project file.`,
      )
      setStatus('Unsupported project file')
      return
    }

    if (
      file.size === 0 ||
      file.size > MAX_CAD_LAB_PROJECT_BYTES
    ) {
      setError(
        'The project file is empty or exceeds the 512 MB safety limit.',
      )
      setStatus('Invalid project file')
      return
    }

    modelLoadInProgressRef.current = true
    setIsLoading(true)
    setError(null)
    setStatus(`Opening ${file.name} locally…`)

    try {
      const previousBodyId =
        model?.bodyId

      const projectFile =
        parseCadLabProjectFile(
          await file.text(),
        )

      const restoredModel =
        await restoreCadProject({
          ...projectFile.project,
          bodyId: crypto.randomUUID(),
        })

      installModel(restoredModel)

      await releaseSupersededCadBody(
        previousBodyId,
        restoredModel.bodyId,
      )

      setFileName(restoredModel.fileName)
      setDisplaySettings(
        projectFile.displaySettings,
      )
      setStatus(
        `${restoredModel.fileName} opened from project file`,
      )

      await saveImportedModelRecovery(
        restoredModel,
        projectFile.displaySettings,
      )

      window.setTimeout(() => {
        sendViewCommand('fit')
      }, 100)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The project file could not be opened.',
      )

      setStatus('Project open failed')
    } finally {
      modelLoadInProgressRef.current = false
      setIsLoading(false)
    }
  }

  async function recoverLatestProject():
    Promise<void> {
    if (!latestRecovery) {
      return
    }

    if (modelLoadInProgressRef.current) {
      setStatus(
        'Finish the current model operation before restoring a recovery.',
      )
      return
    }

    modelLoadInProgressRef.current = true
    setIsLoading(true)
    setError(null)

    setStatus(
      `Recovering ${latestRecovery.project.fileName}…`,
    )

    try {
      const previousBodyId =
        model?.bodyId

      const recoveredModel =
        await restoreCadProject({
          ...latestRecovery.project,
          bodyId: crypto.randomUUID(),
        })

      installModel(recoveredModel)

      await releaseSupersededCadBody(
        previousBodyId,
        recoveredModel.bodyId,
      )

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
      modelLoadInProgressRef.current = false
      setIsLoading(false)
    }
  }

  function getRecoveryStatus():
    string {
    if (model && !model.editable) {
      return 'View-only mesh · Local recovery unavailable'
    }

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

  if (window.location.pathname !== '/workspace') {
    return <LandingPage />
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to CAD workspace
      </a>
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
              Private, local 3D workspace
            </span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="topbar-link"
            type="button"
            onClick={() => openInformationPanel('help')}
          >
            Help &amp; Guides
          </button>

          <button
            className="topbar-link"
            type="button"
            onClick={() => openInformationPanel('feedback')}
          >
            Feedback
          </button>

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
              : 'Open 3D file'}
          </button>

          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".step,.stp,.stl,.obj,.ply,.glb,.gltf,.3mf,.cadlab"
            onChange={(event) => {
              const file =
                event.target.files?.[0]

              event.target.value = ''

              if (file?.name.toLowerCase().endsWith(CAD_LAB_PROJECT_EXTENSION)) {
                void openProjectFile(file)
              } else {
                void handleFile(file)
              }
            }}
          />

          <input
            ref={projectFileInputRef}
            hidden
            type="file"
            accept={CAD_LAB_PROJECT_EXTENSION}
            onChange={(event) => {
              const file =
                event.target.files?.[0]

              event.target.value = ''

              void openProjectFile(file)
            }}
          />
        </div>
      </header>

      <nav className="cad-ribbon" aria-label="CAD commands">
        <div className="ribbon-group">
          <span className="ribbon-group-label">File</span>
          <div>
            <button type="button" onClick={openFilePicker} disabled={isLoading} title="Open a 3D model or resume saved CAD File Lab work">
              <strong>Open</strong><span>Model or saved work</span>
            </button>
            <button
              type="button"
              onClick={() => void saveCurrentRecovery()}
              disabled={!model?.editable || !localRecoveryEnabled || isLoading || isSavingRecovery}
              title="Save the current work immediately in private browser storage"
            >
              <strong>Save</strong><span>Save now</span>
            </button>
            <span className="autosave-indicator" title="Editable work is saved privately in this browser every five minutes">
              <i aria-hidden="true" />
              Auto-saves every 5 min
            </span>
          </div>
        </div>

        <div className="ribbon-group">
          <span className="ribbon-group-label">Inspect</span>
          <div>
            <button className="active" type="button" onClick={() => setActiveTool('view')}>
              <strong>View</strong><span>Navigate</span>
            </button>
            <button type="button" disabled title="Measurement tools are in development">
              <strong>Measure</strong><span>Planned</span>
            </button>
            <button type="button" disabled title="Section view is in development">
              <strong>Section</strong><span>Planned</span>
            </button>
          </div>
        </div>

        <div className="ribbon-group">
          <span className="ribbon-group-label">Model</span>
          <div>
            <button type="button" disabled><strong>Create</strong><span>New body</span></button>
            <button type="button" disabled><strong>Modify</strong><span>Geometry</span></button>
            <button type="button" disabled><strong>Simplify</strong><span>Reduce size</span></button>
          </div>
        </div>

        <div className="ribbon-group">
          <span className="ribbon-group-label">Output</span>
          <div>
            <button type="button" disabled><strong>Convert</strong><span>3D format</span></button>
            <button type="button" disabled><strong>Export</strong><span>Download</span></button>
          </div>
        </div>
      </nav>

      <section className="workspace" id="workspace">
        <aside className="sidebar">
          <section className="model-tree" aria-labelledby="model-tree-title">
            <div className="model-tree-header">
              <span className="panel-label" id="model-tree-title">Model tree</span>
              {model && <span>{model.bodySummaries.length} {model.bodySummaries.length === 1 ? 'body' : 'bodies'}</span>}
            </div>

            {model && model.bodySummaries.length > 1 && (
              <div className="model-tree-selection-actions">
                <button type="button" onClick={selectAllParts}>Select all</button>
                <button type="button" onClick={() => setSelectedPartIds(new Set())}>Clear</button>
              </div>
            )}

            {model ? (
              <ul>
                <li className="model-tree-file">
                  <span aria-hidden="true">▾</span>
                  <strong title={model.fileName}>{model.fileName}</strong>
                </li>
                {model.bodySummaries.map((body) => (
                  <li
                    className={`model-tree-body${selectedPartIds.has(body.id) ? ' selected' : ''}${hiddenPartIds.has(body.id) ? ' hidden' : ''}`}
                    key={body.id}
                  >
                    <span aria-hidden="true">◇</span>
                    <button
                      className="body-select-button"
                      type="button"
                      onClick={() => togglePartSelection(body.id)}
                      aria-pressed={selectedPartIds.has(body.id)}
                    >
                      <span className="body-color-dot" style={{ background: partColors.get(body.id) ?? displaySettings.modelColor }} aria-hidden="true" />
                      <span>{body.name}</span>
                    </button>
                    <button
                      className="body-visibility-button"
                      type="button"
                      onClick={() => togglePartVisibility(body.id)}
                      aria-label={`${hiddenPartIds.has(body.id) ? 'Show' : 'Hide'} ${body.name}`}
                      title={`${hiddenPartIds.has(body.id) ? 'Show' : 'Hide'} ${body.name}`}
                    >
                      {hiddenPartIds.has(body.id) ? '○' : '●'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Open a 3D file to inspect its bodies and structure.</p>
            )}
          </section>

          <aside className="sidebar-ad-slot" aria-label="Advertisement">
            <span>Advertisement</span>
            <div>
              <strong>Contextual sponsor space</strong>
              <small>No model data is shared.</small>
            </div>
          </aside>

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
              {model && !model.editable
                ? 'Processed locally; original file is unchanged'
                : !localRecoveryEnabled
                ? 'Autosave paused for this open model'
                : storageIsPersistent === true
                ? 'Protected browser storage enabled'
                : 'Stored locally in this browser'}
            </span>

            {model?.editable && (
              <button
                type="button"
                className="secondary-button"
                disabled={isLoading}
                onClick={() => {
                  void saveProjectFile()
                }}
              >
                Save project file
              </button>
            )}

            <button
              type="button"
              className="secondary-button"
              disabled={isLoading}
              onClick={openProjectFilePicker}
            >
              Open project file
            </button>

            {model && !localRecoveryEnabled && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setLocalRecoveryEnabled(true)
                  setStatus('Local recovery re-enabled')
                }}
              >
                Enable local recovery
              </button>
            )}

            {(latestRecovery || model) && (
              <button
                type="button"
                className="secondary-button danger-button"
                disabled={isSavingRecovery || isLoading}
                onClick={() => {
                  void clearLocalRecoveryData()
                }}
              >
                Clear local recovery data
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
                className="toolbar-button"
                aria-label="Fit model to view"
                title="Fit model to view"
                onClick={() => {
                  sendViewCommand(
                    'fit',
                  )
                }}
              >
                <svg className="toolbar-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
                </svg>
              </button>

              <button
                type="button"
                disabled
                aria-label="Undo"
                title="Undo"
              >
                <svg className="toolbar-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6" />
                </svg>
              </button>

              <button
                type="button"
                disabled
                aria-label="Redo"
                title="Redo"
              >
                <svg className="toolbar-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="m15 7 5 5-5 5M19 12h-8a6 6 0 0 0-6 6" />
                </svg>
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
              hiddenPartIds={hiddenPartIds}
              selectedPartIds={selectedPartIds}
              partColors={partColors}
              partOpacities={partOpacities}
            />

            {error && (
              <div className="viewport-error" role="alert">
                <strong>Could not complete the operation</strong>
                <span>{error}</span>
              </div>
            )}

            {!model && !isLoading && (
              <section className="empty-workspace" aria-labelledby="empty-workspace-title">
                <div className="start-scope">
                  <span>Your private 3D workspace</span>
                  <h2>What would you like to do?</h2>
                  <p>View, create, assemble, convert and simplify locally. Your files stay on this device.</p>
                </div>
                <span className="empty-workspace-kicker">Your private 3D workspace</span>
                <h2 id="empty-workspace-title">View, modify and create—locally</h2>
                <p>
                  Work with 3D models directly in your browser. Your files stay on
                  your device—no uploads and no server-side model processing.
                </p>
                <button className="primary-button" type="button" onClick={openFilePicker}>
                  Choose a 3D file
                </button>
                <div className="start-actions">
                  <article>
                    <strong>View 3D file</strong>
                    <span>Inspect a model privately</span>
                    <button type="button" onClick={openFilePicker}>Choose 3D file</button>
                  </article>
                  <article>
                    <strong>Create 3D file</strong>
                    <span>Design a new parametric part</span>
                    <button type="button" disabled>Create part · Coming next</button>
                  </article>
                  <article>
                    <strong>Create assembly</strong>
                    <span>Combine and position components</span>
                    <button type="button" disabled>New assembly · Planned</button>
                  </article>
                  <article>
                    <strong>Convert file</strong>
                    <span>Change to another 3D format</span>
                    <button type="button" disabled>Choose file · Coming next</button>
                  </article>
                  <article>
                    <strong>Reduce file size</strong>
                    <span>Simplify CAD or mesh geometry</span>
                    <button type="button" disabled>Choose file · Coming next</button>
                  </article>
                </div>
                <div className="format-support" aria-label="Supported 3D file formats">
                  <strong>Available now</strong>
                  <div className="format-badges">
                    <span>STEP <small>.step</small></span>
                    <span>STP <small>.stp</small></span>
                    <span>STL <small>.stl</small></span>
                    <span>OBJ <small>.obj</small></span>
                    <span>PLY <small>.ply</small></span>
                    <span>GLB <small>.glb</small></span>
                    <span>glTF <small>.gltf</small></span>
                    <span>3MF <small>.3mf</small></span>
                  </div>
                  <small>Files up to 256 MiB · STL is view-only · More formats are in development</small>
                  <strong className="planned-formats-label">Planned import support</strong>
                  <div className="format-badges planned-format-badges" aria-label="Planned 3D file formats">
                    <span>IGES <small>.iges / .igs</small></span>
                    <span>BREP <small>.brep</small></span>
                  </div>
                </div>
                <ol className="getting-started-steps">
                  <li><strong>Open</strong><span>Choose or drop a supported file</span></li>
                  <li><strong>Inspect</strong><span>Orbit, zoom, pan and fit the model</span></li>
                  <li><strong>Save</strong><span>Download a portable CAD Lab project</span></li>
                </ol>
                {latestRecovery && (
                  <button className="recovery-link" type="button" onClick={() => void recoverLatestProject()}>
                    Continue recovered project: {latestRecovery.project.fileName}
                  </button>
                )}
                <aside className="start-ad-slot" aria-label="Advertisement">
                  <span>Advertisement</span>
                  <p>Reserved for privacy-respecting contextual sponsorship.</p>
                </aside>
              </section>
            )}

            <div className="viewer-hint">
              <strong>
                {isLoading
                  ? 'Processing CAD model…'
                  : fileName ??
                    'No model open'}
              </strong>

              <span>
                Drag to orbit · Scroll
                to zoom · Right-drag
                to pan
              </span>
            </div>

          </div>

          <footer className="statusbar">
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {status}
            </span>

            <span>
              Local processing
            </span>

            <span>Private local recovery</span>
          </footer>
        </section>

        <aside className="properties-sidebar" aria-label="Properties">
          <header>
            <div>
              <span className="panel-label">Properties</span>
              <strong>
                {selectedParts.length > 1
                  ? `${selectedParts.length} bodies selected`
                  : selectedPart?.name ?? (model ? 'No body selected' : 'No selection')}
              </strong>
            </div>
          </header>

          {model ? (
            <>
              {selectedPart && (
                <section className="body-properties">
                  <label>
                    <span>Body color</span>
                    <input
                      type="color"
                      value={partColors.get(selectedPart.id) ?? displaySettings.modelColor}
                      onChange={(event) => setSelectedPartsColor(event.target.value)}
                    />
                  </label>
                  <label className="body-opacity-field">
                    <span>Transparency</span>
                    <output>{Math.round((1 - (partOpacities.get(selectedPart.id) ?? 1)) * 100)}%</output>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={partOpacities.get(selectedPart.id) ?? 1}
                      onChange={(event) => setSelectedPartsOpacity(Number(event.target.value))}
                      aria-label="Selected bodies opacity"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedPartsVisibility(selectedParts.every((part) => hiddenPartIds.has(part.id)))}
                  >
                    {selectedParts.every((part) => hiddenPartIds.has(part.id)) ? 'Show selected' : 'Hide selected'}
                  </button>
                </section>
              )}
              <DisplayPanel
                settings={displaySettings}
                onChange={setDisplaySettings}
                onFitView={() => sendViewCommand('fit')}
                onResetView={() => sendViewCommand('isometric')}
              />
            </>
          ) : (
            <div className="properties-empty">
              <strong>Select a model or body</strong>
              <p>Display, geometry and tool settings will appear here.</p>
            </div>
          )}
        </aside>
      </section>

      <footer className="site-footer">
        <div className="site-footer-identity">
          <strong>CAD File Lab</strong>
          <span>Operated by Cedric Takem · Fellbach, Germany</span>
        </div>

        <nav aria-label="Legal and service information">
          <a href="/IMPRINT.txt" target="_blank" rel="noreferrer">Impressum</a>
          <a href="/PRIVACY_NOTICE.txt" target="_blank" rel="noreferrer">Privacy</a>
          <a href="/TERMS_OF_USE.txt" target="_blank" rel="noreferrer">Terms</a>
          <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Open-source notices</a>
          <a href="mailto:admin@cadfilelab.com">Contact</a>
        </nav>

        <span className="site-footer-privacy">
          CAD files are processed locally in your browser.
        </span>
      </footer>

      {informationPanel && (
        <div
          className="information-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeInformationPanel()
            }
          }}
        >
          <section
            ref={informationPanelRef}
            className="information-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="information-panel-title"
          >
            <header className="information-panel-header">
              <div>
                <span className="panel-label">CAD File Labs</span>
                <h2 id="information-panel-title">
                  {informationPanel === 'help' ? 'Help & Guides' : 'Send feedback'}
                </h2>
              </div>

              <button
                className="information-close"
                type="button"
                aria-label="Close"
                onClick={closeInformationPanel}
              >
                Close
              </button>
            </header>

            {informationPanel === 'help' ? (
              <div className="help-content">
                <article>
                  <h3>Getting started</h3>
                  <p>Choose a STEP or STP file, or drop it into the viewport. Processing happens locally in this browser; the file is not uploaded.</p>
                </article>
                <article>
                  <h3>Supported formats</h3>
                  <p>The current editable importer supports STEP and STP. STL, OBJ, 3MF, PLY, glTF/GLB, IGES and BREP conversion are planned and will only be labelled available after they are verified.</p>
                </article>
                <article>
                  <h3>PDF and 3D PDF</h3>
                  <p>A standard PDF contains rendered model views. A true interactive 3D PDF embeds PRC or U3D data and needs a separately licensed conversion engine; it is not available in this browser-only release.</p>
                </article>
                <article>
                  <h3>Geometry accuracy</h3>
                  <p>STEP, IGES and BREP can preserve exact CAD geometry. Mesh formats approximate surfaces with triangles, so converting to a mesh can lose features and precision.</p>
                </article>
                <article>
                  <h3>Privacy and recovery</h3>
                  <p>Models remain on this device. Recovery stores an editable copy of imported geometry in this browser. Use “Clear local recovery data” in the project panel to erase every saved copy and pause autosave for the open model.</p>
                </article>
                <article>
                  <h3>Troubleshooting</h3>
                  <p>If an import fails, confirm the extension, try a smaller model, close memory-heavy tabs and use a current desktop browser. Never send confidential CAD files with a feedback report.</p>
                </article>
                <article>
                  <h3>Open-source notices</h3>
                  <p>
                    CAD File Lab uses Open CASCADE Technology under GNU LGPL 2.1
                    with the OCCT additional exception. You may replace the
                    browser CAD kernel with a compatible modified build. Read the{' '}
                    <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">
                      third-party software notices
                    </a>
                    {' '}and the{' '}
                    <a href="/OCCT_SOURCE_OFFER.txt" target="_blank" rel="noreferrer">
                      OCCT source and relinking offer
                    </a>
                    .
                  </p>
                  <p>
                    Read the{' '}
                    <a href="/PRIVACY_NOTICE.txt" target="_blank" rel="noreferrer">
                      privacy notice
                    </a>
                    {' '}and{' '}
                    <a href="/TERMS_OF_USE.txt" target="_blank" rel="noreferrer">
                      hosted service terms
                    </a>
                    , and the{' '}
                    <a href="/IMPRINT.txt" target="_blank" rel="noreferrer">
                      provider notice
                    </a>
                    .
                  </p>
                </article>
              </div>
            ) : (
              <form
                className="feedback-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void copyFeedback()
                }}
              >
                <p>
                  Feedback is not automatically transmitted or stored. Copy the prepared
                  report, then email it to{' '}
                  <a href="mailto:admin@cadfilelab.com">admin@cadfilelab.com</a>.
                  Never attach confidential CAD files.
                </p>
                <label>
                  Category
                  <select
                    value={feedbackCategory}
                    onChange={(event) => setFeedbackCategory(event.target.value)}
                  >
                    <option>General feedback</option>
                    <option>Import problem</option>
                    <option>Conversion request</option>
                    <option>Accessibility</option>
                    <option>Privacy or legal concern</option>
                  </select>
                </label>
                <label>
                  Message
                  <textarea
                    required
                    rows={7}
                    value={feedbackMessage}
                    placeholder="Describe what happened. Do not include confidential model data."
                    onChange={(event) => {
                      setFeedbackMessage(event.target.value)
                      setFeedbackStatus(null)
                    }}
                  />
                </label>
                <button className="primary-button" type="submit" disabled={!feedbackMessage.trim()}>
                  Copy feedback report
                </button>
                {feedbackStatus && (
                  <p className="feedback-status" role="status" aria-live="polite">
                    {feedbackStatus}
                  </p>
                )}
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default App
