import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import './App.css'

import { LandingPage } from './marketing/LandingPage'

import {
  disposeCadBody,
  createCadPrimitive,
  createCadFeatureModel,
  importStepFile,
  restoreCadProject,
  serializeCadProject,
  updateCadPrimitive,
  updateCadFeatureModel,
  type ImportedCadBody,
} from './cad/cadClient'
import type { CadPrimitive } from './cad/primitive'
import type { CadFeatureModel, SketchExtrudeFeature } from './cad/featureModel'
import { createSketchEditorState, reduceSketch, type SketchEntity } from './cad/sketchModel'

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
  type MeasurementSummary,
  type MeasurementMode,
  type ViewCommand,
  type ViewCommandType,
} from './viewer/CadViewport'
import { updateBodySelection } from './viewer/bodySelection'
import {
  calculateMeshProperties,
  formatAreaMm2,
  formatVolumeMm3,
} from './viewer/meshProperties'

import {
  DisplayPanel,
} from './viewer/DisplayPanel'

import {
  defaultDisplaySettings,
  type DisplaySettings,
} from './viewer/displaySettings'
import {
  defaultSectionSettings,
  type SectionSettings,
} from './viewer/sectionClipping'

import {
  convertTriangleMesh,
  type MeshExportFormat,
} from './cad/meshConversion'

type WorkspaceTool =
  | 'view'
  | 'create'
  | 'measure'
  | 'section'
  | 'modify'
  | 'convert'
  | 'simplify'

type InformationPanel =
  | 'help'
  | 'feedback'
  | null

type FileOpenIntent = 'view' | 'convert' | 'reduce'

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
    id: 'create',
    label: 'Create',
    description: 'Create a box or cylinder with exact dimensions',
    available: true,
  },
  {
    id: 'measure',
    label: 'Measure',
    description:
      'Select points, edges, or faces to inspect dimensions',
    available: true,
  },
  {
    id: 'modify',
    label: 'Modify',
    description:
      'Fillet, chamfer and edit selected geometry',
    available: false,
  },
  {
    id: 'convert',
    label: 'Convert',
    description:
      'Download the open model in another mesh format',
    available: true,
  },
  {
    id: 'section',
    label: 'Section',
    description: 'Preview a non-destructive clipping plane',
    available: true,
  },
  {
    id: 'simplify',
    label: 'Simplify',
    description:
      'Reduce model size with a controlled detail level',
    available: true,
  },
]

function formatRecoveryTime(
  timestamp: number,
): string {
  return new Date(
    timestamp,
  ).toLocaleString()
}

function formatSignedMillimetres(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 3 })} mm`
}

// Kept temporarily for project-history migration while the mouse sketcher becomes the primary creation workflow.
function FeatureModelEditor({ model, disabled, onChange, onBuild }: {
  model: CadFeatureModel
  disabled: boolean
  onChange: (model: CadFeatureModel) => void
  onBuild: () => void
}) {
  const update = (index: number, feature: SketchExtrudeFeature) => onChange({ version: 1, features: model.features.map((item, itemIndex) => itemIndex === index ? feature : item) })
  const addFeature = () => {
    const number = model.features.length + 1
    onChange({ version: 1, features: [...model.features, {
      id: `feature-${crypto.randomUUID()}`, type: 'sketchExtrude', name: `Cut-Extrude${number}`, plane: 'XY',
      profile: { type: 'circle', radius: 8 }, operation: 'cut', length: 10, reversed: false,
    }] })
  }
  return <form className="primitive-panel" onSubmit={(event) => { event.preventDefault(); onBuild() }}>
    <span className="panel-label">Parametric feature history</span>
    {model.features.map((feature, index) => <fieldset key={feature.id}>
      <legend>{index + 1}. {feature.name}</legend>
      <label><span>Name</span><input required value={feature.name} onChange={(event) => update(index, { ...feature, name: event.target.value })} /></label>
      <label><span>Plane</span><select value={feature.plane} onChange={(event) => update(index, { ...feature, plane: event.target.value as SketchExtrudeFeature['plane'] })}>
        <option value="XY">Top (XY)</option><option value="XZ">Front (XZ)</option><option value="YZ">Right (YZ)</option>
      </select></label>
      <label><span>Profile</span><select value={feature.profile.type} onChange={(event) => update(index, { ...feature, profile: event.target.value === 'rectangle' ? { type: 'rectangle', width: 100, height: 60 } : { type: 'circle', radius: 20 } })}>
        <option value="rectangle">Centered rectangle</option><option value="circle">Centered circle</option>
      </select></label>
      {feature.profile.type === 'rectangle' ? <>
        <label><span>Width (mm)</span><input type="number" min="0.01" max="1000000" step="0.01" required value={feature.profile.width} onChange={(event) => feature.profile.type === 'rectangle' && update(index, { ...feature, profile: { type: 'rectangle', width: Number(event.target.value), height: feature.profile.height } })} /></label>
        <label><span>Height (mm)</span><input type="number" min="0.01" max="1000000" step="0.01" required value={feature.profile.height} onChange={(event) => feature.profile.type === 'rectangle' && update(index, { ...feature, profile: { type: 'rectangle', width: feature.profile.width, height: Number(event.target.value) } })} /></label>
      </> : feature.profile.type === 'circle' ? <label><span>Radius (mm)</span><input type="number" min="0.01" max="1000000" step="0.01" required value={feature.profile.radius} onChange={(event) => feature.profile.type === 'circle' && update(index, { ...feature, profile: { type: 'circle', radius: Number(event.target.value) } })} /></label> : <small>Closed line profile</small>}
      <label><span>Operation</span><select disabled={index === 0} value={feature.operation} onChange={(event) => update(index, { ...feature, operation: event.target.value as 'boss' | 'cut' })}>
        <option value="boss">Boss extrude</option><option value="cut">Cut extrude</option>
      </select></label>
      <label><span>Length (mm)</span><input type="number" min="0.01" max="1000000" step="0.01" required value={feature.length} onChange={(event) => update(index, { ...feature, length: Number(event.target.value) })} /></label>
      <label><input type="checkbox" checked={feature.reversed} onChange={(event) => update(index, { ...feature, reversed: event.target.checked })} /> <span>Reverse direction</span></label>
      {index > 0 && <button type="button" onClick={() => onChange({ version: 1, features: model.features.filter((_, itemIndex) => itemIndex !== index) })}>Remove feature</button>}
    </fieldset>)}
    <button type="button" onClick={addFeature}>Add sketch feature</button>
    <button className="primary-button" type="submit" disabled={disabled}>{disabled ? 'Rebuilding…' : 'Build feature history'}</button>
    <small>Features are rebuilt locally in order and preserved in project recovery.</small>
  </form>
}

void FeatureModelEditor

function SketchCreator({ model, disabled, onChange, onBuild }: {
  model: CadFeatureModel; disabled: boolean; onChange: (model: CadFeatureModel) => void; onBuild: () => void
}) {
  const [stage, setStage] = useState<'plane' | 'sketch' | 'extrude'>('plane')
  const [plane, setPlane] = useState<SketchExtrudeFeature['plane']>('XY')
  const [planeOffset, setPlaneOffset] = useState(0)
  const [planeAngle, setPlaneAngle] = useState(0)
  const [planeAngleAxis, setPlaneAngleAxis] = useState<'horizontal' | 'vertical'>('horizontal')
  const [creatingPlane, setCreatingPlane] = useState(false)
  const [tool, setTool] = useState<'select' | 'line' | 'rectangle' | 'circle' | 'centerline' | 'arc' | 'dimension'>('line')
  const [drag, setDrag] = useState<{ start: [number, number]; end: [number, number] } | null>(null)
  const [linePoints, setLinePoints] = useState<Array<[number, number]>>([])
  const [arcPoints, setArcPoints] = useState<Array<[number, number]>>([])
  const [hoverPoint, setHoverPoint] = useState<[number, number] | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 520 })
  const canvasRef = useRef<SVGSVGElement>(null)
  const [sketchState, dispatchSketch] = useReducer(reduceSketch, undefined, createSketchEditorState)
  const feature = model.features.at(-1)!
  const replaceFeature = (next: SketchExtrudeFeature) => onChange({
    version: 1, features: model.features.map((item, index) => index === model.features.length - 1 ? next : item),
  })
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const updateSize = () => {
      const box = canvas.getBoundingClientRect()
      setCanvasSize({ width: Math.max(320, Math.round(box.width)), height: Math.max(240, Math.round(box.height)) })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [stage])
  useEffect(() => {
    const stopLine = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stage === 'sketch' && tool !== 'select') {
        setTool('select')
        setHoverPoint(null)
        setDrag(null)
        setArcPoints([])
      }
    }
    window.addEventListener('keydown', stopLine)
    return () => window.removeEventListener('keydown', stopLine)
  }, [stage, tool])
  useEffect(() => {
    const editSketch = (event: KeyboardEvent) => {
      if (stage !== 'sketch') return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        dispatchSketch({ type: event.shiftKey ? 'redo' : 'undo' })
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault(); dispatchSketch({ type: 'redo' })
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && sketchState.selectedEntityIds.length) {
        event.preventDefault(); dispatchSketch({ type: 'removeEntities', entityIds: sketchState.selectedEntityIds })
      }
    }
    window.addEventListener('keydown', editSketch)
    return () => window.removeEventListener('keydown', editSketch)
  }, [sketchState.selectedEntityIds, stage])
  const startSketch = () => {
    const next: SketchExtrudeFeature = {
      id: `feature-${crypto.randomUUID()}`, type: 'sketchExtrude', name: 'Boss-Extrude1', plane, planeOffset, planeAngle, planeAngleAxis,
      profile: { type: 'rectangle', width: 60, height: 40 }, operation: 'boss', length: 10, reversed: false,
    }
    onChange({ version: 1, features: [next] })
    setDrag(null)
    setLinePoints([])
    setStage('sketch')
  }
  const point = (event: ReactPointerEvent<SVGSVGElement>): [number, number] => {
    const matrix = event.currentTarget.getScreenCTM()
    if (!matrix) return [0, 0]
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return [local.x, local.y]
  }
  const snappedLinePoint = (raw: [number, number]): [number, number] => {
    const endpoint = linePoints.find((candidate) => Math.hypot(raw[0] - candidate[0], raw[1] - candidate[1]) <= 10)
    if (endpoint) return endpoint
    const previous = linePoints.at(-1)
    if (!previous) return raw
    if (Math.abs(raw[0] - previous[0]) <= 7) return [previous[0], raw[1]]
    if (Math.abs(raw[1] - previous[1]) <= 7) return [raw[0], previous[1]]
    return raw
  }
  const finish = (end: [number, number]) => {
    if (!drag) return
    const dx = Math.abs(end[0] - drag.start[0]); const dy = Math.abs(end[1] - drag.start[1])
    replaceFeature({ ...feature, plane, profile: tool === 'rectangle'
      ? { type: 'rectangle', width: Math.max(1, Math.round(dx)), height: Math.max(1, Math.round(dy)) }
      : { type: 'circle', radius: Math.max(0.5, Math.round(Math.hypot(dx, dy) * 10) / 10) } })
    if (tool === 'circle') {
      dispatchSketch({ type: 'addEntity', entity: { id: `circle-${crypto.randomUUID()}`, type: 'circle', center: drag.start, radius: Math.hypot(end[0] - drag.start[0], end[1] - drag.start[1]) } })
    } else if (tool === 'rectangle') {
      const x1 = Math.min(drag.start[0], end[0]); const x2 = Math.max(drag.start[0], end[0])
      const y1 = Math.min(drag.start[1], end[1]); const y2 = Math.max(drag.start[1], end[1])
      const corners: Array<[number, number]> = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
      corners.forEach((start, index) => dispatchSketch({ type: 'addEntity', entity: { id: `line-${crypto.randomUUID()}`, type: 'line', start, end: corners[(index + 1) % corners.length] } }))
    }
    setDrag({ start: drag.start, end })
  }
  if (stage === 'plane') return <section className="sketch-workflow plane-stage">
    <span className="panel-label">New part · Select sketch plane</span>
    <p>Choose a plane, then draw the first sketch with the mouse.</p>
    <div className="plane-picker">
      {([['XY', 'Top'], ['XZ', 'Front'], ['YZ', 'Right']] as const).map(([value, label]) =>
        <button className={plane === value ? 'selected' : ''} type="button" key={value} onClick={() => setPlane(value)}><span>{value}</span><strong>{label} plane</strong></button>)}
    </div>
    <button type="button" onClick={() => setCreatingPlane((current) => !current)}>＋ New offset plane</button>
    {creatingPlane && <fieldset className="reference-plane-editor">
      <legend>Plane1</legend>
      <label><span>Reference plane</span><select value={plane} onChange={(event) => setPlane(event.target.value as SketchExtrudeFeature['plane'])}><option value="XY">Top (XY)</option><option value="XZ">Front (XZ)</option><option value="YZ">Right (YZ)</option></select></label>
      <label><span>Offset (mm)</span><input type="number" step="0.01" value={planeOffset} onChange={(event) => setPlaneOffset(Number(event.target.value))} /></label>
      <label><span>Angle (deg)</span><input type="number" min="-360" max="360" step="0.1" value={planeAngle} onChange={(event) => setPlaneAngle(Number(event.target.value))} /></label>
      <label><span>Rotation axis</span><select value={planeAngleAxis} onChange={(event) => setPlaneAngleAxis(event.target.value as 'horizontal' | 'vertical')}><option value="horizontal">Horizontal sketch axis</option><option value="vertical">Vertical sketch axis</option></select></label>
      <small>Use a negative value to offset in the opposite direction.</small>
    </fieldset>}
    <button className="primary-button" type="button" onClick={startSketch}>Start sketch</button>
  </section>
  if (stage === 'sketch') {
    const origin: [number, number] = [canvasSize.width / 2, canvasSize.height / 2]
    const preview = drag ?? { start: [origin[0] - 50, origin[1] - 35] as [number, number], end: tool === 'rectangle' ? [origin[0] + 50, origin[1] + 35] as [number, number] : [origin[0] + 10, origin[1] - 35] as [number, number] }
    const dx = Math.abs(preview.end[0] - preview.start[0]); const dy = Math.abs(preview.end[1] - preview.start[1])
    const selectedSketchEntity = sketchState.document.entities.find((entity) => sketchState.selectedEntityIds.includes(entity.id))
    const arcPath = (center: [number, number], radius: number, startAngle: number, endAngle: number) => {
      const radians = (degrees: number) => degrees * Math.PI / 180
      const start = [center[0] + radius * Math.cos(radians(startAngle)), center[1] + radius * Math.sin(radians(startAngle))]
      const end = [center[0] + radius * Math.cos(radians(endAngle)), center[1] + radius * Math.sin(radians(endAngle))]
      const sweep = ((endAngle - startAngle) % 360 + 360) % 360
      return `M${start[0]} ${start[1]} A${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${end[0]} ${end[1]}`
    }
    const updateLineLength = (entity: Extract<SketchEntity, { type: 'line' }>, length: number) => {
      const current = Math.hypot(entity.end[0] - entity.start[0], entity.end[1] - entity.start[1])
      if (!Number.isFinite(length) || length <= 0 || current <= 0) return
      dispatchSketch({ type: 'updateEntity', entity: { ...entity, end: [entity.start[0] + (entity.end[0] - entity.start[0]) * length / current, entity.start[1] + (entity.end[1] - entity.start[1]) * length / current] } })
    }
    const selectedLines = sketchState.document.entities.filter((entity): entity is Extract<SketchEntity, { type: 'line' }> => entity.type === 'line' && sketchState.selectedEntityIds.includes(entity.id))
    const applySingleLineRelation = (type: 'horizontal' | 'vertical') => {
      const line = selectedLines[0]
      if (!line) return
      dispatchSketch({ type: 'updateEntity', entity: { ...line, end: type === 'horizontal' ? [line.end[0], line.start[1]] : [line.start[0], line.end[1]] } })
      dispatchSketch({ type: 'addConstraint', constraint: { id: `relation-${crypto.randomUUID()}`, type, entityId: line.id } })
    }
    const applyTwoLineRelation = (type: 'parallel' | 'perpendicular' | 'equal') => {
      const [first, second] = selectedLines
      if (!first || !second) return
      const firstVector: [number, number] = [first.end[0] - first.start[0], first.end[1] - first.start[1]]
      const firstLength = Math.hypot(...firstVector); const secondLength = Math.hypot(second.end[0] - second.start[0], second.end[1] - second.start[1])
      if (!firstLength || !secondLength) return
      const targetLength = type === 'equal' ? firstLength : secondLength
      const direction: [number, number] = type === 'perpendicular' ? [-firstVector[1] / firstLength, firstVector[0] / firstLength] : [firstVector[0] / firstLength, firstVector[1] / firstLength]
      dispatchSketch({ type: 'updateEntity', entity: { ...second, end: [second.start[0] + direction[0] * targetLength, second.start[1] + direction[1] * targetLength] } })
      dispatchSketch({ type: 'addConstraint', constraint: { id: `relation-${crypto.randomUUID()}`, type, firstEntityId: first.id, secondEntityId: second.id } })
    }
    return <section className="sketch-workflow">
      <div className="sketch-heading"><div><span className="panel-label">Sketch1 · {plane}{planeOffset ? ` offset ${planeOffset} mm` : ''}</span><strong>Draw a closed profile</strong></div><button type="button" onClick={() => setStage('plane')}>Cancel</button></div>
      <div className="cad-command-tabs"><button className="selected" type="button">Sketch</button><button type="button" disabled>Features</button></div>
      <div className="sketch-tools" role="toolbar" aria-label="Sketch tools">
        <button className={tool === 'select' ? 'selected' : ''} type="button" onClick={() => { setTool('select'); setDrag(null); setHoverPoint(null); setArcPoints([]) }}>↖ Select</button>
        <button type="button" disabled={!sketchState.undoStack.length} onClick={() => dispatchSketch({ type: 'undo' })}>↶ Undo</button>
        <button type="button" disabled={!sketchState.redoStack.length} onClick={() => dispatchSketch({ type: 'redo' })}>↷ Redo</button>
        <button className={tool === 'line' ? 'selected' : ''} type="button" onClick={() => { setTool('line'); setDrag(null); setLinePoints([]); setHoverPoint(null) }}>╱ Line</button>
        <button className={tool === 'centerline' ? 'selected' : ''} type="button" disabled title="Coming in the next sketch-kernel milestone">┄ Centerline</button>
        <button className={tool === 'rectangle' ? 'selected' : ''} type="button" onClick={() => { setTool('rectangle'); setDrag(null) }}>▭ Rectangle</button>
        <button className={tool === 'circle' ? 'selected' : ''} type="button" onClick={() => { setTool('circle'); setDrag(null) }}>○ Circle</button>
        <button className={tool === 'arc' ? 'selected' : ''} type="button" onClick={() => { setTool('arc'); setArcPoints([]); setDrag(null) }}>⌒ Centerpoint Arc</button>
        <button className={tool === 'dimension' ? 'selected' : ''} type="button" onClick={() => setTool('dimension')}>↔ Smart Dimension</button>
        <button type="button" disabled>Trim</button><button type="button" disabled>Offset entities</button><button type="button" disabled>Mirror entities</button>
        <button type="button" disabled={selectedLines.length !== 1} onClick={() => applySingleLineRelation('horizontal')}>— Horizontal</button>
        <button type="button" disabled={selectedLines.length !== 1} onClick={() => applySingleLineRelation('vertical')}>│ Vertical</button>
        <button type="button" disabled={selectedLines.length !== 2} onClick={() => applyTwoLineRelation('parallel')}>∥ Parallel</button>
        <button type="button" disabled={selectedLines.length !== 2} onClick={() => applyTwoLineRelation('perpendicular')}>⊥ Perpendicular</button>
        <button type="button" disabled={selectedLines.length !== 2} onClick={() => applyTwoLineRelation('equal')}>= Equal</button>
      </div>
      <svg ref={canvasRef} className="sketch-canvas" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
        onPointerDown={(event) => {
          const start = tool === 'line' ? snappedLinePoint(point(event)) : point(event)
          if (tool === 'arc') {
            const next = [...arcPoints, start]
            if (next.length === 3) {
              const [center, arcStart, arcEnd] = next
              const radius = Math.hypot(arcStart[0] - center[0], arcStart[1] - center[1])
              const angle = (point: [number, number]) => Math.atan2(point[1] - center[1], point[0] - center[0]) * 180 / Math.PI
              if (radius > 0.01) dispatchSketch({ type: 'addEntity', entity: { id: `arc-${crypto.randomUUID()}`, type: 'arc', center, radius, startAngle: angle(arcStart), endAngle: angle(arcEnd) } })
              setArcPoints([]); setTool('select')
            } else setArcPoints(next)
            return
          }
          if (tool === 'line') {
            if (linePoints.length >= 3 && Math.hypot(start[0] - linePoints[0][0], start[1] - linePoints[0][1]) < 8) {
              dispatchSketch({ type: 'addEntity', entity: { id: `line-${crypto.randomUUID()}`, type: 'line', start: linePoints.at(-1)!, end: linePoints[0] } })
              replaceFeature({ ...feature, plane, profile: { type: 'polyline', points: linePoints.map(([x, y]) => [Math.round((x - origin[0]) * 10) / 10, Math.round((origin[1] - y) * 10) / 10]) } })
              setLinePoints((current) => [...current, current[0]])
              setDrag({ start: linePoints[0], end: linePoints[0] })
              setTool('select')
              setHoverPoint(null)
            } else {
              const previous = linePoints.at(-1)
              if (previous) dispatchSketch({ type: 'addEntity', entity: { id: `line-${crypto.randomUUID()}`, type: 'line', start: previous, end: start } })
              setLinePoints((current) => [...current, start])
              setHoverPoint(start)
            }
            return
          }
          if (tool !== 'rectangle' && tool !== 'circle') return
          event.currentTarget.setPointerCapture(event.pointerId); setDrag({ start, end: start })
        }}
        onPointerMove={(event) => {
          if (tool === 'line' && linePoints.length) setHoverPoint(snappedLinePoint(point(event)))
          if ((tool === 'rectangle' || tool === 'circle') && drag && event.currentTarget.hasPointerCapture(event.pointerId)) setDrag({ ...drag, end: point(event) })
        }}
        onPointerUp={(event) => { if ((tool === 'rectangle' || tool === 'circle') && event.currentTarget.hasPointerCapture(event.pointerId)) { finish(point(event)); event.currentTarget.releasePointerCapture(event.pointerId) } }}>
        <defs><pattern id="sketch-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#d5e1eb" strokeWidth=".6" /></pattern></defs>
        <rect width={canvasSize.width} height={canvasSize.height} fill="url(#sketch-grid)" /><path d={`M${origin[0]} 0V${canvasSize.height}M0 ${origin[1]}H${canvasSize.width}`} stroke="#789dbb" /><circle cx={origin[0]} cy={origin[1]} r="3" fill="#d33" />
        {sketchState.document.entities.map((entity) => entity.type === 'line' && <line key={entity.id} x1={entity.start[0]} y1={entity.start[1]} x2={entity.end[0]} y2={entity.end[1]} className={`sketch-entity${sketchState.selectedEntityIds.includes(entity.id) ? ' selected' : ''}`} onPointerDown={(event) => { if (tool !== 'select' && tool !== 'dimension') return; event.stopPropagation(); dispatchSketch({ type: 'select', entityId: entity.id, additive: event.ctrlKey || event.metaKey || event.shiftKey }) }} />)}
        {sketchState.document.entities.map((entity) => entity.type === 'circle' ? <circle key={entity.id} cx={entity.center[0]} cy={entity.center[1]} r={entity.radius} fill="none" className={`sketch-entity${sketchState.selectedEntityIds.includes(entity.id) ? ' selected' : ''}`} onPointerDown={(event) => { if (tool !== 'select' && tool !== 'dimension') return; event.stopPropagation(); dispatchSketch({ type: 'select', entityId: entity.id, additive: event.ctrlKey || event.metaKey || event.shiftKey }) }} /> : entity.type === 'arc' ? <path key={entity.id} d={arcPath(entity.center, entity.radius, entity.startAngle, entity.endAngle)} fill="none" className={`sketch-entity${sketchState.selectedEntityIds.includes(entity.id) ? ' selected' : ''}`} onPointerDown={(event) => { if (tool !== 'select' && tool !== 'dimension') return; event.stopPropagation(); dispatchSketch({ type: 'select', entityId: entity.id, additive: event.ctrlKey || event.metaKey || event.shiftKey }) }} /> : null)}
        {tool === 'arc' && arcPoints.length > 0 && <>{<circle cx={arcPoints[0][0]} cy={arcPoints[0][1]} r="4" fill="#d33" />}{arcPoints.length === 2 && <circle cx={arcPoints[0][0]} cy={arcPoints[0][1]} r={Math.hypot(arcPoints[1][0] - arcPoints[0][0], arcPoints[1][1] - arcPoints[0][1])} fill="none" stroke="#1595e6" strokeDasharray="5 3" />}</>}
        {linePoints.length > 0 && <>{linePoints.length > 1 && <polyline points={linePoints.map((item) => item.join(',')).join(' ')} fill="none" stroke="#0875c9" strokeWidth="2" />}{tool === 'line' && hoverPoint && <line x1={linePoints.at(-1)![0]} y1={linePoints.at(-1)![1]} x2={hoverPoint[0]} y2={hoverPoint[1]} stroke="#1595e6" strokeWidth="2" strokeDasharray="5 3" />}{linePoints.map((item, index) => <g key={`${item[0]}-${item[1]}-${index}`}><circle cx={item[0]} cy={item[1]} r="4.5" fill={index === 0 ? '#d33' : '#0875c9'} />{index > 0 && <text x={(item[0] + linePoints[index - 1][0]) / 2} y={(item[1] + linePoints[index - 1][1]) / 2 - 7} className="sketch-dimension">{Math.hypot(item[0] - linePoints[index - 1][0], item[1] - linePoints[index - 1][1]).toFixed(1)} mm</text>}</g>)}</>}
        {tool === 'rectangle' && <rect x={Math.min(preview.start[0], preview.end[0])} y={Math.min(preview.start[1], preview.end[1])} width={dx} height={dy} fill="rgba(20,120,210,.12)" stroke="#0875c9" strokeWidth="2" />}
        {tool === 'circle' && <circle cx={preview.start[0]} cy={preview.start[1]} r={Math.hypot(dx, dy)} fill="rgba(20,120,210,.12)" stroke="#0875c9" strokeWidth="2" />}
        {tool === 'rectangle' && drag && <><text x={(preview.start[0] + preview.end[0]) / 2} y={Math.min(preview.start[1], preview.end[1]) - 5} className="sketch-dimension">{dx.toFixed(1)} mm</text><text x={Math.max(preview.start[0], preview.end[0]) + 5} y={(preview.start[1] + preview.end[1]) / 2} className="sketch-dimension">{dy.toFixed(1)} mm</text></>}
        {tool === 'circle' && drag && <text x={preview.start[0] + 6} y={preview.start[1] - 6} className="sketch-dimension">R {Math.hypot(dx, dy).toFixed(1)} mm</text>}
      </svg>
      {selectedSketchEntity && <aside className="sketch-property-manager">
        <strong>{selectedSketchEntity.type === 'line' ? 'Line properties' : selectedSketchEntity.type === 'circle' ? 'Circle properties' : 'Arc properties'}</strong>
        {selectedSketchEntity.type === 'line' && <label><span>Length (mm)</span><input type="number" min="0.01" step="0.01" value={Math.hypot(selectedSketchEntity.end[0] - selectedSketchEntity.start[0], selectedSketchEntity.end[1] - selectedSketchEntity.start[1]).toFixed(2)} onChange={(event) => updateLineLength(selectedSketchEntity, Number(event.target.value))} /></label>}
        {(selectedSketchEntity.type === 'circle' || selectedSketchEntity.type === 'arc') && <>
          <label><span>Radius (mm)</span><input type="number" min="0.01" step="0.01" value={selectedSketchEntity.radius.toFixed(2)} onChange={(event) => dispatchSketch({ type: 'updateEntity', entity: { ...selectedSketchEntity, radius: Math.max(0.01, Number(event.target.value)) } })} /></label>
          <label><span>Diameter (mm)</span><input type="number" min="0.02" step="0.01" value={(selectedSketchEntity.radius * 2).toFixed(2)} onChange={(event) => dispatchSketch({ type: 'updateEntity', entity: { ...selectedSketchEntity, radius: Math.max(0.01, Number(event.target.value) / 2) } })} /></label>
        </>}
        <label className="inline-check"><input type="checkbox" checked={selectedSketchEntity.construction === true} onChange={(event) => dispatchSketch({ type: 'updateEntity', entity: { ...selectedSketchEntity, construction: event.target.checked } })} /><span>For construction</span></label>
        {sketchState.document.constraints.some((constraint) => ('entityId' in constraint ? constraint.entityId === selectedSketchEntity.id : constraint.firstEntityId === selectedSketchEntity.id || constraint.secondEntityId === selectedSketchEntity.id)) && <div className="sketch-relation-list"><span>Existing relations</span>{sketchState.document.constraints.filter((constraint) => ('entityId' in constraint ? constraint.entityId === selectedSketchEntity.id : constraint.firstEntityId === selectedSketchEntity.id || constraint.secondEntityId === selectedSketchEntity.id)).map((constraint) => <strong key={constraint.id}>{constraint.type}</strong>)}</div>}
        <button type="button" onClick={() => dispatchSketch({ type: 'removeEntities', entityIds: [selectedSketchEntity.id] })}>Delete entity</button>
      </aside>}
      <small>{tool === 'line' ? 'Click endpoints. Click the first red point to close the profile.' : 'Click and drag in the sketch. Dimensions are displayed on the sketch.'}</small>
      <button className="primary-button" type="button" disabled={!drag || (feature.profile.type !== 'polyline' && dx < 1 && dy < 1)} onClick={() => setStage('extrude')}>Exit sketch</button>
    </section>
  }
  return <form className="sketch-workflow" onSubmit={(event) => { event.preventDefault(); onBuild() }}>
    <div className="cad-command-tabs"><button type="button" onClick={() => setStage('sketch')}>Sketch</button><button className="selected" type="button">Features</button></div>
    <div className="feature-tools" role="toolbar" aria-label="Feature tools"><button className="selected" type="button">Extruded Boss/Base</button><button type="button" disabled>Extruded Cut</button><button type="button" disabled>Revolve</button><button type="button" disabled>Sweep</button><button type="button" disabled>Loft</button><button type="button" disabled>Fillet</button><button type="button" disabled>Pattern</button><button type="button" onClick={() => setStage('plane')}>Reference Geometry</button></div>
    <span className="panel-label">Boss-Extrude</span>
    <div className="sketch-summary"><div><strong>Sketch1</strong><span>{feature.plane}{feature.planeOffset ? ` + ${feature.planeOffset} mm` : ''} · {feature.profile.type === 'rectangle' ? `${feature.profile.width} × ${feature.profile.height} mm` : feature.profile.type === 'circle' ? `Ø ${feature.profile.radius * 2} mm` : `${feature.profile.points.length} line segments`}</span></div><button type="button" onClick={() => setStage('sketch')}>Edit sketch</button></div>
    {feature.profile.type === 'rectangle' ? <div className="dimension-grid">
      <label><span>Width (mm)</span><input type="number" min="0.01" step="0.01" value={feature.profile.width} onChange={(event) => feature.profile.type === 'rectangle' && replaceFeature({ ...feature, profile: { ...feature.profile, width: Number(event.target.value) } })} /></label>
      <label><span>Height (mm)</span><input type="number" min="0.01" step="0.01" value={feature.profile.height} onChange={(event) => feature.profile.type === 'rectangle' && replaceFeature({ ...feature, profile: { ...feature.profile, height: Number(event.target.value) } })} /></label>
    </div> : feature.profile.type === 'circle' ? <label><span>Diameter (mm)</span><input type="number" min="0.01" step="0.01" value={feature.profile.radius * 2} onChange={(event) => feature.profile.type === 'circle' && replaceFeature({ ...feature, profile: { type: 'circle', radius: Number(event.target.value) / 2 } })} /></label> : <div className="sketch-segment-list">{feature.profile.points.map((item, index) => <span key={`${item[0]}-${item[1]}-${index}`}>Point {index + 1}: {item[0]}, {item[1]} mm</span>)}</div>}
    <label><span>Depth (mm)</span><input type="number" min="0.01" step="0.01" value={feature.length} onChange={(event) => replaceFeature({ ...feature, length: Number(event.target.value) })} /></label>
    <label className="inline-check"><input type="checkbox" checked={feature.reversed} onChange={(event) => replaceFeature({ ...feature, reversed: event.target.checked })} /><span>Reverse direction</span></label>
    <button className="primary-button" type="submit" disabled={disabled}>{disabled ? 'Building…' : 'Build feature'}</button>
    <small>Sketch and feature dimensions remain editable in this local project.</small>
  </form>
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

  const fileOpenIntentRef =
    useRef<FileOpenIntent>('view')

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

  const [primitiveDefinition, setPrimitiveDefinition] = useState<CadPrimitive>({
    type: 'box', width: 100, depth: 80, height: 20,
  })
  const [primitiveBodyId, setPrimitiveBodyId] = useState<string | null>(null)
  const [isCreatingPrimitive, setIsCreatingPrimitive] = useState(false)
  const [createMode, setCreateMode] = useState<'primitive' | 'features'>('features')
  const [featureModel, setFeatureModel] = useState<CadFeatureModel>({
    version: 1,
    features: [{ id: 'feature-1', type: 'sketchExtrude', name: 'Boss-Extrude1', plane: 'XY', profile: { type: 'rectangle', width: 100, height: 60 }, operation: 'boss', length: 10, reversed: false }],
  })
  const [featureModelBodyId, setFeatureModelBodyId] = useState<string | null>(null)
  const [measurementSummary, setMeasurementSummary] = useState<MeasurementSummary>({ selections: [] })
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('auto')
  const [sectionSettings, setSectionSettings] = useState<SectionSettings>(defaultSectionSettings)

  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(() => new Set())
  const [hiddenPartIds, setHiddenPartIds] = useState<Set<string>>(() => new Set())
  const [partColors, setPartColors] = useState<Map<string, string>>(() => new Map())
  const [partOpacities, setPartOpacities] = useState<Map<string, number>>(() => new Map())
  const [exportFormat, setExportFormat] = useState<MeshExportFormat>('stl')
  const [exportRatio, setExportRatio] = useState(1)
  const [exportScope, setExportScope] = useState<'selected' | 'visible'>('visible')
  const [isExporting, setIsExporting] = useState(false)

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
  const measuredProperties = useMemo(() => {
    const mesh = selectedPart?.faces ?? model?.faces
    if (!mesh) return null
    return calculateMeshProperties({ vertices: mesh.vertices, triangles: mesh.triangles })
  }, [model, selectedPart])
  const visibleParts = model?.renderParts.filter((part) => !hiddenPartIds.has(part.id)) ?? []
  const exportParts = exportScope === 'selected' ? selectedParts : visibleParts

  function downloadConvertedMesh() {
    if (!model || exportParts.length === 0) return
    setIsExporting(true)
    setError(null)
    try {
      const vertices: number[] = []
      const triangles: number[] = []
      for (const part of exportParts) {
        const vertexOffset = vertices.length / 3
        vertices.push(...part.faces.vertices)
        for (const index of part.faces.triangles) triangles.push(index + vertexOffset)
      }
      const converted = convertTriangleMesh(
        { vertices, triangles },
        {
          format: exportFormat,
          reductionRatio: activeTool === 'simplify' ? exportRatio : 1,
          fileName: model.fileName,
        },
      )
      const url = URL.createObjectURL(converted.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = converted.fileName
      link.click()
      URL.revokeObjectURL(url)
      setStatus(`Downloaded ${converted.fileName} with ${converted.triangleCount.toLocaleString()} triangles`)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'The mesh could not be converted.')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    function handleWorkspaceShortcuts(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedPartIds(new Set())
        return
      }

      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a' || !model) return

      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return

      event.preventDefault()
      setSelectedPartIds(new Set(model.renderParts.map((part) => part.id)))
    }

    window.addEventListener('keydown', handleWorkspaceShortcuts)
    return () => window.removeEventListener('keydown', handleWorkspaceShortcuts)
  }, [model])

  function installModel(nextModel: ImportedCadBody) {
    setModel(nextModel)
    setSelectedPartIds(new Set(nextModel.renderParts[0] ? [nextModel.renderParts[0].id] : []))
    setHiddenPartIds(new Set())
    setPartColors(new Map())
    setPartOpacities(new Map())
    if (nextModel.primitive) {
      setPrimitiveDefinition(nextModel.primitive)
      setPrimitiveBodyId(nextModel.bodyId)
    } else {
      setPrimitiveBodyId(null)
    }
    if (nextModel.featureModel) {
      setFeatureModel(nextModel.featureModel)
      setFeatureModelBodyId(nextModel.bodyId)
      setCreateMode('features')
    } else {
      setFeatureModelBodyId(null)
    }
  }

  function togglePartVisibility(partId: string) {
    setHiddenPartIds((current) => {
      const next = new Set(current)
      if (next.has(partId)) next.delete(partId)
      else next.add(partId)
      return next
    })
  }

  function selectPart(partId: string, additive: boolean) {
    setSelectedPartIds((current) => updateBodySelection(current, partId, additive))
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

  function setPartColor(partId: string, color: string) {
    setPartColors((current) => {
      const next = new Map(current)
      next.set(partId, color)
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

  function openFilePicker(intent: FileOpenIntent = 'view') {
    fileOpenIntentRef.current = intent
    fileInputRef.current?.click()
  }

  async function applyPrimitive(): Promise<void> {
    if (isCreatingPrimitive) return
    setIsCreatingPrimitive(true)
    setError(null)
    try {
      const previousBodyId = model?.bodyId
      const nextModel = primitiveBodyId && model?.bodyId === primitiveBodyId
        ? await updateCadPrimitive(primitiveBodyId, primitiveDefinition)
        : await createCadPrimitive(primitiveDefinition)
      installModel(nextModel)
      setPrimitiveBodyId(nextModel.bodyId)
      setFileName(nextModel.fileName)
      setStatus(`${nextModel.fileName} ${previousBodyId === nextModel.bodyId ? 'updated' : 'created'} locally`)
      await releaseSupersededCadBody(previousBodyId, nextModel.bodyId)
      await saveImportedModelRecovery(nextModel)
      window.setTimeout(() => sendViewCommand('fit'), 100)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'The part could not be created.')
      setStatus('Part creation failed')
    } finally {
      setIsCreatingPrimitive(false)
    }
  }

  async function applyFeatureModel(): Promise<void> {
    if (isCreatingPrimitive) return
    setIsCreatingPrimitive(true)
    setError(null)
    try {
      const previousBodyId = model?.bodyId
      const nextModel = featureModelBodyId && model?.bodyId === featureModelBodyId
        ? await updateCadFeatureModel(featureModelBodyId, featureModel)
        : await createCadFeatureModel(featureModel)
      installModel(nextModel)
      setFileName(nextModel.fileName)
      setStatus(`${nextModel.fileName} feature history rebuilt locally`)
      await releaseSupersededCadBody(previousBodyId, nextModel.bodyId)
      await saveImportedModelRecovery(nextModel)
      window.setTimeout(() => sendViewCommand('fit'), 100)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'The feature model could not be built.')
      setStatus('Feature rebuild failed')
    } finally {
      setIsCreatingPrimitive(false)
    }
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

      if (fileOpenIntentRef.current === 'convert') {
        setExportRatio(1)
        setActiveTool('convert')
      } else if (fileOpenIntentRef.current === 'reduce') {
        setExportRatio(0.5)
        setActiveTool('simplify')
      } else {
        setActiveTool('view')
      }

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
      fileOpenIntentRef.current = 'view'
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
            onClick={() => openFilePicker()}
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
            <button type="button" onClick={() => openFilePicker()} disabled={isLoading} title="Open a 3D model or resume saved CAD File Lab work">
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
            <button className={activeTool === 'view' ? 'active' : ''} type="button" aria-pressed={activeTool === 'view'} onClick={() => setActiveTool('view')}>
              <strong>View</strong><span>Navigate</span>
            </button>
            <button className={activeTool === 'measure' ? 'active' : ''} type="button" aria-pressed={activeTool === 'measure'} disabled={!model} onClick={() => { setSelectedPartIds(new Set()); setActiveTool('measure') }} title="Open measurement tools">
              <strong>Measure</strong><span>Inspect geometry</span>
            </button>
            <button className={activeTool === 'section' ? 'active' : ''} type="button" aria-pressed={activeTool === 'section'} disabled={!model} onClick={() => { setSelectedPartIds(new Set()); setActiveTool('section') }} title="Preview a non-destructive section">
              <strong>Section</strong><span>Cutaway view</span>
            </button>
          </div>
        </div>

        <div className="ribbon-group">
          <span className="ribbon-group-label">Model</span>
          <div>
            <button className={activeTool === 'create' ? 'active' : ''} type="button" aria-pressed={activeTool === 'create'} onClick={() => setActiveTool('create')}><strong>Create</strong><span>New body</span></button>
            <button type="button" disabled><strong>Modify</strong><span>Geometry</span></button>
            <button className={activeTool === 'simplify' ? 'active' : ''} type="button" aria-pressed={activeTool === 'simplify'} disabled={!model} onClick={() => setActiveTool('simplify')}><strong>Simplify</strong><span>Reduce size</span></button>
          </div>
        </div>

        <div className="ribbon-group">
          <span className="ribbon-group-label">Output</span>
          <div>
            <button className={activeTool === 'convert' ? 'active' : ''} type="button" aria-pressed={activeTool === 'convert'} disabled={!model} onClick={() => setActiveTool('convert')}><strong>Convert / Export</strong><span>Choose format</span></button>
          </div>
        </div>
      </nav>

      <section className={`workspace${activeTool === 'measure' ? ' measure-mode' : activeTool === 'section' ? ' section-mode' : ''}`} id="workspace">
        <aside className="sidebar">
          {activeTool === 'measure' && <section className="measure-manager" aria-label="Measure PropertyManager">
            <header><strong>Measure</strong><button type="button" aria-label="Close Measure" onClick={() => setActiveTool('view')}>×</button></header>
            <div className="measure-manager-tools">
              {(['auto', 'point', 'edge', 'face'] as const).map((mode) => <button key={mode} className={measurementMode === mode ? 'selected' : ''} type="button" onClick={() => { setMeasurementMode(mode); setMeasurementSummary({ selections: [] }) }}>{mode === 'auto' ? 'Auto' : mode[0].toUpperCase() + mode.slice(1)}</button>)}
            </div>
            <div className="measure-manager-selection"><span>Selected entities</span>{measurementSummary.selections.length ? measurementSummary.selections.map((selection) => <strong key={selection}>{selection}</strong>) : <small>Select geometry in the graphics area</small>}</div>
            <div className="measure-manager-results">
              {measurementSummary.distance !== undefined && <div><span>Minimum distance</span><strong>{formatSignedMillimetres(measurementSummary.distance)}</strong></div>}
              {measurementSummary.lineLength !== undefined && <div><span>Length</span><strong>{formatSignedMillimetres(measurementSummary.lineLength)}</strong></div>}
              {measurementSummary.radius !== undefined && <><div><span>Radius</span><strong>{formatSignedMillimetres(measurementSummary.radius)}</strong></div><div><span>Diameter</span><strong>{formatSignedMillimetres(measurementSummary.diameter ?? 0)}</strong></div></>}
              {measurementSummary.deltaX !== undefined && <><div><span>ΔX</span><strong>{formatSignedMillimetres(measurementSummary.deltaX)}</strong></div><div><span>ΔY</span><strong>{formatSignedMillimetres(measurementSummary.deltaY ?? 0)}</strong></div><div><span>ΔZ</span><strong>{formatSignedMillimetres(measurementSummary.deltaZ ?? 0)}</strong></div></>}
              {measurementSummary.faceGap !== undefined && <div><span>Normal distance</span><strong>{formatSignedMillimetres(measurementSummary.faceGap)}</strong></div>}
              {measurementSummary.faceAngle !== undefined && <div><span>Angle</span><strong>{measurementSummary.faceAngle.toFixed(2)}°</strong></div>}
            </div>
            {measuredProperties && <div className="measure-manager-properties">
              <span>Geometry properties</span>
              <div><span>Scope</span><strong>{selectedPart?.name ?? 'Whole model'}</strong></div>
              <div><span>Surface area</span><strong>{formatAreaMm2(measuredProperties.surfaceAreaMm2)}</strong></div>
              <div><span>Enclosed volume</span><strong>{measuredProperties.enclosedVolumeMm3 === null
                ? 'Unavailable · open mesh'
                : formatVolumeMm3(measuredProperties.enclosedVolumeMm3)}</strong></div>
              <small>Calculated from the displayed mesh.</small>
            </div>}
            <button type="button" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>Clear selection</button>
          </section>}
          {activeTool === 'section' && <section className="section-manager" aria-label="Section PropertyManager">
            <header><strong>Section view</strong><button type="button" aria-label="Close Section" onClick={() => setActiveTool('view')}>×</button></header>
            <small>Viewer-only preview · model geometry is unchanged</small>
            <label>
              <span>Plane</span>
              <select value={sectionSettings.axis} onChange={(event) => setSectionSettings((current) => ({ ...current, axis: event.target.value as SectionSettings['axis'] }))}>
                <option value="x">Right plane (X)</option>
                <option value="y">Front plane (Y)</option>
                <option value="z">Top plane (Z)</option>
              </select>
            </label>
            <label className="section-position-field">
              <span>Position</span><output>{Math.round(sectionSettings.position)}%</output>
              <input type="range" min="0" max="100" step="1" value={sectionSettings.position} onChange={(event) => setSectionSettings((current) => ({ ...current, position: Number(event.target.value) }))} />
            </label>
            <label className="section-check"><input type="checkbox" checked={sectionSettings.flip} onChange={(event) => setSectionSettings((current) => ({ ...current, flip: event.target.checked }))} /><span>Flip visible side</span></label>
            <button type="button" onClick={() => setSectionSettings(defaultSectionSettings)}>Reset section</button>
          </section>}
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

            {model || activeTool === 'create' ? (
              <ul>
                {model && <li className="model-tree-file">
                  <span aria-hidden="true">▾</span>
                  <strong title={model.fileName}>{model.fileName}</strong>
                </li>}
                {(model?.featureModel ?? (activeTool === 'create' ? featureModel : null)) && <>
                  <li className="feature-tree-folder"><span aria-hidden="true">⌄</span><strong>Origin</strong></li>
                  <li className="feature-tree-reference"><span aria-hidden="true">▱</span>Front Plane</li>
                  <li className="feature-tree-reference"><span aria-hidden="true">▱</span>Top Plane</li>
                  <li className="feature-tree-reference"><span aria-hidden="true">▱</span>Right Plane</li>
                  {(model?.featureModel ?? featureModel).features.map((feature, index) => <li className="feature-tree-group" key={`tree-${feature.id}`}>
                    {(feature.planeOffset || feature.planeAngle) && <div className="feature-tree-reference"><span aria-hidden="true">▱</span><span>Plane{index + 1}</span><small>{feature.plane}{feature.planeOffset ? ` · ${feature.planeOffset} mm` : ''}{feature.planeAngle ? ` · ${feature.planeAngle}°` : ''}</small></div>}
                    <div className="feature-tree-sketch"><span aria-hidden="true">⌗</span><span>Sketch{index + 1}</span><small>{feature.profile.type}</small></div>
                    <div className="feature-tree-feature"><span aria-hidden="true">▰</span><strong>{feature.name}</strong><small>{feature.operation === 'boss' ? 'Boss-Extrude' : 'Cut-Extrude'}</small></div>
                  </li>)}
                </>}
                {model?.bodySummaries.map((body) => (
                  <li
                    className={`model-tree-body${selectedPartIds.has(body.id) ? ' selected' : ''}${hiddenPartIds.has(body.id) ? ' hidden' : ''}`}
                    key={body.id}
                  >
                    <span aria-hidden="true">◇</span>
                    <button
                      className="body-select-button"
                      type="button"
                      onClick={(event) => selectPart(
                        body.id,
                        event.ctrlKey || event.metaKey || event.shiftKey,
                      )}
                      aria-pressed={selectedPartIds.has(body.id)}
                    >
                      <span className="body-color-dot" style={{ background: partColors.get(body.id) ?? displaySettings.modelColor }} aria-hidden="true" />
                      <span>{body.name}</span>
                    </button>
                    <input
                      className="body-color-input"
                      type="color"
                      value={partColors.get(body.id) ?? displaySettings.modelColor}
                      onChange={(event) => setPartColor(body.id, event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Change ${body.name} color`}
                      title={`Change ${body.name} color only`}
                    />
                    <button
                      className="body-visibility-button"
                      type="button"
                      onClick={() => togglePartVisibility(body.id)}
                      aria-label={`${hiddenPartIds.has(body.id) ? 'Show' : 'Hide'} ${body.name}`}
                      title={`${hiddenPartIds.has(body.id) ? 'Show' : 'Hide'} ${body.name}`}
                    >
                      {hiddenPartIds.has(body.id) ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.7 10.7 0 0112 4c5.5 0 9 5.2 9 5.2a15 15 0 01-2.3 2.7M6.2 6.3C4.2 7.7 3 9.2 3 9.2s3.5 5.2 9 5.2a10 10 0 003.1-.5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 12s3.5-5.2 9-5.2 9 5.2 9 5.2-3.5 5.2-9 5.2S3 12 3 12z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                      )}
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
            className={`viewport-placeholder ${activeTool === 'create' && createMode === 'features' ? 'sketch-mode' : ''}`}
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
            {activeTool === 'create' && createMode === 'features' ? (
              <SketchCreator model={featureModel} disabled={isCreatingPrimitive} onChange={setFeatureModel} onBuild={() => { void applyFeatureModel() }} />
            ) : <CadViewport
              model={model}
              settings={
                displaySettings
              }
              section={activeTool === 'section' ? sectionSettings : null}
              viewCommand={
                viewCommand
              }
              hiddenPartIds={hiddenPartIds}
              selectedPartIds={activeTool === 'measure' ? new Set<string>() : selectedPartIds}
              partColors={partColors}
              partOpacities={partOpacities}
              measurementEnabled={activeTool === 'measure'}
              measurementMode={measurementMode}
              onMeasurementChange={setMeasurementSummary}
              onSelectPart={selectPart}
              onClearSelection={() => setSelectedPartIds(new Set())}
            />}

            {error && (
              <div className="viewport-error" role="alert">
                <strong>Could not complete the operation</strong>
                <span>{error}</span>
              </div>
            )}

            {!model && !isLoading && activeTool !== 'create' && (
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
                <button className="primary-button" type="button" onClick={() => openFilePicker()}>
                  Choose a 3D file
                </button>
                <div className="start-actions">
                  <article>
                    <strong>View 3D file</strong>
                    <span>Inspect a model privately</span>
                    <button type="button" onClick={() => openFilePicker()}>Choose 3D file</button>
                  </article>
                  <article>
                    <strong>Create 3D file</strong>
                    <span>Design a new parametric part</span>
                    <button type="button" onClick={() => setActiveTool('create')}>Create part</button>
                  </article>
                  <article>
                    <strong>Create assembly</strong>
                    <span>Combine and position components</span>
                    <button type="button" disabled>New assembly · Planned</button>
                  </article>
                  <article>
                    <strong>Convert file</strong>
                    <span>Change to another 3D format</span>
                    <button type="button" onClick={() => openFilePicker('convert')}>Choose file</button>
                  </article>
                  <article>
                    <strong>Reduce file size</strong>
                    <span>Reduce mesh geometry locally</span>
                    <button type="button" onClick={() => openFilePicker('reduce')}>Choose file</button>
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

          {activeTool === 'create' && (
            <>
              <div className="primitive-panel">
                <label><span>Create type</span><select value={createMode} onChange={(event) => setCreateMode(event.target.value as 'primitive' | 'features')}>
                  <option value="features">Sketch and extrude</option><option value="primitive">Quick primitive</option>
                </select></label>
              </div>
              {createMode === 'primitive' ? <form className="primitive-panel" onSubmit={(event) => { event.preventDefault(); void applyPrimitive() }}>
              <span className="panel-label">Local solid creation</span>
              <label>
                <span>Primitive</span>
                <select
                  value={primitiveDefinition.type}
                  onChange={(event) => {
                    const type = event.target.value
                    setPrimitiveDefinition(type === 'box'
                      ? { type: 'box', width: 100, depth: 80, height: 20 }
                      : type === 'cylinder'
                        ? { type: 'cylinder', radius: 40, height: 60 }
                        : type === 'sphere'
                          ? { type: 'sphere', radius: 40 }
                          : { type: 'cone', baseRadius: 40, topRadius: 0, height: 60 })
                  }}
                >
                  <option value="box">Box</option>
                  <option value="cylinder">Cylinder</option>
                  <option value="sphere">Sphere</option>
                  <option value="cone">Cone / frustum</option>
                </select>
              </label>
              {primitiveDefinition.type === 'box' ? (
                <>
                  {(['width', 'depth', 'height'] as const).map((dimension) => (
                    <label key={dimension}>
                      <span>{dimension[0].toUpperCase() + dimension.slice(1)} (mm)</span>
                      <input type="number" min="0.01" max="1000000" step="0.01" required value={primitiveDefinition[dimension]}
                        onChange={(event) => setPrimitiveDefinition({ ...primitiveDefinition, [dimension]: Number(event.target.value) })} />
                    </label>
                  ))}
                </>
              ) : primitiveDefinition.type === 'cylinder' ? (
                <>
                  {(['radius', 'height'] as const).map((dimension) => (
                    <label key={dimension}>
                      <span>{dimension[0].toUpperCase() + dimension.slice(1)} (mm)</span>
                      <input type="number" min="0.01" max="1000000" step="0.01" required value={primitiveDefinition[dimension]}
                        onChange={(event) => setPrimitiveDefinition({ ...primitiveDefinition, [dimension]: Number(event.target.value) })} />
                    </label>
                  ))}
                </>
              ) : primitiveDefinition.type === 'sphere' ? (
                <label>
                  <span>Radius (mm)</span>
                  <input type="number" min="0.01" max="1000000" step="0.01" required value={primitiveDefinition.radius}
                    onChange={(event) => setPrimitiveDefinition({ ...primitiveDefinition, radius: Number(event.target.value) })} />
                </label>
              ) : (
                <>
                  {(['baseRadius', 'topRadius', 'height'] as const).map((dimension) => (
                    <label key={dimension}>
                      <span>{dimension === 'baseRadius' ? 'Base radius' : dimension === 'topRadius' ? 'Top radius' : 'Height'} (mm)</span>
                      <input type="number" min={dimension === 'topRadius' ? 0 : 0.01} max="1000000" step="0.01" required value={primitiveDefinition[dimension]}
                        onChange={(event) => setPrimitiveDefinition({ ...primitiveDefinition, [dimension]: Number(event.target.value) })} />
                    </label>
                  ))}
                </>
              )}
              <button className="primary-button" type="submit" disabled={isCreatingPrimitive}>
                {isCreatingPrimitive ? 'Building…' : primitiveBodyId && model?.bodyId === primitiveBodyId ? 'Update part' : 'Create part'}
              </button>
              <small>Created locally · Editable dimensions during this session</small>
              </form> : <section className="primitive-panel"><span className="panel-label">Sketch</span><p>Sketch tools and geometry are shown in the main graphics area. Select an entity there to edit its dimensions here.</p></section>}
            </>
          )}

          {model ? (
            <>
              {(activeTool === 'convert' || activeTool === 'simplify') && (
                <section className="conversion-panel" aria-labelledby="conversion-title">
                  <span className="panel-label">{activeTool === 'simplify' ? 'Local model reduction' : 'Local format conversion'}</span>
                  <h3 id="conversion-title">{activeTool === 'simplify' ? 'Reduce file size' : 'Convert file'}</h3>
                  <fieldset>
                    <legend>Export</legend>
                    <label title="Hidden bodies are excluded"><input type="radio" name="export-scope" checked={exportScope === 'visible'} onChange={() => setExportScope('visible')} /> Visible ({visibleParts.length})</label>
                    <label title="Selected bodies are included even when hidden"><input type="radio" name="export-scope" checked={exportScope === 'selected'} onChange={() => setExportScope('selected')} /> Selected ({selectedParts.length})</label>
                  </fieldset>
                  <label>
                    <span>Output format</span>
                    <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as MeshExportFormat)}>
                      <option value="stl">STL (binary)</option>
                      <option value="obj">OBJ</option>
                      <option value="ply">PLY</option>
                      <option value="glb">GLB</option>
                      <option value="gltf">glTF (embedded)</option>
                      <option value="3mf">3MF</option>
                    </select>
                  </label>
                  {activeTool === 'simplify' && (
                    <>
                      <label className="reduction-field">
                        <span>Keep model detail</span><output>{Math.round(exportRatio * 100)}%</output>
                        <input type="range" min="0.05" max="1" step="0.05" value={exportRatio} onChange={(event) => setExportRatio(Number(event.target.value))} />
                      </label>
                      <div className={`reduction-risk ${exportRatio >= 0.8 ? 'low' : exportRatio >= 0.5 ? 'medium' : 'high'}`} role="status">
                        <strong>{exportRatio === 1 ? 'No reduction risk' : exportRatio >= 0.8 ? 'Low risk' : exportRatio >= 0.5 ? 'Moderate risk' : 'High risk'}</strong>
                        <span>{exportRatio === 1
                          ? 'The complete mesh detail is retained.'
                          : exportRatio >= 0.8
                            ? 'Small visual differences may appear.'
                            : exportRatio >= 0.5
                              ? 'Fine curves and small features may lose detail.'
                              : 'Small holes, thin walls and fine geometry may be damaged.'}</span>
                      </div>
                    </>
                  )}
                  <button className="primary-button" type="button" disabled={isExporting || exportParts.length === 0} onClick={downloadConvertedMesh}>
                    {isExporting ? 'Converting…' : `Download ${exportFormat.toUpperCase()}`}
                  </button>
                  {exportParts.length === 0 && <p className="conversion-warning">Choose at least one body for this export scope.</p>}
                  <small>Local only · Original unchanged</small>
                </section>
              )}
              {selectedPart && (
                <section className="body-properties">
                  <span className="panel-label">
                    {selectedParts.length > 1 ? 'Selected bodies controls' : 'Selected body controls'}
                  </span>
                  <label>
                    <span>{selectedParts.length > 1 ? 'Selected bodies color' : 'Selected body color'}</span>
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
