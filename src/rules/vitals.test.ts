import { describe, expect, it } from 'vitest'
import { applyDamage, applyDeathSave, concentrationDC, grantTemp, heal } from './vitals.ts'
import type { Vitals } from './types.ts'

const v = (over: Partial<Vitals> = {}): Vitals => ({
  hp: 62, temp: 0, deathSuccess: 0, deathFail: 0, conditions: [], concentration: null, ...over,
})

describe('hit points', () => {
  it('drains temporary HP first', () => {
    const r = applyDamage(v({ temp: 10 }), 6)
    expect(r.temp).toBe(4)
    expect(r.hp).toBe(62)
  })

  it('spills through temp into current HP', () => {
    const r = applyDamage(v({ temp: 10 }), 25)
    expect(r.temp).toBe(0)
    expect(r.hp).toBe(47)
  })

  it('floors at zero rather than going negative', () => {
    expect(applyDamage(v({ hp: 4 }), 30).hp).toBe(0)
  })

  it('caps healing at max and clears death saves', () => {
    const r = heal(v({ hp: 0, deathFail: 2, deathSuccess: 1 }), 100, 62)
    expect(r.hp).toBe(62)
    expect(r.deathFail).toBe(0)
    expect(r.deathSuccess).toBe(0)
  })

  it('does not stack temporary HP', () => {
    expect(grantTemp(v({ temp: 14 }), 9).temp).toBe(14)
    expect(grantTemp(v({ temp: 9 }), 14).temp).toBe(14)
  })
})

describe('concentration', () => {
  it('is DC 10 for small hits and half damage for big ones', () => {
    expect(concentrationDC(9)).toBe(10)
    expect(concentrationDC(20)).toBe(10)
    expect(concentrationDC(41)).toBe(20)
  })
})

describe('death saves', () => {
  it('wakes you at 1 HP on a natural 20', () => {
    const r = applyDeathSave(v({ hp: 0, deathFail: 2 }), 20)
    expect(r.vitals.hp).toBe(1)
    expect(r.vitals.deathFail).toBe(0)
  })

  it('counts a natural 1 as two failures', () => {
    expect(applyDeathSave(v({ hp: 0 }), 1).vitals.deathFail).toBe(2)
  })

  it('uses DC 10', () => {
    expect(applyDeathSave(v({ hp: 0 }), 10).vitals.deathSuccess).toBe(1)
    expect(applyDeathSave(v({ hp: 0 }), 9).vitals.deathFail).toBe(1)
  })
})
