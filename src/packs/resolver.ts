import type { RulesPack } from './types.ts'

export type PackPin = { packId: string; version: string }

/** One resolved content entry, tagged with which pack it actually came from. */
export type ResolvedEntry = { fqid: string; packId: string; version: string; category: string; entry: unknown }

const CATEGORIES = ['spells', 'conditions', 'classes', 'races', 'backgrounds', 'feats', 'items', 'features', 'monsters'] as const

/**
 * Flattens installed packs into one id -> entry index, keyed by fully-qualified
 * id (`packId:category/entryId`). Because the packId is part of every key, a
 * 2014 and a 2024 Fireball from different packs coexist without collision --
 * they only actually override each other if the same packId is pinned twice
 * (last one in `pins` wins) or a later pack explicitly claims an earlier
 * pack's id. The latter (PLAN.md's `replaces`) isn't implemented: no pack
 * needs it yet, and it's cheap to add when one does. A pin with no matching
 * installed pack is silently skipped -- the caller decides how to surface a
 * missing pack, this function just resolves what it can.
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
