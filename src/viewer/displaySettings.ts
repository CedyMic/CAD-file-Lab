export type DisplayStyle =
  | 'shaded'
  | 'shaded-edges'
  | 'wireframe'
  | 'ghosted'

export type ProjectionMode =
  | 'perspective'
  | 'orthographic'

export interface DisplaySettings {
  displayStyle: DisplayStyle
  projection: ProjectionMode
  modelColor: string
  edgeColor: string
  backgroundColor: string
  gridColor: string
  showGrid: boolean
  showAxes: boolean
  showViewCube: boolean
  brightness: number
  edgeOpacity: number
  modelOpacity: number
}

export const defaultDisplaySettings: DisplaySettings = {
  displayStyle: 'shaded-edges',
  projection: 'perspective',
  modelColor: '#78a7c7',
  edgeColor: '#172f42',
  backgroundColor: '#121a22',
  gridColor: '#355064',
  showGrid: true,
  showAxes: true,
  showViewCube: true,
  brightness: 0.9,
  edgeOpacity: 0.58,
  modelOpacity: 1,
}
