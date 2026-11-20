export interface EditSnapshot<T> {
  geometry: string
  metadata: T
}

export interface EditHistory<T> {
  undo: EditSnapshot<T>[]
  redo: EditSnapshot<T>[]
}

export const MAX_EDIT_UNDO_STEPS = 10
export const MAX_HISTORY_SNAPSHOT_BYTES = 16 * 1024 * 1024

export function emptyEditHistory<T>(): EditHistory<T> {
  return { undo: [], redo: [] }
}

export function canStoreSnapshot(geometry: string) {
  return geometry.length > 0 && geometry.length * 2 <= MAX_HISTORY_SNAPSHOT_BYTES
}

export function commitEdit<T>(history: EditHistory<T>, before: EditSnapshot<T>): EditHistory<T> {
  if (!canStoreSnapshot(before.geometry)) return emptyEditHistory()
  return { undo: [...history.undo, before].slice(-MAX_EDIT_UNDO_STEPS), redo: [] }
}

export function stepEditHistory<T>(
  history: EditHistory<T>,
  direction: 'undo' | 'redo',
  current: EditSnapshot<T>,
): { history: EditHistory<T>; target: EditSnapshot<T> } {
  const source = history[direction]
  if (!source.length) throw new Error(`There is no CAD edit to ${direction}.`)
  if (!canStoreSnapshot(current.geometry)) throw new Error('This model is too large for CAD edit history.')
  const target = source[source.length - 1]
  return {
    target,
    history: direction === 'undo'
      ? { undo: history.undo.slice(0, -1), redo: [...history.redo, current].slice(-MAX_EDIT_UNDO_STEPS) }
      : { undo: [...history.undo, current].slice(-MAX_EDIT_UNDO_STEPS), redo: history.redo.slice(0, -1) },
  }
}
