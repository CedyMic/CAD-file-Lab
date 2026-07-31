import {
  validateCadFeatureDocument,
  validateModelSpaceSketch,
  type CadFeatureDocument,
  type CadFeatureModel,
  type ModelSpaceSketchDefinition,
  type ModelSpaceSketchEntity,
  type ModelSpaceSketchPoint,
  type ModelSpaceSketchRelation,
} from './featureModel.ts'
import {
  validateSketchDocument,
  type SketchConstraint,
  type SketchDocument,
  type SketchEntity,
  type SketchPoint,
} from './sketchModel.ts'
import { validateClosedContour } from './sketchContours.ts'

export type SketchAdapterErrorCode =
  | 'unsupported-arc'
  | 'unsupported-dimension'
  | 'unsupported-relation'
  | 'unrepresentable-coincident'

export class SketchAdapterError extends Error {
  readonly code: SketchAdapterErrorCode

  constructor(code: SketchAdapterErrorCode, message: string) {
    super(message)
    this.name = 'SketchAdapterError'
    this.code = code
  }
}

type EndpointName = 'start' | 'end'
interface EndpointReference { entityId: string; end: EndpointName }

const coordinateKey = ([x, y]: SketchPoint) => `${Object.is(x, -0) ? 0 : x}\u0000${Object.is(y, -0) ? 0 : y}`
const endpointKey = (entityId: string, end: EndpointName) => `${entityId}\u0000${end}`

function allocateId(base: string, used: Set<string>): string {
  const normalized = base.replace(/[^a-z0-9._:-]+/gi, '-').replace(/^-+|-+$/g, '') || 'item'
  let candidate = normalized.slice(0, 100)
  let suffix = 2
  while (used.has(candidate)) {
    const tail = `-${suffix++}`
    candidate = `${normalized.slice(0, 100 - tail.length)}${tail}`
  }
  used.add(candidate)
  return candidate
}

/** Convert the current coordinate-entity editor document into the canonical V2 model-space graph. */
export function sketchDocumentToModelSpace(input: SketchDocument): ModelSpaceSketchDefinition {
  const document = validateSketchDocument(input)
  if (document.dimensions.length) throw new SketchAdapterError('unsupported-dimension', 'V1 sketch dimensions cannot be represented by the current V2 sketch schema.')
  if (document.entities.some((entity) => entity.type === 'arc')) throw new SketchAdapterError('unsupported-arc', 'Arc entities require the V2 arc schema before they can be migrated.')

  const usedPointIds = new Set<string>()
  const pointByCoordinate = new Map<string, ModelSpaceSketchPoint>()
  const endpointPointIds = new Map<string, string>()
  const points: ModelSpaceSketchPoint[] = []
  const entities: ModelSpaceSketchEntity[] = []

  const pointFor = (coordinate: SketchPoint, suggestedId: string): ModelSpaceSketchPoint => {
    const key = coordinateKey(coordinate)
    const existing = pointByCoordinate.get(key)
    if (existing) return existing
    const point = { id: allocateId(suggestedId, usedPointIds), x: coordinate[0], y: coordinate[1] }
    pointByCoordinate.set(key, point)
    points.push(point)
    return point
  }

  for (const entity of document.entities) {
    if (entity.type === 'line') {
      const start = pointFor(entity.start, `${entity.id}-start`)
      const end = pointFor(entity.end, `${entity.id}-end`)
      endpointPointIds.set(endpointKey(entity.id, 'start'), start.id)
      endpointPointIds.set(endpointKey(entity.id, 'end'), end.id)
      entities.push({ id: entity.id, type: 'line', startPointId: start.id, endPointId: end.id, ...(entity.construction ? { construction: true } : {}) })
    } else if (entity.type === 'circle') {
      const center = pointFor(entity.center, `${entity.id}-center`)
      entities.push({ id: entity.id, type: 'circle', centerPointId: center.id, radius: entity.radius, ...(entity.construction ? { construction: true } : {}) })
    }
  }

  const relations: ModelSpaceSketchRelation[] = []
  for (const constraint of document.constraints) {
    if (constraint.type === 'horizontal' || constraint.type === 'vertical' || constraint.type === 'fixed') {
      relations.push({ id: constraint.id, type: constraint.type, entityId: constraint.entityId })
    } else if (constraint.type === 'parallel' || constraint.type === 'perpendicular' || constraint.type === 'equal') {
      relations.push({ id: constraint.id, type: constraint.type, firstEntityId: constraint.firstEntityId, secondEntityId: constraint.secondEntityId })
    } else if (constraint.type === 'coincident') {
      const firstPointId = endpointPointIds.get(endpointKey(constraint.firstEntityId, constraint.firstEnd))
      const secondPointId = endpointPointIds.get(endpointKey(constraint.secondEntityId, constraint.secondEnd))
      if (!firstPointId || !secondPointId) throw new SketchAdapterError('unrepresentable-coincident', 'A coincident constraint must reference two line endpoints.')
      // Equal-coordinate endpoints already share one canonical point, which preserves the relation topologically.
      if (firstPointId !== secondPointId) relations.push({ id: constraint.id, type: 'coincident', firstPointId, secondPointId })
    } else throw new SketchAdapterError('unsupported-relation', 'The sketch contains a relation that the V2 schema does not support.')
  }

  return validateModelSpaceSketch({ version: 2, points, entities, relations })
}

function representativeEndpoint(
  pointId: string,
  endpointsByPointId: Map<string, EndpointReference[]>,
): EndpointReference {
  const endpoint = endpointsByPointId.get(pointId)?.[0]
  if (!endpoint) throw new SketchAdapterError('unrepresentable-coincident', 'A V2 coincident relation cannot be represented without line endpoints.')
  return endpoint
}

/** Convert a canonical V2 graph back to the current editor shape without losing shared-endpoint semantics. */
export function modelSpaceToSketchDocument(input: ModelSpaceSketchDefinition): SketchDocument {
  const sketch = validateModelSpaceSketch(input)
  const pointById = new Map(sketch.points.map((point) => [point.id, point]))
  const endpointsByPointId = new Map<string, EndpointReference[]>()
  const entities: SketchEntity[] = sketch.entities.map((entity): SketchEntity => {
    if (entity.type === 'circle') {
      const center = pointById.get(entity.centerPointId)!
      return { id: entity.id, type: 'circle', center: [center.x, center.y], radius: entity.radius, ...(entity.construction ? { construction: true } : {}) }
    }
    const start = pointById.get(entity.startPointId)!
    const end = pointById.get(entity.endPointId)!
    const startRef = { entityId: entity.id, end: 'start' as const }
    const endRef = { entityId: entity.id, end: 'end' as const }
    endpointsByPointId.set(entity.startPointId, [...(endpointsByPointId.get(entity.startPointId) ?? []), startRef])
    endpointsByPointId.set(entity.endPointId, [...(endpointsByPointId.get(entity.endPointId) ?? []), endRef])
    return { id: entity.id, type: 'line', start: [start.x, start.y], end: [end.x, end.y], ...(entity.construction ? { construction: true } : {}) }
  })

  const constraints: SketchConstraint[] = []
  const usedConstraintIds = new Set<string>()
  for (const relation of sketch.relations) {
    usedConstraintIds.add(relation.id)
    if ('entityId' in relation) constraints.push({ id: relation.id, type: relation.type, entityId: relation.entityId })
    else if ('firstEntityId' in relation) constraints.push({ id: relation.id, type: relation.type, firstEntityId: relation.firstEntityId, secondEntityId: relation.secondEntityId })
    else {
      const first = representativeEndpoint(relation.firstPointId, endpointsByPointId)
      const second = representativeEndpoint(relation.secondPointId, endpointsByPointId)
      constraints.push({ id: relation.id, type: 'coincident', firstEntityId: first.entityId, firstEnd: first.end, secondEntityId: second.entityId, secondEnd: second.end })
    }
  }

  // V1 has no shared point object, so recreate coincident constraints for every additional endpoint using a point.
  for (const [pointId, references] of endpointsByPointId) {
    for (let index = 1; index < references.length; index += 1) {
      const first = references[0]
      const second = references[index]
      constraints.push({
        id: allocateId(`coincident-${pointId}-${index}`, usedConstraintIds),
        type: 'coincident',
        firstEntityId: first.entityId,
        firstEnd: first.end,
        secondEntityId: second.entityId,
        secondEnd: second.end,
      })
    }
  }

  return validateSketchDocument({ version: 1, entities, constraints, dimensions: [] })
}

export type ClosedProfileDiagnostic =
  | 'empty'
  | 'open'
  | 'zero-length'
  | 'duplicate'
  | 'self-intersecting'
  | 'missing-point'
  | 'multiple-contours'

export type CanonicalClosedProfile =
  | { type: 'polyline'; pointIds: string[]; points: Array<{ x: number; y: number }> }
  | { type: 'circle'; centerPointId: string; center: { x: number; y: number }; radius: number }

export type ClosedProfileResult =
  | { valid: true; profile: CanonicalClosedProfile }
  | { valid: false; diagnostic: ClosedProfileDiagnostic }

/** Derive one buildable, non-construction closed profile and explain why a sketch is not buildable. */
export function deriveClosedSketchProfile(input: ModelSpaceSketchDefinition): ClosedProfileResult {
  const sketch = validateModelSpaceSketch(input)
  const active = sketch.entities.filter((entity) => entity.construction !== true)
  const circles = active.filter((entity): entity is Extract<ModelSpaceSketchEntity, { type: 'circle' }> => entity.type === 'circle')
  const lines = active.filter((entity): entity is Extract<ModelSpaceSketchEntity, { type: 'line' }> => entity.type === 'line')
  const pointById = new Map(sketch.points.map((point) => [point.id, point]))
  if (circles.length === 1 && lines.length === 0) {
    const circle = circles[0]
    const center = pointById.get(circle.centerPointId)!
    return { valid: true, profile: { type: 'circle', centerPointId: center.id, center: { x: center.x, y: center.y }, radius: circle.radius } }
  }
  if (circles.length || (lines.length === 0 && active.length)) return { valid: false, diagnostic: 'multiple-contours' }
  const contour = validateClosedContour(sketch.points, lines)
  if (!contour.valid) return { valid: false, diagnostic: contour.reason ?? 'open' }

  const pointIds = [lines[0].startPointId]
  const unused = new Map(lines.map((line) => [line.id, line]))
  let current = lines[0].startPointId
  while (unused.size) {
    const next = [...unused.values()].find((line) => line.startPointId === current || line.endPointId === current)
    if (!next) return { valid: false, diagnostic: 'open' }
    unused.delete(next.id)
    current = next.startPointId === current ? next.endPointId : next.startPointId
    if (current !== pointIds[0]) pointIds.push(current)
  }
  return { valid: true, profile: { type: 'polyline', pointIds, points: pointIds.map((id) => ({ x: pointById.get(id)!.x, y: pointById.get(id)!.y })) } }
}

/** Open a canonical history in the current sketch editor without changing the saved V2 source. */
export function cadFeatureDocumentToLegacyModel(input: CadFeatureDocument): CadFeatureModel {
  const document = validateCadFeatureDocument(input)
  const sketches = new Map(document.features.filter((feature) => feature.type === 'sketch').map((feature) => [feature.id, feature]))
  const referencePlanes = new Map(document.features.filter((feature) => feature.type === 'referencePlane').map((feature) => [feature.id, feature]))
  const resolveSupport = (support: Extract<typeof document.features[number], { type: 'sketch' }>['support']) => {
    if (support.kind === 'planarFace') throw new SketchAdapterError('unsupported-relation', 'Sketches on model faces are not editable in the current sketch UI yet.')
    if (support.kind === 'principal') return { plane: support.plane }
    const reference = referencePlanes.get(support.featureId)
    if (!reference || reference.reference.kind !== 'principal') throw new SketchAdapterError('unsupported-relation', 'Nested reference planes are not editable in the current sketch UI yet.')
    return {
      plane: reference.reference.plane,
      ...(reference.offset ? { planeOffset: reference.offset } : {}),
      ...(reference.angle ? { planeAngle: reference.angle.degrees, planeAngleAxis: reference.angle.axis === 'v' ? 'vertical' as const : 'horizontal' as const } : {}),
    }
  }
  const features = document.features.filter((feature) => feature.type === 'extrude').map((feature) => {
    const sketch = sketches.get(feature.sketchId)
    if (!sketch) throw new Error('The extrusion references a missing sketch.')
    const derived = deriveClosedSketchProfile(sketch.sketch)
    if (!derived.valid) throw new Error(`The sketch is not buildable: ${derived.diagnostic}.`)
    return {
      id: feature.id,
      type: 'sketchExtrude' as const,
      name: feature.name,
      ...resolveSupport(sketch.support),
      profile: derived.profile.type === 'circle'
        ? { type: 'circle' as const, radius: derived.profile.radius }
        : { type: 'polyline' as const, points: derived.profile.points.map((point): [number, number] => [point.x, point.y]) },
      operation: feature.operation,
      length: feature.distance,
      reversed: feature.reversed,
    }
  })
  return { version: 1, features }
}
