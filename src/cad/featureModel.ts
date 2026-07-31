import { MAX_PRIMITIVE_DIMENSION_MM } from './primitive.ts'

export type SketchPlane = 'XY' | 'XZ' | 'YZ'
export type SketchProfile =
  | { type: 'rectangle'; width: number; height: number }
  | { type: 'circle'; radius: number }
  | { type: 'polyline'; points: Array<[number, number]> }

export interface SketchExtrudeFeature {
  id: string
  type: 'sketchExtrude'
  name: string
  plane: SketchPlane
  planeOffset?: number
  planeAngle?: number
  planeAngleAxis?: 'horizontal' | 'vertical'
  profile: SketchProfile
  operation: 'boss' | 'cut'
  length: number
  reversed: boolean
}

export interface CadFeatureModel {
  version: 1
  features: SketchExtrudeFeature[]
}

export interface ModelSpaceSketchPoint {
  id: string
  x: number
  y: number
}

export type ModelSpaceSketchEntity =
  | { id: string; type: 'line'; startPointId: string; endPointId: string; construction?: boolean }
  | { id: string; type: 'circle'; centerPointId: string; radius: number; construction?: boolean }

export type ModelSpaceSketchRelation =
  | { id: string; type: 'horizontal' | 'vertical' | 'fixed'; entityId: string }
  | { id: string; type: 'parallel' | 'perpendicular' | 'equal'; firstEntityId: string; secondEntityId: string }
  | { id: string; type: 'coincident'; firstPointId: string; secondPointId: string }

export interface ModelSpaceSketchDefinition {
  version: 2
  points: ModelSpaceSketchPoint[]
  entities: ModelSpaceSketchEntity[]
  relations: ModelSpaceSketchRelation[]
}

export type SketchSupportPlane =
  | { kind: 'principal'; plane: SketchPlane }
  | { kind: 'referencePlane'; featureId: string }
  | { kind: 'planarFace'; bodyId: string; topologyRevision: number; faceId: number }

export interface ReferencePlaneFeatureDefinition {
  id: string
  type: 'referencePlane'
  name: string
  reference: SketchSupportPlane
  offset: number
  angle?: { degrees: number; axis: 'u' | 'v' }
}

export interface SketchFeatureDefinition {
  id: string
  type: 'sketch'
  name: string
  support: SketchSupportPlane
  sketch: ModelSpaceSketchDefinition
}

export interface ExtrudeFeatureDefinition {
  id: string
  type: 'extrude'
  name: string
  sketchId: string
  operation: 'boss' | 'cut'
  distance: number
  reversed: boolean
}

export type CadFeatureDefinition =
  | ReferencePlaneFeatureDefinition
  | SketchFeatureDefinition
  | ExtrudeFeatureDefinition

export interface CadFeatureDocument {
  version: 2
  features: CadFeatureDefinition[]
}

export type CadFeatureHistory = CadFeatureModel | CadFeatureDocument

function dimension(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_PRIMITIVE_DIMENSION_MM) {
    throw new Error(`${label} must be greater than zero and no more than ${MAX_PRIMITIVE_DIMENSION_MM.toLocaleString('en-US')} mm.`)
  }
  return value
}

function signedOffset(value: number | undefined): number {
  const offset = value ?? 0
  if (!Number.isFinite(offset) || Math.abs(offset) > MAX_PRIMITIVE_DIMENSION_MM) {
    throw new Error(`Plane offset must be between -${MAX_PRIMITIVE_DIMENSION_MM.toLocaleString('en-US')} and ${MAX_PRIMITIVE_DIMENSION_MM.toLocaleString('en-US')} mm.`)
  }
  return offset
}

export function validateCadFeatureModel(input: CadFeatureModel): CadFeatureModel {
  if (!input || input.version !== 1 || !Array.isArray(input.features) || input.features.length === 0) {
    throw new Error('The feature history must contain at least one supported feature.')
  }
  if (input.features.length > 200) throw new Error('The feature history cannot contain more than 200 features.')
  const ids = new Set<string>()
  const features = input.features.map((feature, index): SketchExtrudeFeature => {
    if (!feature || feature.type !== 'sketchExtrude') throw new Error('The feature history contains an unsupported feature.')
    if (!['XY', 'XZ', 'YZ'].includes(feature.plane)) throw new Error('Choose the XY, XZ, or YZ sketch plane.')
    if (!['boss', 'cut'].includes(feature.operation)) throw new Error('Choose a boss extrude or cut operation.')
    if (index === 0 && feature.operation !== 'boss') throw new Error('The first feature must be a boss extrude.')
    if (typeof feature.id !== 'string' || !feature.id || feature.id.length > 100 || ids.has(feature.id)) throw new Error('Every feature needs a unique valid ID.')
    ids.add(feature.id)
    if (typeof feature.name !== 'string' || !feature.name.trim() || feature.name.length > 100) throw new Error('Every feature needs a valid name.')
    const profile = feature.profile
    if (!profile || !['rectangle', 'circle', 'polyline'].includes(profile.type)) throw new Error('Choose a supported closed sketch profile.')
    const cleanProfile: SketchProfile = profile.type === 'rectangle'
      ? { type: 'rectangle', width: dimension(profile.width, 'Sketch width'), height: dimension(profile.height, 'Sketch height') }
      : profile.type === 'circle'
        ? { type: 'circle', radius: dimension(profile.radius, 'Sketch radius') }
        : {
            type: 'polyline',
            points: profile.points.map((point) => {
              if (!Array.isArray(point) || point.length !== 2 || point.some((value) => !Number.isFinite(value) || Math.abs(value) > MAX_PRIMITIVE_DIMENSION_MM)) throw new Error('Every sketch point must contain two valid coordinates.')
              return [point[0], point[1]]
            }),
          }
    if (cleanProfile.type === 'polyline' && cleanProfile.points.length < 3) throw new Error('A closed line sketch needs at least three points.')
    const planeOffset = signedOffset(feature.planeOffset)
    const planeAngle = feature.planeAngle ?? 0
    if (!Number.isFinite(planeAngle) || Math.abs(planeAngle) > 360) throw new Error('Plane angle must be between -360 and 360 degrees.')
    const planeAngleAxis = feature.planeAngleAxis ?? 'horizontal'
    if (!['horizontal', 'vertical'].includes(planeAngleAxis)) throw new Error('Choose a horizontal or vertical plane rotation axis.')
    return {
      id: feature.id,
      type: 'sketchExtrude',
      name: feature.name.trim(),
      plane: feature.plane,
      ...(planeOffset === 0 ? {} : { planeOffset }),
      ...(planeAngle === 0 ? {} : { planeAngle, planeAngleAxis }),
      profile: cleanProfile,
      operation: feature.operation,
      length: dimension(feature.length, 'Extrude length'),
      reversed: feature.reversed === true,
    }
  })
  return { version: 1, features }
}

export function getFeatureModelFileName(model: CadFeatureHistory): string {
  const validated = normalizeCadFeatureDocument(model)
  const firstSolid = validated.features.find((feature) => feature.type === 'extrude')
  const name = (firstSolid?.name ?? 'Feature-model').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return `${name || 'Feature-model'}.step`
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 100
}

function finiteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_PRIMITIVE_DIMENSION_MM
}

function validateSupportPlane(
  support: SketchSupportPlane,
  earlierReferencePlanes: Set<string>,
): SketchSupportPlane {
  if (!support || typeof support !== 'object') throw new Error('The sketch support plane is invalid.')
  if (support.kind === 'principal') {
    if (!['XY', 'XZ', 'YZ'].includes(support.plane)) throw new Error('The principal sketch plane is invalid.')
  } else if (support.kind === 'referencePlane') {
    if (!validId(support.featureId) || !earlierReferencePlanes.has(support.featureId)) throw new Error('The sketch references a missing or later reference plane.')
  } else if (support.kind === 'planarFace') {
    if (!validId(support.bodyId) || !Number.isSafeInteger(support.topologyRevision) || support.topologyRevision < 0 || !Number.isSafeInteger(support.faceId) || support.faceId <= 0) throw new Error('The planar-face sketch support is invalid.')
  } else throw new Error('The sketch support plane is invalid.')
  return structuredClone(support)
}

export function validateModelSpaceSketch(input: ModelSpaceSketchDefinition): ModelSpaceSketchDefinition {
  if (!input || input.version !== 2 || !Array.isArray(input.points) || !Array.isArray(input.entities) || !Array.isArray(input.relations)) throw new Error('The model-space sketch is invalid.')
  if (input.points.length > 10_000 || input.entities.length > 10_000 || input.relations.length > 20_000) throw new Error('The model-space sketch is too large.')
  const pointIds = new Set<string>()
  const points = input.points.map((point) => {
    if (!validId(point?.id) || pointIds.has(point.id) || !finiteCoordinate(point.x) || !finiteCoordinate(point.y)) throw new Error('Every sketch point needs a unique ID and valid model-space coordinates.')
    pointIds.add(point.id)
    return { id: point.id, x: point.x, y: point.y }
  })
  const entityIds = new Set<string>()
  const entities = input.entities.map((entity): ModelSpaceSketchEntity => {
    if (!validId(entity?.id) || entityIds.has(entity.id)) throw new Error('Every sketch entity needs a unique ID.')
    entityIds.add(entity.id)
    if (entity.type === 'line') {
      if (!pointIds.has(entity.startPointId) || !pointIds.has(entity.endPointId) || entity.startPointId === entity.endPointId) throw new Error('A sketch line needs two different existing points.')
    } else if (entity.type === 'circle') {
      if (!pointIds.has(entity.centerPointId) || !Number.isFinite(entity.radius) || entity.radius <= 0 || entity.radius > MAX_PRIMITIVE_DIMENSION_MM) throw new Error('A sketch circle needs an existing center and a valid radius.')
    } else throw new Error('The model-space sketch contains an unsupported entity.')
    return structuredClone(entity)
  })
  const relationIds = new Set<string>()
  const relations = input.relations.map((relation): ModelSpaceSketchRelation => {
    if (!validId(relation?.id) || relationIds.has(relation.id)) throw new Error('Every sketch relation needs a unique ID.')
    relationIds.add(relation.id)
    if ('entityId' in relation) {
      if (!['horizontal', 'vertical', 'fixed'].includes(relation.type) || !entityIds.has(relation.entityId)) throw new Error('A sketch relation references a missing entity.')
    } else if ('firstEntityId' in relation) {
      if (!['parallel', 'perpendicular', 'equal'].includes(relation.type) || !entityIds.has(relation.firstEntityId) || !entityIds.has(relation.secondEntityId) || relation.firstEntityId === relation.secondEntityId) throw new Error('A sketch relation references invalid entities.')
    } else if (relation.type !== 'coincident' || !pointIds.has(relation.firstPointId) || !pointIds.has(relation.secondPointId) || relation.firstPointId === relation.secondPointId) throw new Error('A coincident relation references invalid points.')
    return structuredClone(relation)
  })
  return { version: 2, points, entities, relations }
}

export function validateCadFeatureDocument(input: CadFeatureDocument): CadFeatureDocument {
  if (!input || input.version !== 2 || !Array.isArray(input.features) || input.features.length === 0 || input.features.length > 400) throw new Error('The feature document is invalid.')
  const ids = new Set<string>()
  const referencePlaneIds = new Set<string>()
  const sketchIds = new Set<string>()
  let hasSolid = false
  const features = input.features.map((feature): CadFeatureDefinition => {
    if (!feature || !validId(feature.id) || ids.has(feature.id) || typeof feature.name !== 'string' || !feature.name.trim() || feature.name.length > 100) throw new Error('Every feature needs a unique ID and valid name.')
    ids.add(feature.id)
    if (feature.type === 'referencePlane') {
      const reference = validateSupportPlane(feature.reference, referencePlaneIds)
      if (!finiteCoordinate(feature.offset)) throw new Error('The reference plane offset is invalid.')
      if (feature.angle && (!Number.isFinite(feature.angle.degrees) || Math.abs(feature.angle.degrees) > 360 || !['u', 'v'].includes(feature.angle.axis))) throw new Error('The reference plane angle is invalid.')
      referencePlaneIds.add(feature.id)
      return { ...structuredClone(feature), name: feature.name.trim(), reference }
    }
    if (feature.type === 'sketch') {
      const support = validateSupportPlane(feature.support, referencePlaneIds)
      const sketch = validateModelSpaceSketch(feature.sketch)
      sketchIds.add(feature.id)
      return { ...structuredClone(feature), name: feature.name.trim(), support, sketch }
    }
    if (feature.type === 'extrude') {
      if (!sketchIds.has(feature.sketchId)) throw new Error('The extrusion references a missing or later sketch.')
      if (!['boss', 'cut'].includes(feature.operation) || (!hasSolid && feature.operation !== 'boss')) throw new Error('The first solid feature must be a boss extrusion.')
      dimension(feature.distance, 'Extrude distance')
      hasSolid = true
      return { ...structuredClone(feature), name: feature.name.trim(), reversed: feature.reversed === true }
    }
    throw new Error('The feature document contains an unsupported feature.')
  })
  if (!hasSolid) throw new Error('The feature document must contain an extrusion.')
  return { version: 2, features }
}

function allocateFeatureId(base: string, used: Set<string>): string {
  let candidate = base.slice(0, 100)
  let suffix = 2
  while (used.has(candidate)) {
    const tail = `-${suffix++}`
    candidate = `${base.slice(0, 100 - tail.length)}${tail}`
  }
  used.add(candidate)
  return candidate
}

function migrateProfile(profile: SketchProfile, prefix: string): ModelSpaceSketchDefinition {
  if (profile.type === 'circle') return {
    version: 2,
    points: [{ id: `${prefix}-center`, x: 0, y: 0 }],
    entities: [{ id: `${prefix}-circle`, type: 'circle', centerPointId: `${prefix}-center`, radius: profile.radius }],
    relations: [],
  }
  const coordinates: Array<[number, number]> = profile.type === 'rectangle'
    ? [[-profile.width / 2, -profile.height / 2], [profile.width / 2, -profile.height / 2], [profile.width / 2, profile.height / 2], [-profile.width / 2, profile.height / 2]]
    : profile.points.at(-1)?.[0] === profile.points[0]?.[0] && profile.points.at(-1)?.[1] === profile.points[0]?.[1]
      ? profile.points.slice(0, -1)
      : profile.points
  const points = coordinates.map(([x, y], index) => ({ id: `${prefix}-point-${index + 1}`, x, y }))
  const entities: ModelSpaceSketchEntity[] = points.map((point, index) => ({ id: `${prefix}-line-${index + 1}`, type: 'line', startPointId: point.id, endPointId: points[(index + 1) % points.length].id }))
  const relations: ModelSpaceSketchRelation[] = profile.type === 'rectangle'
    ? entities.map((entity, index) => ({ id: `${prefix}-relation-${index + 1}`, type: index % 2 === 0 ? 'horizontal' : 'vertical', entityId: entity.id }))
    : []
  return { version: 2, points, entities, relations }
}

export function migrateCadFeatureModel(input: CadFeatureModel): CadFeatureDocument {
  const legacy = validateCadFeatureModel(input)
  const usedIds = new Set(legacy.features.map((feature) => feature.id))
  const features: CadFeatureDefinition[] = []
  legacy.features.forEach((feature, index) => {
    let support: SketchSupportPlane = { kind: 'principal', plane: feature.plane }
    if (feature.planeOffset || feature.planeAngle) {
      const planeId = allocateFeatureId(`${feature.id}-plane`, usedIds)
      features.push({
        id: planeId, type: 'referencePlane', name: `Plane${index + 1}`,
        reference: support, offset: feature.planeOffset ?? 0,
        ...(feature.planeAngle ? { angle: { degrees: feature.planeAngle, axis: feature.planeAngleAxis === 'vertical' ? 'v' : 'u' } as const } : {}),
      })
      support = { kind: 'referencePlane', featureId: planeId }
    }
    const sketchId = allocateFeatureId(`${feature.id}-sketch`, usedIds)
    features.push({ id: sketchId, type: 'sketch', name: `Sketch${index + 1}`, support, sketch: migrateProfile(feature.profile, sketchId) })
    features.push({ id: feature.id, type: 'extrude', name: feature.name, sketchId, operation: feature.operation, distance: feature.length, reversed: feature.reversed })
  })
  return validateCadFeatureDocument({ version: 2, features })
}

export function normalizeCadFeatureDocument(input: CadFeatureHistory): CadFeatureDocument {
  return input.version === 1 ? migrateCadFeatureModel(input) : validateCadFeatureDocument(input)
}
