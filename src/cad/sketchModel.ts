export type SketchPoint = [number, number]

interface SketchEntityBase {
  id: string
  construction?: boolean
}

export type SketchEntity =
  | (SketchEntityBase & { type: 'line'; start: SketchPoint; end: SketchPoint })
  | (SketchEntityBase & { type: 'circle'; center: SketchPoint; radius: number })
  | (SketchEntityBase & { type: 'arc'; center: SketchPoint; radius: number; startAngle: number; endAngle: number })

export type SketchConstraint =
  | { id: string; type: 'coincident'; firstEntityId: string; firstEnd: 'start' | 'end'; secondEntityId: string; secondEnd: 'start' | 'end' }
  | { id: string; type: 'horizontal' | 'vertical'; entityId: string }
  | { id: string; type: 'parallel' | 'perpendicular' | 'equal'; firstEntityId: string; secondEntityId: string }
  | { id: string; type: 'fixed'; entityId: string }

export type SketchDimension =
  | { id: string; type: 'length'; entityId: string; value: number; position: SketchPoint }
  | { id: string; type: 'radius' | 'diameter'; entityId: string; value: number; position: SketchPoint }
  | { id: string; type: 'distanceX' | 'distanceY'; firstEntityId: string; secondEntityId?: string; value: number; position: SketchPoint }
  | { id: string; type: 'angle'; firstEntityId: string; secondEntityId: string; value: number; position: SketchPoint }

export interface SketchDocument {
  version: 1
  entities: SketchEntity[]
  constraints: SketchConstraint[]
  dimensions: SketchDimension[]
}

export interface SketchEditorState {
  document: SketchDocument
  selectedEntityIds: string[]
  undoStack: SketchDocument[]
  redoStack: SketchDocument[]
}

const cloneDocument = (document: SketchDocument): SketchDocument => structuredClone(document)

export function createSketchEditorState(document?: SketchDocument): SketchEditorState {
  return {
    document: document ? validateSketchDocument(document) : { version: 1, entities: [], constraints: [], dimensions: [] },
    selectedEntityIds: [], undoStack: [], redoStack: [],
  }
}

export type SketchAction =
  | { type: 'addEntity'; entity: SketchEntity }
  | { type: 'addRectangle'; idPrefix: string; corners: [SketchPoint, SketchPoint] }
  | { type: 'updateEntity'; entity: SketchEntity }
  | { type: 'removeEntities'; entityIds: string[] }
  | { type: 'addConstraint'; constraint: SketchConstraint }
  | { type: 'addDimension'; dimension: SketchDimension }
  | { type: 'setDimension'; dimensionId: string; value: number }
  | { type: 'select'; entityId: string; additive?: boolean }
  | { type: 'clearSelection' }
  | { type: 'undo' }
  | { type: 'redo' }

function commit(state: SketchEditorState, document: SketchDocument): SketchEditorState {
  return { document: validateSketchDocument(document), selectedEntityIds: state.selectedEntityIds, undoStack: [...state.undoStack, cloneDocument(state.document)].slice(-100), redoStack: [] }
}

/** A first, deliberately bounded constraint solver for line-based sketches.
 * Driving dimensions preserve the first endpoint while moving the second.
 * Fixed geometry is never moved. More complex CAD relations need a full solver.
 */
export function solveSketchDocument(input: SketchDocument): SketchDocument {
  const document = cloneDocument(input)
  const fixed = new Set(document.constraints.filter((c) => c.type === 'fixed').map((c) => 'entityId' in c ? c.entityId : ''))
  const getLine = (id: string) => document.entities.find((e): e is Extract<SketchEntity, { type: 'line' }> => e.id === id && e.type === 'line')
  for (let iteration = 0; iteration < 4; iteration++) {
    for (const constraint of document.constraints) {
      if (!('entityId' in constraint) || fixed.has(constraint.entityId)) continue
      const line = getLine(constraint.entityId)
      if (!line) continue
      if (constraint.type === 'horizontal') line.end = [line.end[0], line.start[1]]
      if (constraint.type === 'vertical') line.end = [line.start[0], line.end[1]]
    }
    for (const dimension of document.dimensions) {
      if (!('entityId' in dimension) || fixed.has(dimension.entityId)) continue
      const entity = document.entities.find((item) => item.id === dimension.entityId)
      if (!entity) continue
      if ((dimension.type === 'radius' || dimension.type === 'diameter') && (entity.type === 'circle' || entity.type === 'arc')) entity.radius = dimension.type === 'diameter' ? dimension.value / 2 : dimension.value
      if (dimension.type === 'length' && entity.type === 'line') {
        const dx = entity.end[0] - entity.start[0]; const dy = entity.end[1] - entity.start[1]
        const length = Math.hypot(dx, dy)
        if (length > 1e-8) entity.end = [entity.start[0] + dx * dimension.value / length, entity.start[1] + dy * dimension.value / length]
      }
    }
  }
  return validateSketchDocument(document)
}

export function reduceSketch(state: SketchEditorState, action: SketchAction): SketchEditorState {
  if (action.type === 'select') {
    const selected = state.selectedEntityIds.includes(action.entityId)
    return { ...state, selectedEntityIds: action.additive ? (selected ? state.selectedEntityIds.filter((id) => id !== action.entityId) : [...state.selectedEntityIds, action.entityId]) : selected && state.selectedEntityIds.length === 1 ? [] : [action.entityId] }
  }
  if (action.type === 'clearSelection') return { ...state, selectedEntityIds: [] }
  if (action.type === 'undo') {
    const previous = state.undoStack.at(-1)
    if (!previous) return state
    return { document: previous, selectedEntityIds: [], undoStack: state.undoStack.slice(0, -1), redoStack: [cloneDocument(state.document), ...state.redoStack].slice(0, 100) }
  }
  if (action.type === 'redo') {
    const next = state.redoStack[0]
    if (!next) return state
    return { document: next, selectedEntityIds: [], undoStack: [...state.undoStack, cloneDocument(state.document)].slice(-100), redoStack: state.redoStack.slice(1) }
  }
  if (action.type === 'addEntity') return commit(state, { ...state.document, entities: [...state.document.entities, action.entity] })
  if (action.type === 'addRectangle') {
    const [a, b] = action.corners
    const x1 = Math.min(a[0], b[0]); const x2 = Math.max(a[0], b[0]); const y1 = Math.min(a[1], b[1]); const y2 = Math.max(a[1], b[1])
    if (x2 - x1 < 1e-8 || y2 - y1 < 1e-8) return state
    const corners: SketchPoint[] = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    const entities: SketchEntity[] = corners.map((start, index) => ({ id: `${action.idPrefix}-${index}`, type: 'line', start, end: corners[(index + 1) % 4] }))
    const constraints: SketchConstraint[] = entities.map((entity, index) => ({ id: `${action.idPrefix}-orientation-${index}`, type: index % 2 === 0 ? 'horizontal' : 'vertical', entityId: entity.id }))
    return commit(state, { ...state.document, entities: [...state.document.entities, ...entities], constraints: [...state.document.constraints, ...constraints] })
  }
  if (action.type === 'updateEntity') return commit(state, solveSketchDocument({ ...state.document, entities: state.document.entities.map((entity) => entity.id === action.entity.id ? action.entity : entity) }))
  if (action.type === 'addConstraint') return commit(state, { ...state.document, constraints: [...state.document.constraints, action.constraint] })
  if (action.type === 'addDimension') return commit(state, solveSketchDocument({ ...state.document, dimensions: [...state.document.dimensions, action.dimension] }))
  if (action.type === 'setDimension') {
    if (!Number.isFinite(action.value) || action.value <= 0 || !state.document.dimensions.some((dimension) => dimension.id === action.dimensionId)) return state
    return commit(state, solveSketchDocument({ ...state.document, dimensions: state.document.dimensions.map((dimension) => dimension.id === action.dimensionId ? { ...dimension, value: action.value } : dimension) }))
  }
  const removed = new Set(action.entityIds)
  return commit(state, {
    ...state.document,
    entities: state.document.entities.filter((entity) => !removed.has(entity.id)),
    constraints: state.document.constraints.filter((constraint) => !constraintReferences(constraint).some((id) => removed.has(id))),
    dimensions: state.document.dimensions.filter((dimension) => !dimensionReferences(dimension).some((id) => removed.has(id))),
  })
}

function constraintReferences(constraint: SketchConstraint): string[] {
  return 'entityId' in constraint ? [constraint.entityId] : [constraint.firstEntityId, constraint.secondEntityId]
}

function dimensionReferences(dimension: SketchDimension): string[] {
  return 'entityId' in dimension ? [dimension.entityId] : [dimension.firstEntityId, ...(dimension.secondEntityId ? [dimension.secondEntityId] : [])]
}

const validPoint = (point: SketchPoint) => Array.isArray(point) && point.length === 2 && point.every((value) => Number.isFinite(value) && Math.abs(value) <= 1_000_000)

export function validateSketchDocument(input: SketchDocument): SketchDocument {
  if (!input || input.version !== 1 || !Array.isArray(input.entities) || !Array.isArray(input.constraints) || !Array.isArray(input.dimensions)) throw new Error('The sketch document is invalid.')
  if (input.entities.length > 10_000) throw new Error('The sketch contains too many entities.')
  const ids = new Set<string>()
  const entities = input.entities.map((entity): SketchEntity => {
    if (!entity || typeof entity.id !== 'string' || !entity.id || ids.has(entity.id)) throw new Error('Every sketch entity needs a unique ID.')
    ids.add(entity.id)
    if (entity.type === 'line') {
      if (!validPoint(entity.start) || !validPoint(entity.end) || Math.hypot(entity.end[0] - entity.start[0], entity.end[1] - entity.start[1]) < 1e-8) throw new Error('A sketch line needs two different valid points.')
    } else if (entity.type === 'circle' || entity.type === 'arc') {
      if (!validPoint(entity.center) || !Number.isFinite(entity.radius) || entity.radius <= 0 || entity.radius > 1_000_000) throw new Error('A sketch circle or arc needs a valid center and radius.')
      if (entity.type === 'arc' && (!Number.isFinite(entity.startAngle) || !Number.isFinite(entity.endAngle))) throw new Error('A sketch arc needs valid angles.')
    } else throw new Error('The sketch contains an unsupported entity.')
    return structuredClone(entity)
  })
  for (const constraint of input.constraints) {
    if (!constraint || typeof constraint.id !== 'string' || constraintReferences(constraint).some((id) => !ids.has(id))) throw new Error('A sketch constraint references a missing entity.')
  }
  for (const dimension of input.dimensions) {
    if (!dimension || typeof dimension.id !== 'string' || !Number.isFinite(dimension.value) || !validPoint(dimension.position) || dimensionReferences(dimension).some((id) => !ids.has(id))) throw new Error('A sketch dimension is invalid.')
  }
  return { version: 1, entities, constraints: structuredClone(input.constraints), dimensions: structuredClone(input.dimensions) }
}

export function getEntityEndpoints(entity: SketchEntity): SketchPoint[] {
  if (entity.type === 'line') return [entity.start, entity.end]
  if (entity.type === 'circle') return []
  const radians = (degrees: number) => degrees * Math.PI / 180
  return [entity.startAngle, entity.endAngle].map((angle) => [entity.center[0] + entity.radius * Math.cos(radians(angle)), entity.center[1] + entity.radius * Math.sin(radians(angle))])
}

export function snapSketchPoint(point: SketchPoint, document: SketchDocument, previous?: SketchPoint, tolerance = 8): { point: SketchPoint; inference?: 'coincident' | 'horizontal' | 'vertical' } {
  for (const entity of document.entities) for (const endpoint of getEntityEndpoints(entity)) {
    if (Math.hypot(point[0] - endpoint[0], point[1] - endpoint[1]) <= tolerance) return { point: endpoint, inference: 'coincident' }
  }
  if (previous && Math.abs(point[0] - previous[0]) <= tolerance) return { point: [previous[0], point[1]], inference: 'vertical' }
  if (previous && Math.abs(point[1] - previous[1]) <= tolerance) return { point: [point[0], previous[1]], inference: 'horizontal' }
  return { point }
}
