import type { Character, Vitals } from './types.ts'

/**
 * Damage drains temporary HP first, then current HP, and never goes negative.
 * Two RAW edge cases layer on top: taking any damage while already at 0 HP is
 * a death save failure (two on a Critical Hit), and Massive Damage -- damage
 * that drops you to 0 with leftover damage equal to or exceeding your HP max
 * -- kills outright, represented by maxing out deathFail.
 */
export function applyDamage(v: Vitals, amount: number, maxHp: number, crit = false): Vitals {
  const wasAtZero = v.hp === 0
  const fromTemp = Math.min(v.temp, amount)
  const rest = amount - fromTemp
  const newHp = Math.max(0, v.hp - rest)
  const overflow = rest - v.hp

  let deathFail = v.deathFail
  if (wasAtZero && amount > 0) deathFail = Math.min(3, deathFail + (crit ? 2 : 1))
  if (!wasAtZero && newHp === 0 && overflow >= maxHp) deathFail = 3

  return { ...v, temp: v.temp - fromTemp, hp: newHp, deathFail }
}

/** Healing is capped at max and clears any accumulated death saves. */
export function heal(v: Vitals, amount: number, maxHp: number): Vitals {
  if (amount <= 0) return v
  return { ...v, hp: Math.min(maxHp, v.hp + amount), deathSuccess: 0, deathFail: 0 }
}

/** Temp HP does not stack: you keep the better pool. */
export const grantTemp = (v: Vitals, amount: number): Vitals => ({ ...v, temp: Math.max(v.temp, amount) })

export const concentrationDC = (damage: number) => Math.max(10, Math.floor(damage / 2))

export type DeathSaveOutcome = { vitals: Vitals; message: string }

/**
 * Nat 20 wakes you at 1 HP. Nat 1 counts double. Otherwise DC 10.
 */
export function applyDeathSave(v: Vitals, natural: number): DeathSaveOutcome {
  if (natural === 20) {
    return { vitals: { ...v, hp: 1, deathSuccess: 0, deathFail: 0 }, message: 'Natural 20 - back up at 1 HP' }
  }
  if (natural === 1) {
    const fails = Math.min(3, v.deathFail + 2)
    return { vitals: { ...v, deathFail: fails }, message: `Natural 1 - two failures (${fails}/3)` }
  }
  if (natural >= 10) {
    const ok = Math.min(3, v.deathSuccess + 1)
    return { vitals: { ...v, deathSuccess: ok }, message: `Success (${ok}/3)` }
  }
  const fails = Math.min(3, v.deathFail + 1)
  return { vitals: { ...v, deathFail: fails }, message: `Failure (${fails}/3)` }
}

export const isDying = (c: Character) => c.vitals.hp === 0
export const isStable = (v: Vitals) => v.deathSuccess >= 3
export const isDead = (v: Vitals) => v.deathFail >= 3

export const hpFraction = (c: Character) => (c.maxHp === 0 ? 0 : c.vitals.hp / c.maxHp)

/**
 * Guided-creation default: max hit die at level 1, then the average roll
 * (rounded up, the standard non-rolled convention) per level after that.
 * A starting point, not a source of truth -- maxHp stays a manually
 * editable field for characters whose real roll history differs.
 */
export function startingHp(hitDie: number, level: number, conMod: number): number {
  const first = hitDie + conMod
  const perLevel = Math.floor(hitDie / 2) + 1 + conMod
  return first + perLevel * (level - 1)
}
