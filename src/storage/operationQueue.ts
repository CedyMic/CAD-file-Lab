export type AsyncOperationQueue = <T>(
  operation: () => Promise<T>,
) => Promise<T>

export function createAsyncOperationQueue():
  AsyncOperationQueue {
  let tail: Promise<void> =
    Promise.resolve()

  return function enqueue<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const result = tail.then(
      operation,
      operation,
    )

    tail = result.then(
      () => undefined,
      () => undefined,
    )

    return result
  }
}
