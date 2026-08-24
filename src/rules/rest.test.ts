import { describe, expect, it } from 'vitest'
import { longRest, shortRest } from './rest.ts'
import { castLevelFor, poolRemaining, skillMod, slotsRemaining, spellAttack, spellDC } from './derive.ts'
import { expandTokens } from './tokens.ts'
import { seedCharacter } from '../data/seed.ts'

const spent = () => {
  const c = seedCharacter()
  return {
    ...c,
    usage: { 'slots:pact': 2, 'dark-luck': 1, arcanum: 1, 'hit-dice': 6 },
    vitals: { ...c.vitals, hp: 11, temp: 4, deathFail: 1, conditions: ['poisoned'], concentration: 'Hex' },
  }
}

describe('short rest', () => {
  it('restores short-rest resources and nothing else', () => {
    const c = shortRest(spent())
    expect(poolRemaining(c, 'slots:pact')).toBe(2)
    expect(poolRemaining(c, 'dark-luck')).toBe(1)
    expect(poolRemaining(c, 'arcanum')).toBe(0)
    expect(c.vitals.hp).toBe(11)
    expect(c.vitals.concentration).toBe('Hex')
  })
})

describe('long rest', () => {
  it('restores everything and clears the board', () => {
    const c = longRest(spent())
    expect(c.vitals.hp).toBe(62)
    expect(c.vitals.temp).toBe(0)
    expect(c.vitals.deathFail).toBe(0)
    expect(c.vitals.conditions).toEqual([])
    expect(c.vitals.concentration).toBeNull()
    expect(poolRemaining(c, 'arcanum')).toBe(1)
  })

  it('gives back only half your hit dice, rounded down', () => {
    const c = longRest(spent())
    expect(c.usage['hit-dice']).toBe(2) // 6 spent, 4 back
    expect(poolRemaining(c, 'hit-dice')).toBe(6)
  })
})

describe('derived values', () => {
  it('computes spell attack and DC from proficiency and casting ability', () => {
    const c = seedCharacter()
    expect(spellAttack(c)).toBe(8) // +3 prof, +5 CHA
    expect(spellDC(c)).toBe(16)
  })

  it('doubles proficiency for expertise', () => {
    const c = seedCharacter()
    expect(skillMod(c, 'persuasion')).toBe(11) // +5 CHA, +6 expertise
    expect(skillMod(c, 'arcana')).toBe(4) // +1 INT, +3 proficient
    expect(skillMod(c, 'stealth')).toBe(2) // +2 DEX, no proficiency
  })

  it('casts every pact spell at the pact slot level', () => {
    const c = seedCharacter()
    expect(castLevelFor(c, 1)).toBe(4)
    expect(castLevelFor(c, 3)).toBe(4)
    expect(castLevelFor(c, 0)).toBe(0)
  })

  it('reports pact slots only at their own level', () => {
    const c = seedCharacter()
    expect(slotsRemaining(c, 4)).toBe(2)
    expect(slotsRemaining(c, 3)).toBe(0)
    expect(slotsRemaining({ ...c, usage: { 'slots:pact': 2 } }, 4)).toBe(0)
  })

  it('follows the level when everything is recomputed', () => {
    const c = { ...seedCharacter(), level: 9, proficiencyBonus: 4 }
    const nine = { ...c, spellcasting: { kind: 'pact' as const, slots: 2, castLevel: 5 } }
    expect(spellDC(nine)).toBe(17)
    expect(castLevelFor(nine, 1)).toBe(5)
  })
})

describe('token expansion', () => {
  it('resolves built-ins against derived values', () => {
    const c = seedCharacter()
    expect(expandTokens('DC %DC%, %ATK% to hit', c)).toBe('DC 16, +8 to hit')
    expect(expandTokens('cast at %SLOT% level', c)).toBe('cast at 4th level')
    expect(expandTokens('%MOD:cha% charisma', c)).toBe('+5 charisma')
  })

  it('lets custom tokens through as literals', () => {
    const c = { ...seedCharacter(), customTokens: { '%PATRON%': 'The Fiend' } }
    expect(expandTokens('sworn to %PATRON%', c)).toBe('sworn to The Fiend')
  })

  it('leaves text without tokens alone', () => {
    expect(expandTokens('plain text', seedCharacter())).toBe('plain text')
  })
})
