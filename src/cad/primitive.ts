export const MAX_PRIMITIVE_DIMENSION_MM = 1_000_000

export type CadPrimitive =
  | { type: 'box'; width: number; depth: number; height: number }
  | { type: 'cylinder'; radius: number; height: number }

function validateDimension(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`)
  }
  if (value > MAX_PRIMITIVE_DIMENSION_MM) {
    throw new Error(`${label} cannot exceed ${MAX_PRIMITIVE_DIMENSION_MM.toLocaleString('en-US')} mm.`)
  }
}

export function validateCadPrimitive(primitive: CadPrimitive): CadPrimitive {
  if (!primitive || (primitive.type !== 'box' && primitive.type !== 'cylinder')) {
    throw new Error('Choose a supported primitive type.')
  }
  if (primitive.type === 'box') {
    validateDimension(primitive.width, 'Width')
    validateDimension(primitive.depth, 'Depth')
    validateDimension(primitive.height, 'Height')
    return { type: 'box', width: primitive.width, depth: primitive.depth, height: primitive.height }
  }
  validateDimension(primitive.radius, 'Radius')
  validateDimension(primitive.height, 'Height')
  return { type: 'cylinder', radius: primitive.radius, height: primitive.height }
}

export function getPrimitiveFileName(primitive: CadPrimitive): string {
  return primitive.type === 'box' ? 'Box.step' : 'Cylinder.step'
}
