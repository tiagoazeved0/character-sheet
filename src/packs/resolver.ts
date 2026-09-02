import type { RulesPack } from './types.ts'

export type PackPin = { packId: string; version: string }

/** One resolved content entry, tagged with which pack it actually came from. */
export type ResolvedEntry = { fqid: string; packId: string; version: string; category: string; entry: unknown }

const CATEGORIES = ['spells', 'conditions', 'classes', 'races', 'backgrounds', 'feats', 'items', 'features'] as const

/**
 * Flattens installed packs into one id -> entry index, keyed by fully-qualified
 * id (`packId:category/entryId`). Because the packId is part of every key, a
 * 2014 and a 2024 Fireball from different packs coexist without collision --
 * they only actually override each other if the same packId is pinned twice
 * (last one in `pins` wins) or a later pack explicitly claims an earlier
 * pack's id. The latter (PLAN.md's `replaces`) isn't implemented: no pack
 * needs it yet, and it's cheap to add when one does. A pin with no matching
 * installed pack is silently skipped -- this function resolves what it can, and
 * `pinStates()` below is how a caller finds out what it couldn't.
 */
export function resolvePacks(installed: RulesPack[], pins: PackPin[]): Map<string, ResolvedEntry> {
  const byKey = new Map<string, RulesPack>()
  for (const pack of installed) byKey.set(`${pack.packId}@${pack.version}`, pack)

  const index = new Map<string, ResolvedEntry>()
  for (const pin of pins) {
    const pack = byKey.get(`${pin.packId}@${pin.version}`)
    if (!pack) continue
    for (const category of CATEGORIES) {
      for (const entry of pack.content[category] as { id: string }[]) {
        const fqid = `${pack.packId}:${category}/${entry.id}`
        index.set(fqid, { fqid, packId: pack.packId, version: pack.version, category, entry })
      }
    }
  }
  return index
}

export type PinState =
  | { pin: PackPin; state: 'ok' }
  /** Right pack, wrong version. One click from correct, because the file is already here. */
  | { pin: PackPin; state: 'version-mismatch'; available: string[] }
  /** No copy of this pack at all. Needs the file, not a decision. */
  | { pin: PackPin; state: 'missing' }

/**
 * Which of a character's pins actually resolve, and why not when they don't.
 *
 * Skipping an unmatched pin is right for resolution and wrong for the person
 * holding the sheet: the cached snapshots on each entry keep rendering (that is
 * their job, see CLAUDE.md Hard Rule 2), so nothing looks broken while every
 * `ref` has quietly stopped pointing anywhere. The two failures need different
 * things from the reader, which is why they are different states rather than
 * one "unresolved".
 */
export function pinStates(installed: RulesPack[], pins: PackPin[]): PinState[] {
  return pins.map((pin) => {
    const available = installed.filter((p) => p.packId === pin.packId).map((p) => p.version)
    if (available.includes(pin.version)) return { pin, state: 'ok' }
    if (available.length > 0) return { pin, state: 'version-mismatch', available }
    return { pin, state: 'missing' }
  })
}

/** The pins a caller should complain about. */
export const unresolvedPins = (installed: RulesPack[], pins: PackPin[]) =>
  pinStates(installed, pins).filter((s) => s.state !== 'ok')
