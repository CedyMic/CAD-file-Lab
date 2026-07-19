export interface MoveFaceFeature {
  id: string
  type: 'moveFace'
  mode: 'offset'
  name: string
  faceId: number
  distance: number
}

export type DirectEditFeature = MoveFaceFeature

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
  if (!value || value.type !== 'moveFace' || value.mode !== 'offset') {
    throw new Error('This direct-edit feature is not supported.')
  }
  if (!Number.isSafeInteger(value.faceId) || value.faceId <= 0) {
    throw new Error('Move Face has an invalid face reference.')
  }
  if (typeof value.id !== 'string' || !value.id || value.id.length > 200) {
    throw new Error('Move Face has an invalid feature ID.')
  }
  if (typeof value.name !== 'string' || !value.name || value.name.length > 120) {
    throw new Error('Move Face has an invalid feature name.')
  }
  validateFaceOffset(value.distance)
  return { ...value }
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
  })
}
