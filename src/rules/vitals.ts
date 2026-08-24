import type { Character, Vitals } from './types.ts'

/** Damage drains temporary HP first, then current HP, and never goes negative. */
export function applyDamage(v: Vitals, amount: number): Vitals {
  const fromTemp = Math.min(v.temp, amount)
  const rest = amount - fromTemp
  return { ...v, temp: v.temp - fromTemp, hp: Math.max(0, v.hp - rest) }
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
