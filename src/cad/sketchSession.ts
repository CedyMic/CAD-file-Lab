import { inferSketchPoint, type InferencePoint, type ModelPoint, type RelationProposal } from './sketchInference'

export type SessionPoint = InferencePoint

export interface SketchLineSegment {
  id: string
  type: 'line'
  startPointId: string
  endPointId: string
  relation?: RelationProposal
}

export type SketchCommandState =
  | { mode: 'idle' }
  | { mode: 'line-await-start' }
  | { mode: 'line-await-end'; start: InferencePoint; transient: true }

export interface SketchSession {
  points: SessionPoint[]
  segments: SketchLineSegment[]
  command: SketchCommandState
  nextPointNumber: number
  nextSegmentNumber: number
}

export interface ClickOptions {
  suppressAutomaticRelations?: boolean
  toleranceMm?: number
}

export interface LineClickResult {
  session: SketchSession
  committedSegment?: SketchLineSegment
  previewStart?: InferencePoint
}

const origin: SessionPoint = { id: 'origin', x: 0, y: 0, origin: true }
const pointFor = (id: string, point: ModelPoint): SessionPoint => ({ id, x: point.x, y: point.y })

export function createSketchSession(): SketchSession {
  return { points: [origin], segments: [], command: { mode: 'idle' }, nextPointNumber: 1, nextSegmentNumber: 1 }
}

export function beginLine(session: SketchSession): SketchSession {
  return session.command.mode === 'idle' ? { ...session, command: { mode: 'line-await-start' } } : session
}

/** First click is transient; every later click commits exactly one line and remains ready for the next one. */
export function clickLine(session: SketchSession, rawPoint: ModelPoint, options: ClickOptions = {}): LineClickResult {
  if (session.command.mode === 'idle') throw new Error('Start the line command before placing a line.')
  const previous = session.command.mode === 'line-await-end' ? session.command.start : undefined
  const inference = inferSketchPoint(rawPoint, session.points, previous, options)
  const resolvedStart = previous ?? (inference.snappedPointId ? session.points.find((point) => point.id === inference.snappedPointId)! : pointFor(`point-${session.nextPointNumber}`, inference.point))
  if (!previous) {
    return {
      session: { ...session, command: { mode: 'line-await-end', start: resolvedStart, transient: true } },
      previewStart: resolvedStart,
    }
  }
  const end = inference.snappedPointId ? session.points.find((point) => point.id === inference.snappedPointId)! : pointFor(`point-${session.nextPointNumber + (session.points.some((point) => point.id === resolvedStart.id) ? 1 : 0)}`, inference.point)
  if (resolvedStart.id === end.id || Math.hypot(resolvedStart.x - end.x, resolvedStart.y - end.y) <= 1e-9) return { session, previewStart: resolvedStart }
  const points = [...session.points]
  let nextPointNumber = session.nextPointNumber
  if (!points.some((point) => point.id === resolvedStart.id)) {
    points.push(resolvedStart)
    nextPointNumber += 1
  }
  if (!points.some((point) => point.id === end.id)) {
    points.push(end)
    nextPointNumber += 1
  }
  const committedSegment: SketchLineSegment = { id: `line-${session.nextSegmentNumber}`, type: 'line', startPointId: resolvedStart.id, endPointId: end.id, relation: inference.proposal }
  return {
    committedSegment,
    session: { points, segments: [...session.segments, committedSegment], command: { mode: 'line-await-end', start: end, transient: true }, nextPointNumber, nextSegmentNumber: session.nextSegmentNumber + 1 },
    previewStart: end,
  }
}

/** Escape cancels a pending point first; a second Escape exits the active line tool. */
export function escapeSketchCommand(session: SketchSession): SketchSession {
  if (session.command.mode === 'line-await-end') return { ...session, command: { mode: 'line-await-start' } }
  if (session.command.mode === 'line-await-start') return { ...session, command: { mode: 'idle' } }
  return session
}
