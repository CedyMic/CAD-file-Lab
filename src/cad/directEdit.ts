export interface MoveFaceFeature {
  id: string
  type: 'moveFace'
  mode: 'offset'
  name: string
  faceId: number
  distance: number
}

export interface EdgeTreatmentFeature {
  id: string
  type: 'fillet' | 'chamfer'
  name: string
  edgeId: number
  size: number
}

export type DirectEditFeature = MoveFaceFeature | EdgeTreatmentFeature

const MAX_FACE_OFFSET_MM = 100_000

export function validateFaceOffset(distance: number) {
  if (!Number.isFinite(distance) || distance === 0) {
    throw new Error('Move Face distance must be a non-zero number.')
  }
  if (Math.abs(distance) > MAX_FACE_OFFSET_MM) {
    throw new Error('Move Face distance exceeds the 100,000 mm safety limit.')
  }
  return distance
}

export function validateDirectEditFeature(value: DirectEditFeature): DirectEditFeature {
  if (!value || !['moveFace', 'fillet', 'chamfer'].includes(value.type)) {
    throw new Error('This direct-edit feature is not supported.')
  }
  if (typeof value.id !== 'string' || !value.id || value.id.length > 200) {
    throw new Error('Move Face has an invalid feature ID.')
  }
  if (typeof value.name !== 'string' || !value.name || value.name.length > 120) {
    throw new Error('Move Face has an invalid feature name.')
  }
  if (value.type === 'moveFace') {
    if (value.mode !== 'offset' || !Number.isSafeInteger(value.faceId) || value.faceId <= 0) {
      throw new Error('Move Face has an invalid face reference.')
    }
    validateFaceOffset(value.distance)
  } else {
    if (!Number.isSafeInteger(value.edgeId) || value.edgeId <= 0) {
      throw new Error('Edge feature has an invalid edge reference.')
    }
    validateEdgeTreatmentSize(value.size)
  }
  return { ...value }
}

export function validateEdgeTreatmentSize(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 100_000) {
    throw new Error('Fillet radius or chamfer distance must be greater than zero and no more than 100,000 mm.')
  }
  return value
}

export function createEdgeTreatmentFeature(type: EdgeTreatmentFeature['type'], edgeId: number, size: number, featureNumber: number): EdgeTreatmentFeature {
  return validateDirectEditFeature({
    id: crypto.randomUUID(),
    type,
    name: `${type === 'fillet' ? 'Fillet' : 'Chamfer'}${featureNumber}`,
    edgeId,
    size,
  }) as EdgeTreatmentFeature
}

export function validateDirectEditHistory(value: DirectEditFeature[] | undefined) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 1_000) {
    throw new Error('The direct-edit feature history is invalid.')
  }
  return value.map(validateDirectEditFeature)
}

export function createMoveFaceFeature(
  faceId: number,
  distance: number,
  featureNumber: number,
): MoveFaceFeature {
  return validateDirectEditFeature({
    id: crypto.randomUUID(),
    type: 'moveFace',
    mode: 'offset',
    name: `Move Face${featureNumber}`,
    faceId,
    distance,
  }) as MoveFaceFeature
}
