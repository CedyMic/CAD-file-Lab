import type {
  SerializedCadProject,
} from './cadClient'
import { validateCadPrimitive } from './primitive.ts'
import {
  normalizeCadFeatureDocument,
  type CadFeatureHistory,
} from './featureModel.ts'
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

function normalizeSerializedProject(
  value: unknown,
): SerializedCadProject | null {
  if (!isRecord(value)) {
    return null
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
  if (!coreIsValid) return null
  try {
    const project: SerializedCadProject = {
      version: 1,
      bodyId: value.bodyId as string,
      fileName: value.fileName as string,
      serializedShape: value.serializedShape as string,
      savedAt: value.savedAt as number,
    }

    if (value.primitive !== undefined) {
      project.primitive = validateCadPrimitive(value.primitive as never)
    }
    if (value.featureModel !== undefined) {
      // V1 histories remain importable, but project files are emitted and
      // returned in the canonical V2 feature-document form.
      project.featureModel = normalizeCadFeatureDocument(
        value.featureModel as CadFeatureHistory,
      )
    }
    if (value.directEdits !== undefined) {
      project.directEdits = validateDirectEditHistory(value.directEdits as never)
    }
    return project
  } catch {
    return null
  }
}

export function createCadLabProjectFile(
  project: SerializedCadProject,
  displaySettings: DisplaySettings,
): CadLabProjectFile {
  const normalizedProject = normalizeSerializedProject(project)
  if (!normalizedProject) {
    throw new Error('Cannot create a CAD File Lab project from invalid project data.')
  }

  return {
    format: PROJECT_FORMAT,
    version: 1,
    exportedAt: Date.now(),
    project: normalizedProject,
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

  const project = normalizeSerializedProject(parsed && isRecord(parsed) ? parsed.project : null)

  if (
    !isRecord(parsed) ||
    parsed.format !== PROJECT_FORMAT ||
    parsed.version !== 1 ||
    !isFiniteNumber(parsed.exportedAt) ||
    parsed.exportedAt <= 0 ||
    !project ||
    !isDisplaySettings(parsed.displaySettings)
  ) {
    throw new Error(
      'This CAD File Lab project is invalid or uses an unsupported version.',
    )
  }

  return {
    format: PROJECT_FORMAT,
    version: 1,
    exportedAt: parsed.exportedAt,
    project,
    displaySettings: structuredClone(parsed.displaySettings),
  }
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
