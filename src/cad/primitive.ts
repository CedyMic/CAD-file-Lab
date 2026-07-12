export const MAX_PRIMITIVE_DIMENSION_MM = 1_000_000

export type CadPrimitive =
  | { type: 'box'; width: number; depth: number; height: number }
  | { type: 'cylinder'; radius: number; height: number }
  | { type: 'sphere'; radius: number }
  | { type: 'cone'; baseRadius: number; topRadius: number; height: number }

function validateDimension(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`)
  }
  if (value > MAX_PRIMITIVE_DIMENSION_MM) {
    throw new Error(`${label} cannot exceed ${MAX_PRIMITIVE_DIMENSION_MM.toLocaleString('en-US')} mm.`)
  }
}

export function validateCadPrimitive(primitive: CadPrimitive): CadPrimitive {
  if (!primitive || !['box', 'cylinder', 'sphere', 'cone'].includes(primitive.type)) {
    throw new Error('Choose a supported primitive type.')
  }
  if (primitive.type === 'box') {
    validateDimension(primitive.width, 'Width')
    validateDimension(primitive.depth, 'Depth')
    validateDimension(primitive.height, 'Height')
    return { type: 'box', width: primitive.width, depth: primitive.depth, height: primitive.height }
  }
  if (primitive.type === 'cylinder') {
    validateDimension(primitive.radius, 'Radius')
    validateDimension(primitive.height, 'Height')
    return { type: 'cylinder', radius: primitive.radius, height: primitive.height }
  }
  if (primitive.type === 'sphere') {
    validateDimension(primitive.radius, 'Radius')
    return { type: 'sphere', radius: primitive.radius }
  }
  validateDimension(primitive.baseRadius, 'Base radius')
  if (!Number.isFinite(primitive.topRadius) || primitive.topRadius < 0) {
    throw new Error('Top radius must be a finite number greater than or equal to zero.')
  }
  if (primitive.topRadius > MAX_PRIMITIVE_DIMENSION_MM) {
    throw new Error(`Top radius cannot exceed ${MAX_PRIMITIVE_DIMENSION_MM.toLocaleString('en-US')} mm.`)
  }
  if (primitive.topRadius === primitive.baseRadius) {
    throw new Error('Top radius must differ from base radius for a cone.')
  }
  validateDimension(primitive.height, 'Height')
  return { type: 'cone', baseRadius: primitive.baseRadius, topRadius: primitive.topRadius, height: primitive.height }
}

export function getPrimitiveFileName(primitive: CadPrimitive): string {
  const names: Record<CadPrimitive['type'], string> = {
    box: 'Box.step',
    cylinder: 'Cylinder.step',
    sphere: 'Sphere.step',
    cone: 'Cone.step',
  }
  return names[primitive.type]
}
