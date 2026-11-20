export interface TopologyReference {
  kind: 'face' | 'edge'
  entityId: number
  bodyId: string
  revision: number
}

export function validateTopologyReference(reference: TopologyReference, currentBodyId: string, currentRevision: number) {
  if (reference.bodyId !== currentBodyId || reference.revision !== currentRevision) {
    throw new Error('The selected geometry is out of date. Select it again on the current model.')
  }
  if (!Number.isSafeInteger(reference.entityId) || reference.entityId <= 0) {
    throw new Error('The selected geometry has an invalid topology identifier.')
  }
  return reference
}

export function findTopologyGroup<T extends { start: number; count: number }>(groups: readonly T[] | undefined, index: number): T | null {
  if (!groups || !Number.isSafeInteger(index) || index < 0) return null
  return groups.find((group) => index >= group.start && index < group.start + group.count) ?? null
}
