import { describe, expect, it } from 'vitest'
import { mitigateDamage, passiveInsight, passiveInvestigation, passivePerception } from './derive.ts'
import { seedCharacter } from '../data/seed.ts'

describe('passive scores', () => {
  it('is 10 plus the skill modifier', () => {
    const c = seedCharacter()
    expect(passivePerception(c)).toBe(10)
    expect(passiveInsight(c)).toBe(13)
    expect(passiveInvestigation(c)).toBe(14)
  })
})

describe('mitigateDamage', () => {
  it('leaves untyped damage alone', () => {
    const c = seedCharacter()
    expect(mitigateDamage(c, 20, null)).toBe(20)
  })

  it('halves resistant damage, rounding down', () => {
    const c = seedCharacter()
    expect(c.defenses.resistant).toContain('necrotic')
    expect(mitigateDamage(c, 9, 'necrotic')).toBe(4)
  })

  it('zeroes immune damage', () => {
    const c = seedCharacter()
    c.defenses.immune.push('poison')
    expect(mitigateDamage(c, 40, 'poison')).toBe(0)
  })

  it('doubles vulnerable damage', () => {
    const c = seedCharacter()
    c.defenses.vulnerable.push('fire')
    expect(mitigateDamage(c, 10, 'fire')).toBe(20)
  })

  it('leaves damage of an unlisted type alone', () => {
    const c = seedCharacter()
    expect(mitigateDamage(c, 15, 'radiant')).toBe(15)
  })
})
