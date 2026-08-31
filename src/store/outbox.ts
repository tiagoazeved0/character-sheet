import type { Change } from '../rules/schema.ts'
import type { Character } from '../rules/types.ts'

/**
 * The pure half of sync: what is owed to the server, and what to do when the
 * server disagrees. No network, no IndexedDB, no React — so it can be tested,
 * which matters more here than anywhere else in the app. Sync code that has
 * never been exercised is how people lose characters.
 */

export type SyncStatus = 'local-only' | 'signed-out' | 'offline' | 'pending' | 'syncing' | 'synced' | 'conflict'

/** Server bookkeeping, kept out of the character document on purpose: `rev` on
 *  the document would be diffed by `apply()` and journalled as a change every
 *  time we synced. */
export type SyncMeta = {
  characterId: string
  /** Last rev the server confirmed. 0 means the server has never seen this row. */
  rev: number
  /** updatedAt of the document we last pushed successfully. */
  pushedAt: string | null
}

export type PendingCharacter = { kind: 'character'; id: string; updatedAt: string }
export type PendingChange = { kind: 'change'; id: string; characterId: string }
export type PendingPack = { kind: 'pack'; packId: string; version: string }
/** Deleting has to reach the server, or the next pull resurrects the character. */
export type PendingDelete = { kind: 'delete'; id: string }
export type Pending = PendingCharacter | PendingChange | PendingPack | PendingDelete

export const pendingKey = (p: Pending): string =>
  p.kind === 'character' ? `character:${p.id}`
    : p.kind === 'change' ? `change:${p.id}`
      : p.kind === 'delete' ? `delete:${p.id}`
        : `pack:${p.packId}@${p.version}`

/**
 * A character is worth re-pushing only once per state, so a queued entry is
 * replaced rather than appended -- forty HP taps owe the server one row, not
 * forty. Changes and packs are immutable, so they never collapse.
 */
/**
 * A ceiling on the durable queue. Character pushes collapse so they are bounded
 * by how many characters you have, but change rows do not, and a queue that
 * cannot drain (configured, never signed in) would otherwise grow forever. When
 * it is hit, the oldest journal rows go first: losing a history entry is a far
 * smaller loss than losing a character, and neither a document nor a delete is
 * ever dropped.
 */
export const QUEUE_LIMIT = 2000

function trim(queue: Pending[]): Pending[] {
  if (queue.length <= QUEUE_LIMIT) return queue
  const excess = queue.length - QUEUE_LIMIT
  let dropped = 0
  return queue.filter((p) => {
    if (dropped >= excess || p.kind !== 'change') return true
    dropped += 1
    return false
  })
}

export function enqueue(queue: Pending[], item: Pending): Pending[] {
  // A delete supersedes any pending push of the same character: sending the
  // document and then removing it is wasted work, and racy if the order slips.
  const base = item.kind === 'delete'
    ? queue.filter((p) => !(p.kind === 'character' && p.id === item.id))
    : queue
  const key = pendingKey(item)
  const existing = base.findIndex((p) => pendingKey(p) === key)
  if (existing === -1) return trim([...base, item])
  if (item.kind !== 'character') return base
  const next = [...base]
  next[existing] = item
  return next
}

/**
 * Removes what was actually sent. For a character that means matching the state
 * we pushed, not just its id: if it was edited again while the push was in
 * flight, the queued entry is newer than what the server got and has to stay.
 */
export function dequeue(queue: Pending[], done: Pending[]): Pending[] {
  const sent = new Map(done.map((p) => [pendingKey(p), p]))
  return queue.filter((p) => {
    const match = sent.get(pendingKey(p))
    if (!match) return true
    if (p.kind === 'character' && match.kind === 'character') return p.updatedAt !== match.updatedAt
    return false
  })
}

export type Conflict = {
  characterId: string
  local: Character
  remote: Character
  localUpdatedAt: string
  remoteUpdatedAt: string
  /** Rev the server holds, which we must adopt whichever side wins. */
  remoteRev: number
}

export type PushOutcome =
  | { ok: true; rev: number }
  | { ok: false; reason: 'conflict'; remoteRev: number; remote: Character }
  | { ok: false; reason: 'offline' }
  | { ok: false; reason: 'error'; message: string }

/**
 * Never merges. One person on two devices always means "I left the tablet
 * open", so the honest answer is to ask which side wins rather than to invent
 * a third document neither device had.
 */
export function resolveConflict(
  conflict: Conflict,
  choice: 'local' | 'remote',
): { document: Character; rev: number } {
  return choice === 'local'
    ? { document: conflict.local, rev: conflict.remoteRev }
    : { document: conflict.remote, rev: conflict.remoteRev }
}

/** What the indicator shows. Conflicts outrank everything: they need a decision. */
export function statusFor(input: {
  configured: boolean
  signedIn: boolean
  online: boolean
  conflicts: number
  pending: number
  inFlight: boolean
}): SyncStatus {
  if (!input.configured) return 'local-only'
  if (input.conflicts > 0) return 'conflict'
  if (!input.signedIn) return 'signed-out'
  if (!input.online) return 'offline'
  if (input.inFlight) return 'syncing'
  return input.pending > 0 ? 'pending' : 'synced'
}

export const STATUS_LABEL: Record<SyncStatus, string> = {
  'local-only': 'This device only',
  'signed-out': 'Not signed in',
  offline: 'Offline',
  pending: 'Waiting to sync',
  syncing: 'Syncing',
  synced: 'Synced',
  conflict: 'Needs a decision',
}

/** Rows for the server, matching the columns in `supabase/schema.sql`. */
export const characterRow = (c: Character, rev: number) => ({
  id: c.id, rev, updated_at: c.updatedAt, data: c as unknown,
})

export const changeRow = (change: Change) => ({
  id: change.id,
  character_id: change.characterId,
  at: change.at,
  batch_id: change.batchId ?? null,
  channel: change.channel,
  data: change as unknown,
})
