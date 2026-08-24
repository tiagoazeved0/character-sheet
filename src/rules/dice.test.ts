import { describe, expect, it } from 'vitest'
import { rollD20, rollDamage } from './dice.ts'
import type { ConditionDef } from './types.ts'

/** Scripted roller: returns the given die results in order. */
const seq = (...values: number[]) => {
  let i = 0
  return () => {
    const v = values[i % values.length]!
    i++
    return v
  }
}

const cond = (over: Partial<ConditionDef>): ConditionDef => ({
  id: 'x', name: 'X', effect: {}, note: '', turnText: '', good: false, ...over,
})

const blessed = cond({ id: 'blessed', name: 'Blessed', effect: { bonusDie: { size: 4, on: ['attack', 'save'] } } })
const poisoned = cond({ id: 'poisoned', name: 'Poisoned', effect: { dis: ['attack', 'check'] } })
const invisible = cond({ id: 'invisible', name: 'Invisible', effect: { adv: ['attack'] } })
const restrained = cond({ id: 'restrained', name: 'Restrained', effect: { dis: ['attack'], disSave: ['dex'] } })

describe('rollD20', () => {
  it('adds the modifier to a straight roll', () => {
    const r = rollD20({ label: 'x', modifier: 5, type: 'check', mode: 'normal', conditions: [] }, seq(12, 3))
    expect(r.natural).toBe(12)
    expect(r.total).toBe(17)
    expect(r.both).toBeNull()
  })

  it('keeps the higher die on advantage', () => {
    const r = rollD20({ label: 'x', modifier: 0, type: 'attack', mode: 'adv', conditions: [] }, seq(4, 17))
    expect(r.natural).toBe(17)
    expect(r.both).toEqual([4, 17])
  })

  it('keeps the lower die on disadvantage', () => {
    const r = rollD20({ label: 'x', modifier: 0, type: 'attack', mode: 'dis', conditions: [] }, seq(4, 17))
    expect(r.natural).toBe(4)
  })

  it('cancels advantage against disadvantage', () => {
    const r = rollD20(
      { label: 'x', modifier: 0, type: 'attack', mode: 'normal', conditions: [invisible, poisoned] },
      seq(4, 17),
    )
    expect(r.advantage).toBe(false)
    expect(r.disadvantage).toBe(false)
    expect(r.natural).toBe(4)
    expect(r.both).toBeNull()
  })

  it('lets a condition impose disadvantage on its own', () => {
    const r = rollD20(
      { label: 'x', modifier: 0, type: 'check', mode: 'normal', conditions: [poisoned] },
      seq(18, 6),
    )
    expect(r.disadvantage).toBe(true)
    expect(r.natural).toBe(6)
    expect(r.causes).toContain('Poisoned')
  })

  it('does not apply a condition to a roll type it does not cover', () => {
    const r = rollD20({ label: 'x', modifier: 0, type: 'save', mode: 'normal', conditions: [poisoned] }, seq(18, 6))
    expect(r.disadvantage).toBe(false)
    expect(r.natural).toBe(18)
  })

  it('adds a bonus die and names the cause', () => {
    const r = rollD20({ label: 'x', modifier: 2, type: 'save', mode: 'normal', conditions: [blessed] }, seq(10, 1, 3))
    expect(r.bonusDie).toEqual({ size: 4, value: 3 })
    expect(r.total).toBe(15)
    expect(r.detail).toContain('1d4')
    expect(r.causes).toContain('Blessed')
  })

  it('applies disSave only to the matching ability', () => {
    const dex = rollD20(
      { label: 'x', modifier: 0, type: 'save', ability: 'dex', mode: 'normal', conditions: [restrained] },
      seq(19, 2),
    )
    expect(dex.natural).toBe(2)
    const con = rollD20(
      { label: 'x', modifier: 0, type: 'save', ability: 'con', mode: 'normal', conditions: [restrained] },
      seq(19, 2),
    )
    expect(con.natural).toBe(19)
  })

  it('flags natural 20 and natural 1', () => {
    expect(rollD20({ label: 'x', modifier: 0, type: 'attack', mode: 'normal', conditions: [] }, seq(20)).kind).toBe('crit')
    expect(rollD20({ label: 'x', modifier: 0, type: 'attack', mode: 'normal', conditions: [] }, seq(1)).kind).toBe('fail')
  })

  it('shows the whole sum, never a bare total', () => {
    const r = rollD20({ label: 'x', modifier: 8, type: 'attack', mode: 'adv', conditions: [blessed] }, seq(9, 15, 2))
    expect(r.detail).toContain('9, 15')
    expect(r.detail).toContain('8')
    expect(r.detail).toContain('advantage')
  })
})

describe('rollDamage', () => {
  it('lists every individual die', () => {
    const r = rollDamage(3, 6, 0, [], seq(4, 2, 6))
    expect(r.rolls).toEqual([4, 2, 6])
    expect(r.total).toBe(12)
    expect(r.detail).toContain('4 + 2 + 6')
  })

  it('folds in riders automatically', () => {
    const r = rollDamage(1, 10, 5, [{ name: 'Hex', count: 1, size: 6, type: 'necrotic' }], seq(7, 3))
    expect(r.total).toBe(15)
    expect(r.detail).toContain('Hex')
  })
})
