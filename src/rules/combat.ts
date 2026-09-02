import type { ActionEntry, Character, FeatureEntry, Lane, Requirement, SpellEntry } from './types.ts'
import { castLevelFor, poolRemaining, slotsRemaining } from './derive.ts'

/**
 * What the character can do this turn, worked out from the entries on the sheet
 * rather than hand-authored per character -- which is the whole reason the
 * prototype's combat lanes only ever worked for one warlock.
 */

export const LANES: Lane[] = ['action', 'bonus', 'move', 'reaction', 'free']

export const LANE_NAMES: Record<Lane, string> = {
  action: 'Action',
  bonus: 'Bonus action',
  move: 'Move',
  reaction: 'Reaction',
  free: 'Free',
}

/** An untagged entry is an action. Every character written before lanes existed
 *  would otherwise open combat mode to five empty lanes. */
export const laneOf = (entry: { lane?: Lane }): Lane => entry.lane ?? 'action'

/** Whether the pool an option charges has enough left in it. */
export const canPay = (c: Character, requires: Requirement | undefined): boolean =>
  !requires || poolRemaining(c, requires.pool) >= requires.amount

/**
 * What casting actually spends: nothing for a cantrip, a named pool for a Mystic
 * Arcanum, otherwise the slot the spell would be cast at. One place, because the
 * sheet and the combat view must charge the same thing.
 */
export type SpellCost =
  | { kind: 'cantrip' }
  | { kind: 'pool'; poolId: string; remaining: number }
  | { kind: 'slot'; poolId: string; level: number; remaining: number }

export function spellCost(c: Character, spell: SpellEntry): SpellCost {
  if (spell.level === 0) return { kind: 'cantrip' }
  if (spell.pool) return { kind: 'pool', poolId: spell.pool, remaining: poolRemaining(c, spell.pool) }
  const level = castLevelFor(c, spell.level)
  const poolId = c.spellcasting.kind === 'pact' ? 'slots:pact' : `slots:${level}`
  return { kind: 'slot', poolId, level, remaining: slotsRemaining(c, level) }
}

export const spellAffordable = (c: Character, spell: SpellEntry): boolean => {
  const cost = spellCost(c, spell)
  return (cost.kind === 'cantrip' || cost.remaining > 0) && canPay(c, spell.requires)
}

/**
 * A feature earns a place on the lanes when it has a `pool` to spend or a `lane`
 * of its own. Iron Chin and Creature Type are facts about the character, not
 * things you do on a turn, and a lane full of them would be worse than useless.
 */
export const featureIsOption = (entry: FeatureEntry) => Boolean(entry.pool || entry.lane)

export type CombatOption =
  | { kind: 'action'; entry: ActionEntry; favoredBy: string[] }
  | { kind: 'spell'; entry: SpellEntry; cost: SpellCost; favoredBy: string[] }
  | { kind: 'feature'; entry: FeatureEntry; remaining: number | null; favoredBy: string[] }

export type LanePlan = {
  lane: Lane
  options: CombatOption[]
  /** Options in this lane there is nothing left to pay for. Counted rather than
   *  silently dropped: a spell vanishing mid-fight is alarming without a reason. */
  hidden: number
}

/**
 * The options in one lane, unaffordable ones removed and the ones the current
 * situation favours floated to the top. Sorting is stable, so everything else
 * keeps sheet order: actions, then spells, then features, as the tabs run.
 */
export function lanePlan(c: Character, lane: Lane, situations: string[]): LanePlan {
  const favoredBy = (tags: string[] | undefined) => (tags ?? []).filter((t) => situations.includes(t))
  const options: CombatOption[] = []
  let hidden = 0

  for (const entry of c.actions) {
    if (laneOf(entry) !== lane) continue
    if (!canPay(c, entry.requires)) { hidden += 1; continue }
    options.push({ kind: 'action', entry, favoredBy: favoredBy(entry.favoredWhen) })
  }

  for (const entry of [...c.spells].sort((a, b) => a.level - b.level)) {
    if (laneOf(entry) !== lane) continue
    if (!spellAffordable(c, entry)) { hidden += 1; continue }
    options.push({ kind: 'spell', entry, cost: spellCost(c, entry), favoredBy: favoredBy(entry.favoredWhen) })
  }

  for (const entry of c.features) {
    if (!featureIsOption(entry) || laneOf(entry) !== lane) continue
    const remaining = entry.pool ? poolRemaining(c, entry.pool) : null
    if (remaining !== null && remaining <= 0) { hidden += 1; continue }
    options.push({ kind: 'feature', entry, remaining, favoredBy: [] })
  }

  options.sort((a, b) => Number(b.favoredBy.length > 0) - Number(a.favoredBy.length > 0))
  return { lane, options, hidden }
}

export const turnPlan = (c: Character, situations: string[]): LanePlan[] =>
  LANES.map((lane) => lanePlan(c, lane, situations))

/**
 * The situation chips worth showing: only tags this character's own entries
 * respond to. A fixed vocabulary would fill the row with chips that reorder
 * nothing, and `favoredWhen` is free-form so packs can invent their own.
 */
export function situationTags(c: Character): string[] {
  const tags: string[] = []
  for (const entry of [...c.actions, ...c.spells]) {
    for (const tag of entry.favoredWhen ?? []) {
      if (!tags.includes(tag)) tags.push(tag)
    }
  }
  return tags
}

const SITUATION_LABELS: Record<string, string> = {
  range: 'At range',
  melee: 'In melee',
  crowd: 'Crowded',
  dim: 'Dim light',
  hidden: 'Unseen',
  bloodied: 'Bloodied',
}

export const situationLabel = (tag: string) => SITUATION_LABELS[tag] ?? tag
