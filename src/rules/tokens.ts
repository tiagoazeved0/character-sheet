import type { Character } from './types.ts'
import { abilityMod, castLevelFor, fmt, spellAttack, spellDC } from './derive.ts'

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/**
 * Deliberately not an expression language. A fixed set of built-ins plus literal
 * strings the user types into customTokens. It cannot break at the table.
 */
export function expandTokens(text: string, c: Character): string {
  if (!text) return text
  let out = text
  const slot = c.spellcasting.kind === 'pact' ? c.spellcasting.castLevel : castLevelFor(c, 1)

  const builtins: Record<string, string> = {
    '%ATK%': fmt(spellAttack(c)),
    '%DC%': String(spellDC(c)),
    '%PROF%': fmt(c.proficiencyBonus),
    '%LVL%': String(c.level),
    '%SLOT%': ORDINALS[slot] ?? String(slot),
    '%SLOTN%': String(slot),
  }
  for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
    builtins[`%MOD:${a}%`] = fmt(abilityMod(c, a))
  }
  for (const [k, v] of Object.entries({ ...builtins, ...c.customTokens })) {
    out = out.split(k).join(v)
  }
  return out
}
