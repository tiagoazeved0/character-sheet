import type { Character } from './types.ts'

/** Short rest: pools that recharge on a short rest, plus pact slots. */
export function shortRest(c: Character): Character {
  const usage = { ...c.usage }
  for (const pool of c.resources) if (pool.recovery === 'short') delete usage[pool.id]
  if (c.spellcasting.kind === 'pact') delete usage['slots:pact']
  return { ...c, usage }
}

/**
 * Long rest: everything back, all conditions and concentration cleared, death
 * saves reset, HP to full. Hit dice regain half your total, rounded down (min 1).
 */
export function longRest(c: Character): Character {
  const usage: Record<string, number> = {}
  for (const pool of c.resources) {
    if (pool.id === 'hit-dice') {
      const spent = c.usage['hit-dice'] ?? 0
      const back = Math.max(1, Math.floor(pool.max / 2))
      const left = Math.max(0, spent - back)
      if (left > 0) usage['hit-dice'] = left
    }
  }
  return {
    ...c,
    usage,
    vitals: {
      hp: c.maxHp,
      temp: 0,
      deathSuccess: 0,
      deathFail: 0,
      conditions: [],
      concentration: null,
    },
  }
}
