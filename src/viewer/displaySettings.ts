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
  modelColor: '#91b9db',
  edgeColor: '#27445b',
  backgroundColor: '#10171f',
  gridColor: '#2d4355',
  showGrid: true,
  showAxes: true,
  showViewCube: true,
  brightness: 1,
  edgeOpacity: 0.95,
  modelOpacity: 1,
}
