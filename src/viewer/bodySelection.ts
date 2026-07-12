export function updateBodySelection(
  current: ReadonlySet<string>,
  partId: string,
  additive: boolean,
): Set<string> {
  if (additive) {
    const next = new Set(current)
    if (next.has(partId)) next.delete(partId)
    else next.add(partId)
    return next
  }

  if (current.size === 1 && current.has(partId)) return new Set()
  return new Set([partId])
}
