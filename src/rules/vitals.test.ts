import { describe, expect, it } from 'vitest'
import { applyDamage, applyDeathSave, concentrationDC, grantTemp, heal } from './vitals.ts'
import type { Vitals } from './types.ts'

const v = (over: Partial<Vitals> = {}): Vitals => ({
  hp: 62, temp: 0, deathSuccess: 0, deathFail: 0, conditions: [], concentration: null, ...over,
})

describe('hit points', () => {
  it('drains temporary HP first', () => {
    const r = applyDamage(v({ temp: 10 }), 6, 62)
    expect(r.temp).toBe(4)
    expect(r.hp).toBe(62)
  })

  it('spills through temp into current HP', () => {
    const r = applyDamage(v({ temp: 10 }), 25, 62)
    expect(r.temp).toBe(0)
    expect(r.hp).toBe(47)
  })

  it('floors at zero rather than going negative', () => {
    expect(applyDamage(v({ hp: 4 }), 30, 62).hp).toBe(0)
  })

  it('counts a death save failure for any damage taken at 0 HP', () => {
    const r = applyDamage(v({ hp: 0, deathFail: 1 }), 3, 62)
    expect(r.hp).toBe(0)
    expect(r.deathFail).toBe(2)
  })

  it('counts two death save failures for a Critical Hit at 0 HP', () => {
    const r = applyDamage(v({ hp: 0 }), 3, 62, true)
    expect(r.deathFail).toBe(2)
  })

  it('caps death save failures at 3', () => {
    expect(applyDamage(v({ hp: 0, deathFail: 2 }), 3, 62, true).deathFail).toBe(3)
  })

  it('does not add a death save failure when damage does not land at 0 HP', () => {
    expect(applyDamage(v({ hp: 10 }), 3, 62).deathFail).toBe(0)
  })

  it('kills outright on Massive Damage: dropped to 0 with leftover damage >= HP max', () => {
    // HP max 12, current 6, takes 18: drops to 0 with 12 left over, which equals the HP max.
    const r = applyDamage(v({ hp: 6 }), 18, 12)
    expect(r.hp).toBe(0)
    expect(r.deathFail).toBe(3)
  })

  it('does not trigger Massive Damage when leftover damage is under the HP max', () => {
    // HP max 12, current 6, takes 17: drops to 0 with 11 left over, just under the max.
    const r = applyDamage(v({ hp: 6 }), 17, 12)
    expect(r.hp).toBe(0)
    expect(r.deathFail).toBe(0)
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
