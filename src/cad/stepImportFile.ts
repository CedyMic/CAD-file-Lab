export const MAX_STEP_IMPORT_BYTES =
  256 * 1024 * 1024

export interface StepImportFileMetadata {
  name: string
  size: number
}

function getFileExtension(
  fileName: string,
): string {
  return (
    fileName
      .split('.')
      .pop()
      ?.trim()
      .toLowerCase() ?? ''
  )
}

export function validateStepImportFile(
  file: StepImportFileMetadata,
): void {
  const extension =
    getFileExtension(file.name)

  if (
    extension !== 'step' &&
    extension !== 'stp'
  ) {
    throw new Error(
      'This editable version currently supports STEP and STP files.',
    )
  }

  if (file.size === 0) {
    throw new Error(
      'The selected CAD file is empty.',
    )
  }

  if (
    !Number.isSafeInteger(file.size) ||
    file.size < 0 ||
    file.size > MAX_STEP_IMPORT_BYTES
  ) {
    throw new Error(
      'STEP files larger than 256 MiB are not supported because browser-local parsing can exhaust available memory.',
    )
  }
}
