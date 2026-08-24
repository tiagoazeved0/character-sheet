import { diffDocuments } from '../rules/diff.ts'
import type { Character } from '../rules/types.ts'
import type { Change } from '../rules/schema.ts'
import { labelForPath } from './labels.ts'

export type Channel = 'edit' | 'play'

export type Mutation = {
  /** Batch label, e.g. "Long rest" or "Edit: vitals". */
  label: string
  channel: Channel
  mutate: (c: Character) => Character
}

/** Bookkeeping fields that must never show up in the history. */
const IGNORED = new Set(['/updatedAt', '/schemaVersion'])

const COALESCE_WINDOW_MS = 10_000

export type ApplyResult = { next: Character; changes: Change[] }

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/**
 * The single dispatch layer. Every change to a character goes through here so
 * that history, sync and undo all fall out for free. Do not mutate a character
 * document anywhere else.
 */
export function computeApply(current: Character, mutation: Mutation, now = new Date()): ApplyResult {
  const draft = mutation.mutate(current)
  const next: Character = { ...draft, updatedAt: now.toISOString() }

  const leaves = diffDocuments(current, next).filter((l) => !IGNORED.has(l.path))
  if (leaves.length === 0) return { next: current, changes: [] }

  const batchId = leaves.length > 1 ? uid() : undefined
  const changes: Change[] = leaves.map((leaf) => ({
    id: uid(),
    characterId: current.id,
    at: now.toISOString(),
    batchId,
    batchLabel: mutation.label,
    channel: mutation.channel,
    path: leaf.path,
    label: labelForPath(leaf.path),
    before: leaf.before,
    after: leaf.after,
  }))

  return { next, changes }
}

/**
 * Folds a new change into the journal, collapsing repeated pokes at the same
 * field. Four taps of -5 become one entry reading 62 -> 42.
 */
export function coalesce(journal: Change[], incoming: Change[]): Change[] {
  const out = [...journal]
  for (const change of incoming) {
    const lastIndex = out.length - 1
    const last = out[lastIndex]
    const mergeable =
      last !== undefined &&
      change.batchId === undefined &&
      last.batchId === undefined &&
      last.path === change.path &&
      last.channel === change.channel &&
      last.characterId === change.characterId &&
      new Date(change.at).getTime() - new Date(last.at).getTime() < COALESCE_WINDOW_MS

    if (mergeable && last) {
      out[lastIndex] = { ...last, at: change.at, after: change.after }
    } else {
      out.push(change)
    }
  }
  return out
}

/** Retention: edits are forever, play churn is pruned to the recent past. */
export const PLAY_RETENTION = 400

export function prune(journal: Change[]): Change[] {
  const play = journal.filter((c) => c.channel === 'play')
  if (play.length <= PLAY_RETENTION) return journal
  const cutoff = play[play.length - PLAY_RETENTION]
  if (!cutoff) return journal
  const cutoffTime = new Date(cutoff.at).getTime()
  return journal.filter((c) => c.channel === 'edit' || new Date(c.at).getTime() >= cutoffTime)
}

/** Reverting is itself a normal mutation, and so is itself logged. */
export function revertMutation(change: Change): Mutation {
  return {
    label: `Revert: ${change.label}`,
    channel: 'edit',
    mutate: (c) => setByPointer(c, change.path, change.before),
  }
}

export function setByPointer<T>(doc: T, pointer: string, value: unknown): T {
  const keys = pointer.split('/').slice(1).map((k) => k.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (keys.length === 0) return value as T
  const clone: unknown = structuredClone(doc)
  let node = clone as Record<string, unknown>
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    const child = node[key]
    if (typeof child !== 'object' || child === null) node[key] = {}
    node = node[key] as Record<string, unknown>
  }
  const leaf = keys[keys.length - 1]!
  if (value === undefined) delete node[leaf]
  else node[leaf] = value
  return clone as T
}
