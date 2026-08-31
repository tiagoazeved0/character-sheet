import type { Ability, Character, CoverDegree, DamageType } from './types.ts'
import { SKILLS } from './skills.ts'

/**
 * Everything here is computed on demand. Nothing in this file may be stored on
 * the character document -- stale derived values are what make paper sheets rot.
 */

export const mod = (score: number) => Math.floor((score - 10) / 2)
export const abilityMod = (c: Character, a: Ability) => mod(c.scores[a])
export const fmt = (n: number) => (n >= 0 ? '+' : '') + n

/** "2d6+3", or just "1" when a hit deals flat damage and rolls no dice. */
export const damageLabel = (spec: { count: number; size: number; flat: number }) =>
  spec.count > 0
    ? `${spec.count}d${spec.size}${spec.flat ? `+${spec.flat}` : ''}`
    : String(spec.flat)

export const saveMod = (c: Character, a: Ability) =>
  abilityMod(c, a) + (c.saveProficiencies.includes(a) ? c.proficiencyBonus : 0)

/** RAW: Half Cover +2, Three-Quarters Cover +5, to AC and Dexterity saving throws. */
export const coverBonus = (cover: CoverDegree) => (cover === 'half' ? 2 : cover === 'three-quarters' ? 5 : 0)

export function skillMod(c: Character, skillId: string): number {
  const skill = SKILLS.find((s) => s.id === skillId)
  if (!skill) return 0
  const rank = c.skills[skillId] ?? 0
  return abilityMod(c, skill.ability) + rank * c.proficiencyBonus
}

export const spellAttack = (c: Character) =>
  c.spellcastingAbility === null ? 0 : c.proficiencyBonus + abilityMod(c, c.spellcastingAbility)

export const spellDC = (c: Character) =>
  c.spellcastingAbility === null ? 0 : 8 + c.proficiencyBonus + abilityMod(c, c.spellcastingAbility)

/** The level pact-magic spells are cast at. Null for non-pact casters. */
export function pactCastLevel(c: Character): number | null {
  return c.spellcasting.kind === 'pact' ? c.spellcasting.castLevel : null
}

export function slotsRemaining(c: Character, level: number): number {
  if (c.spellcasting.kind === 'pact') {
    if (level !== c.spellcasting.castLevel) return 0
    return c.spellcasting.slots - (c.usage['slots:pact'] ?? 0)
  }
  if (c.spellcasting.kind === 'slots') {
    const max = c.spellcasting.perLevel[level - 1] ?? 0
    return max - (c.usage[`slots:${level}`] ?? 0)
  }
  return 0
}

/** The slot level a given spell would actually be cast at. */
export function castLevelFor(c: Character, spellLevel: number): number {
  if (spellLevel === 0) return 0
  if (c.spellcasting.kind === 'pact') return c.spellcasting.castLevel
  return spellLevel
}

export const poolRemaining = (c: Character, poolId: string) => {
  const pool = c.resources.find((p) => p.id === poolId)
  if (!pool) return 0
  return pool.max - (c.usage[poolId] ?? 0)
}

export const carriedWeight = (c: Character) =>
  c.items.reduce((sum, i) => sum + i.weight * i.qty, 0)

export const carryCapacity = (c: Character) => c.scores.str * 15

export const passiveScore = (c: Character, skillId: string) => 10 + skillMod(c, skillId)
export const passivePerception = (c: Character) => passiveScore(c, 'perception')
export const passiveInvestigation = (c: Character) => passiveScore(c, 'investigation')
export const passiveInsight = (c: Character) => passiveScore(c, 'insight')

/** Halves resistant damage, zeroes immune damage, doubles vulnerable damage. Untyped damage is never mitigated. */
export function mitigateDamage(c: Character, amount: number, type: DamageType | null): number {
  if (!type) return amount
  if (c.defenses.immune.includes(type)) return 0
  let n = amount
  if (c.defenses.resistant.includes(type)) n = Math.floor(n / 2)
  if (c.defenses.vulnerable.includes(type)) n *= 2
  return n
}
