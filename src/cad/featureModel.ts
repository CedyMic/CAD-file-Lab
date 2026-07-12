import { MAX_PRIMITIVE_DIMENSION_MM } from './primitive.ts'

export type SketchPlane = 'XY' | 'XZ' | 'YZ'
export type SketchProfile =
  | { type: 'rectangle'; width: number; height: number }
  | { type: 'circle'; radius: number }

export interface SketchExtrudeFeature {
  id: string
  type: 'sketchExtrude'
  name: string
  plane: SketchPlane
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
    if (!profile || !['rectangle', 'circle'].includes(profile.type)) throw new Error('Choose a rectangle or circle sketch profile.')
    const cleanProfile: SketchProfile = profile.type === 'rectangle'
      ? { type: 'rectangle', width: dimension(profile.width, 'Sketch width'), height: dimension(profile.height, 'Sketch height') }
      : { type: 'circle', radius: dimension(profile.radius, 'Sketch radius') }
    return {
      id: feature.id,
      type: 'sketchExtrude',
      name: feature.name.trim(),
      plane: feature.plane,
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
