import { describe, expect, it } from 'vitest'
import {
  LANES, canPay, featureIsOption, laneOf, lanePlan, situationTags, spellAffordable, spellCost, turnPlan,
} from './combat.ts'
import { seedCharacter } from '../data/seed.ts'
import type { LanePlan } from './combat.ts'
import type { Character } from './types.ts'

const named = (plan: LanePlan, name: string) => plan.options.find((o) => o.entry.name === name)

describe('laneOf', () => {
  it('reads the tagged lane', () => {
    expect(laneOf({ lane: 'reaction' })).toBe('reaction')
  })

  it('treats an untagged entry as an action', () => {
    expect(laneOf({})).toBe('action')
  })
})

describe('canPay', () => {
  it('is true when nothing is required', () => {
    expect(canPay(seedCharacter(), undefined)).toBe(true)
  })

  it('compares the requirement against what is left in the pool', () => {
    const c = seedCharacter()
    expect(canPay(c, { pool: 'arcanum', amount: 1 })).toBe(true)
    expect(canPay(c, { pool: 'arcanum', amount: 2 })).toBe(false)
    c.usage['arcanum'] = 1
    expect(canPay(c, { pool: 'arcanum', amount: 1 })).toBe(false)
  })

  it('cannot pay out of a pool the character does not have', () => {
    expect(canPay(seedCharacter(), { pool: 'ki', amount: 1 })).toBe(false)
  })
})

describe('spellCost', () => {
  it('charges a cantrip nothing', () => {
    const c = seedCharacter()
    expect(spellCost(c, c.spells.find((s) => s.name === 'Eldritch Blast')!)).toEqual({ kind: 'cantrip' })
  })

  it('charges a pact caster its one slot level, whatever the spell level', () => {
    const c = seedCharacter()
    const fireball = c.spells.find((s) => s.name === 'Fireball')!
    expect(spellCost(c, fireball)).toEqual({ kind: 'slot', poolId: 'slots:pact', level: 4, remaining: 2 })
  })

  it('charges a named pool instead of a slot when the spell has one', () => {
    const c = seedCharacter()
    const arcanum = c.spells.find((s) => s.name === 'Hold Monster')!
    expect(spellCost(c, arcanum)).toEqual({ kind: 'pool', poolId: 'arcanum', remaining: 1 })
  })

  it('charges a standard caster the spell level', () => {
    const c: Character = { ...seedCharacter(), spellcasting: { kind: 'slots', perLevel: [4, 3, 2, 0, 0, 0, 0, 0, 0] } }
    const fireball = c.spells.find((s) => s.name === 'Fireball')!
    expect(spellCost(c, fireball)).toEqual({ kind: 'slot', poolId: 'slots:3', level: 3, remaining: 2 })
  })
})

describe('spellAffordable', () => {
  it('is always true for a cantrip', () => {
    const c = seedCharacter()
    c.usage['slots:pact'] = 2
    expect(spellAffordable(c, c.spells.find((s) => s.name === 'Eldritch Blast')!)).toBe(true)
  })

  it('goes false once the slots are spent', () => {
    const c = seedCharacter()
    const fireball = c.spells.find((s) => s.name === 'Fireball')!
    expect(spellAffordable(c, fireball)).toBe(true)
    c.usage['slots:pact'] = 2
    expect(spellAffordable(c, fireball)).toBe(false)
  })

  it('also honours a pool cost declared alongside the slot', () => {
    const c = seedCharacter()
    const fireball = c.spells.find((s) => s.name === 'Fireball')!
    fireball.requires = { pool: 'dark-luck', amount: 1 }
    expect(spellAffordable(c, fireball)).toBe(true)
    c.usage['dark-luck'] = 1
    expect(spellAffordable(c, fireball)).toBe(false)
  })
})

describe('lanePlan', () => {
  it('sorts an entry into the lane it is tagged with', () => {
    const c = seedCharacter()
    const bonus = lanePlan(c, 'bonus', [])
    expect(bonus.options.map((o) => o.entry.name)).toContain('Misty Step')
    expect(lanePlan(c, 'reaction', []).options.map((o) => o.entry.name)).toEqual(['Counterspell'])
  })

  it('drops options there is nothing left to pay for, and counts them', () => {
    const c = seedCharacter()
    const before = lanePlan(c, 'action', [])
    expect(before.hidden).toBe(0)
    expect(named(before, 'Fireball')).toBeDefined()

    c.usage['slots:pact'] = 2
    const after = lanePlan(c, 'action', [])
    expect(named(after, 'Fireball')).toBeUndefined()
    expect(after.hidden).toBe(before.options.length - after.options.length)
    // The Mystic Arcanum is paid for out of its own pool, so it survives.
    expect(named(after, 'Hold Monster')).toBeDefined()
  })

  it('floats favoured options to the top and names what favoured them', () => {
    const c = seedCharacter()
    const plain = lanePlan(c, 'action', [])
    expect(named(plain, 'Eldritch Blast')!.favoredBy).toEqual([])

    const ranged = lanePlan(c, 'action', ['range'])
    expect(ranged.options.slice(0, 2).every((o) => o.favoredBy.includes('range'))).toBe(true)
    expect(ranged.options[2]!.favoredBy).toEqual([])
  })

  it('keeps sheet order among options nothing favours', () => {
    const c = seedCharacter()
    const names = lanePlan(c, 'action', []).options.filter((o) => o.kind === 'action').map((o) => o.entry.name)
    expect(names).toEqual(c.actions.filter((a) => laneOf(a) === 'action').map((a) => a.name))
  })
})

describe('features on the lanes', () => {
  it('counts a feature as an option only when it spends a pool or names a lane', () => {
    expect(featureIsOption({ id: 'f', name: 'Iron Chin', tag: '', sub: '', desc: '' })).toBe(false)
    expect(featureIsOption({ id: 'f', name: 'Brace Up', tag: '', sub: '', desc: '', pool: 'moxie' })).toBe(true)
    expect(featureIsOption({ id: 'f', name: 'Dash', tag: '', sub: '', desc: '', lane: 'move' })).toBe(true)
  })

  it('puts a pooled feature in its lane with what is left of the pool', () => {
    const c = seedCharacter()
    c.resources.push({ id: 'moxie', name: 'Moxie Points', max: 2, recovery: 'short', colour: 'accent' })
    c.features.push({ id: 'one-two', name: 'One-Two Punch', tag: '', sub: '', desc: '', pool: 'moxie', lane: 'bonus' })

    const option = named(lanePlan(c, 'bonus', []), 'One-Two Punch')
    expect(option).toMatchObject({ kind: 'feature', remaining: 2 })
  })

  it('drops a pooled feature once the pool is empty, and counts it', () => {
    const c = seedCharacter()
    c.resources.push({ id: 'moxie', name: 'Moxie Points', max: 1, recovery: 'short', colour: 'accent' })
    c.features.push({ id: 'one-two', name: 'One-Two Punch', tag: '', sub: '', desc: '', pool: 'moxie', lane: 'bonus' })

    const before = lanePlan(c, 'bonus', [])
    c.usage['moxie'] = 1
    const after = lanePlan(c, 'bonus', [])
    expect(named(after, 'One-Two Punch')).toBeUndefined()
    expect(after.hidden).toBe(before.hidden + 1)
  })

  it('leaves passive features off the lanes entirely', () => {
    const c = seedCharacter()
    c.features.push({ id: 'iron-chin', name: 'Iron Chin', tag: '', sub: '', desc: '' })
    expect(named(lanePlan(c, 'action', []), 'Iron Chin')).toBeUndefined()
  })

  it('sorts an untagged pooled feature into the action lane', () => {
    const c = seedCharacter()
    c.resources.push({ id: 'moxie', name: 'Moxie Points', max: 2, recovery: 'short', colour: 'accent' })
    c.features.push({ id: 'brace', name: 'Brace Up', tag: '', sub: '', desc: '', pool: 'moxie' })
    expect(named(lanePlan(c, 'action', []), 'Brace Up')).toBeDefined()
  })
})

describe('turnPlan', () => {
  it('covers every lane once', () => {
    expect(turnPlan(seedCharacter(), []).map((p) => p.lane)).toEqual(LANES)
  })
})

describe('situationTags', () => {
  it('collects only the tags this character responds to', () => {
    expect(situationTags(seedCharacter())).toEqual(['range'])
  })

  it('is empty when nothing is tagged', () => {
    const c: Character = { ...seedCharacter(), actions: [], spells: [] }
    expect(situationTags(c)).toEqual([])
  })
})
