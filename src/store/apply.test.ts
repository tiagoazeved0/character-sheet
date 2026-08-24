import { describe, expect, it } from 'vitest'
import { coalesce, computeApply, prune, revertMutation, setByPointer } from './apply.ts'
import { seedCharacter } from '../data/seed.ts'
import { longRest, shortRest } from '../rules/rest.ts'
import type { Change } from '../rules/schema.ts'

const at = (ms: number) => new Date(1_700_000_000_000 + ms)

describe('computeApply', () => {
  it('records one change per touched field', () => {
    const c = seedCharacter()
    const { changes } = computeApply(c, {
      label: 'Edit: max HP', channel: 'edit', mutate: (d) => ({ ...d, maxHp: 71 }),
    }, at(0))
    expect(changes.length).toBe(1)
    expect(changes[0]!.path).toBe('/maxHp')
    expect(changes[0]!.label).toBe('Maximum hit points')
    expect(changes[0]!.before).toBe(62)
    expect(changes[0]!.after).toBe(71)
  })

  it('ignores bookkeeping fields', () => {
    const c = seedCharacter()
    const { changes } = computeApply(c, { label: 'noop', channel: 'edit', mutate: (d) => ({ ...d }) }, at(0))
    expect(changes.length).toBe(0)
  })

  it('groups a multi-field operation under one batch', () => {
    const c = seedCharacter()
    const damaged = { ...c, vitals: { ...c.vitals, hp: 20, conditions: ['poisoned'] }, usage: { 'slots:pact': 2 } }
    const { changes } = computeApply(damaged, { label: 'Long rest', channel: 'play', mutate: longRest }, at(0))
    const batchIds = new Set(changes.map((ch) => ch.batchId))
    expect(batchIds.size).toBe(1)
    expect(changes.every((ch) => ch.batchLabel === 'Long rest')).toBe(true)
    const paths = changes.map((ch) => ch.path)
    expect(paths).toContain('/vitals/hp')
    expect(paths).toContain('/vitals/conditions')
  })

  it('leaves the document untouched when nothing changed', () => {
    const c = seedCharacter()
    const { next } = computeApply(c, { label: 'noop', channel: 'play', mutate: (d) => d }, at(0))
    expect(next).toBe(c)
  })
})

describe('coalesce', () => {
  const change = (over: Partial<Change>): Change => ({
    id: Math.random().toString(36), characterId: 'x', at: at(0).toISOString(),
    channel: 'play', path: '/vitals/hp', label: 'Hit points', before: 62, after: 57, ...over,
  })

  it('collapses repeated pokes at the same field', () => {
    let journal = coalesce([], [change({ before: 62, after: 57, at: at(0).toISOString() })])
    journal = coalesce(journal, [change({ before: 57, after: 52, at: at(2000).toISOString() })])
    journal = coalesce(journal, [change({ before: 52, after: 42, at: at(4000).toISOString() })])
    expect(journal.length).toBe(1)
    expect(journal[0]!.before).toBe(62)
    expect(journal[0]!.after).toBe(42)
  })

  it('does not collapse across the window', () => {
    let journal = coalesce([], [change({ at: at(0).toISOString() })])
    journal = coalesce(journal, [change({ at: at(60_000).toISOString() })])
    expect(journal.length).toBe(2)
  })

  it('does not collapse different fields or channels', () => {
    let journal = coalesce([], [change({ path: '/vitals/hp' })])
    journal = coalesce(journal, [change({ path: '/vitals/temp', at: at(1000).toISOString() })])
    journal = coalesce(journal, [change({ path: '/vitals/temp', channel: 'edit', at: at(1500).toISOString() })])
    expect(journal.length).toBe(3)
  })

  it('never collapses a batched change', () => {
    let journal = coalesce([], [change({ batchId: 'b1' })])
    journal = coalesce(journal, [change({ batchId: 'b1', at: at(500).toISOString() })])
    expect(journal.length).toBe(2)
  })
})

describe('retention', () => {
  it('keeps every sheet edit and prunes only play churn', () => {
    const edits: Change[] = Array.from({ length: 5 }, (_, i) => ({
      id: `e${i}`, characterId: 'x', at: at(i).toISOString(), channel: 'edit',
      path: '/maxHp', label: 'Maximum hit points', before: i, after: i + 1,
    }))
    const play: Change[] = Array.from({ length: 600 }, (_, i) => ({
      id: `p${i}`, characterId: 'x', at: at(1000 + i).toISOString(), channel: 'play',
      path: '/vitals/hp', label: 'Hit points', before: i, after: i + 1,
    }))
    const pruned = prune([...edits, ...play])
    expect(pruned.filter((c) => c.channel === 'edit').length).toBe(5)
    expect(pruned.filter((c) => c.channel === 'play').length).toBe(400)
  })
})

describe('revert', () => {
  it('puts back the previous value of a single field', () => {
    const c = seedCharacter()
    const { next, changes } = computeApply(c, {
      label: 'Edit: max HP', channel: 'edit', mutate: (d) => ({ ...d, maxHp: 0 as number }),
    }, at(0))
    const restored = revertMutation(changes[0]!).mutate(next)
    expect(restored.maxHp).toBe(62)
  })

  it('unwinds a whole batch in reverse', () => {
    const c = seedCharacter()
    const spent = { ...c, vitals: { ...c.vitals, hp: 12 }, usage: { 'slots:pact': 2, 'dark-luck': 1 } }
    const { next, changes } = computeApply(spent, { label: 'Short rest', channel: 'play', mutate: shortRest }, at(0))
    const unwound = changes.reduceRight((doc, ch) => revertMutation(ch).mutate(doc), next)
    expect(unwound.usage['slots:pact']).toBe(2)
    expect(unwound.usage['dark-luck']).toBe(1)
  })

  it('writes through nested pointers without touching siblings', () => {
    const c = seedCharacter()
    const updated = setByPointer(c, '/vitals/hp', 3)
    expect(updated.vitals.hp).toBe(3)
    expect(updated.vitals.temp).toBe(c.vitals.temp)
    expect(updated.maxHp).toBe(62)
  })
})
