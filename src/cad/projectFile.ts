import type {
  SerializedCadProject,
} from './cadClient'
import { validateCadPrimitive } from './primitive.ts'
import { validateCadFeatureModel } from './featureModel.ts'
import { validateDirectEditHistory } from './directEdit.ts'

import type {
  DisplaySettings,
  DisplayStyle,
  ProjectionMode,
} from '../viewer/displaySettings'

export const CAD_LAB_PROJECT_EXTENSION =
  '.cadlab'

export const MAX_CAD_LAB_PROJECT_BYTES =
  512 * 1024 * 1024

const PROJECT_FORMAT =
  'cad-file-lab-project'

const displayStyles = new Set<DisplayStyle>([
  'shaded',
  'shaded-edges',
  'wireframe',
  'ghosted',
])

const projectionModes = new Set<ProjectionMode>([
  'perspective',
  'orthographic',
])

export interface CadLabProjectFile {
  format: typeof PROJECT_FORMAT
  version: 1
  exportedAt: number
  project: SerializedCadProject
  displaySettings: DisplaySettings
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  )
}

function isColor(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^#[0-9a-f]{6}$/i.test(value)
  )
}

function isDisplaySettings(
  value: unknown,
): value is DisplaySettings {
  if (!isRecord(value)) {
    return false
  }

  return (
    displayStyles.has(value.displayStyle as DisplayStyle) &&
    projectionModes.has(value.projection as ProjectionMode) &&
    isColor(value.modelColor) &&
    isColor(value.edgeColor) &&
    isColor(value.backgroundColor) &&
    isColor(value.gridColor) &&
    typeof value.showGrid === 'boolean' &&
    typeof value.showAxes === 'boolean' &&
    typeof value.showViewCube === 'boolean' &&
    isFiniteNumber(value.brightness) &&
    value.brightness >= 0 &&
    value.brightness <= 4 &&
    isFiniteNumber(value.edgeOpacity) &&
    value.edgeOpacity >= 0 &&
    value.edgeOpacity <= 1 &&
    isFiniteNumber(value.modelOpacity) &&
    value.modelOpacity >= 0 &&
    value.modelOpacity <= 1
  )
}

function isSerializedProject(
  value: unknown,
): value is SerializedCadProject {
  if (!isRecord(value)) {
    return false
  }

  const coreIsValid = (
    value.version === 1 &&
    typeof value.bodyId === 'string' &&
    value.bodyId.length > 0 &&
    value.bodyId.length <= 200 &&
    typeof value.fileName === 'string' &&
    value.fileName.length > 0 &&
    value.fileName.length <= 1024 &&
    typeof value.serializedShape === 'string' &&
    value.serializedShape.length > 0 &&
    isFiniteNumber(value.savedAt) &&
    value.savedAt > 0
  )
  if (!coreIsValid) return false
  try {
    if (value.primitive !== undefined) validateCadPrimitive(value.primitive as never)
    if (value.featureModel !== undefined) validateCadFeatureModel(value.featureModel as never)
    if (value.directEdits !== undefined) validateDirectEditHistory(value.directEdits as never)
    return true
  } catch { return false }
}

export function createCadLabProjectFile(
  project: SerializedCadProject,
  displaySettings: DisplaySettings,
): CadLabProjectFile {
  return {
    format: PROJECT_FORMAT,
    version: 1,
    exportedAt: Date.now(),
    project,
    displaySettings,
  }
}

export function parseCadLabProjectFile(
  text: string,
): CadLabProjectFile {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(
      'This is not a valid CAD File Lab project file.',
    )
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== PROJECT_FORMAT ||
    parsed.version !== 1 ||
    !isFiniteNumber(parsed.exportedAt) ||
    parsed.exportedAt <= 0 ||
    !isSerializedProject(parsed.project) ||
    !isDisplaySettings(parsed.displaySettings)
  ) {
    throw new Error(
      'This CAD File Lab project is invalid or uses an unsupported version.',
    )
  }

  return parsed as unknown as CadLabProjectFile
}

export function getCadLabDownloadName(
  sourceFileName: string,
): string {
  const baseName = sourceFileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 120)

  return `${baseName || 'cad-project'}${CAD_LAB_PROJECT_EXTENSION}`
}
