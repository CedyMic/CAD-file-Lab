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

export function getFeatureModelFileName(model: CadFeatureModel): string {
  const validated = validateCadFeatureModel(model)
  const name = validated.features[0].name.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return `${name || 'Feature-model'}.step`
}
