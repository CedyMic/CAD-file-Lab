export type ExactCadExportFormat = 'step' | 'brep'

export const MAX_EXACT_CAD_EXPORT_BYTES = 256 * 1024 * 1024

export function validateExactCadExportSize(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error('The exact CAD export is empty or has an invalid size.')
  }
  if (size > MAX_EXACT_CAD_EXPORT_BYTES) {
    throw new Error('The exact CAD export exceeds the 256 MiB browser-local safety limit.')
  }
}

export function getExactCadDownloadName(
  fileName: string | undefined,
  format: ExactCadExportFormat,
) {
  const extension = `.${format}`
  const baseName = (fileName ?? 'model')
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/^[ ._-]+|[ ._-]+$/g, '')
    .slice(0, 127 - extension.length)
    .replace(/[ ._-]+$/g, '') || 'model'
  return `${baseName}${extension}`
}

export async function validateStepExportBlob(blob: Blob) {
  validateExactCadExportSize(blob.size)
  const header = await blob.slice(0, Math.min(blob.size, 4096)).text()
  const tail = await blob.slice(Math.max(0, blob.size - 4096)).text()
  if (!header.includes('ISO-10303-21;') || !header.includes('HEADER;') || !tail.includes('END-ISO-10303-21;')) {
    throw new Error('The generated STEP file does not contain a complete ISO 10303-21 envelope.')
  }
}
