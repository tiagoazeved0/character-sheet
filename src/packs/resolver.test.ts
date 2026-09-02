import { describe, expect, it } from 'vitest'
import { brokenPins, pinStates, resolvePacks, unresolvedPins } from './resolver.ts'
import type { RulesPack } from './types.ts'

const emptyContent = { spells: [], conditions: [], classes: [], races: [], backgrounds: [], feats: [], items: [], features: [] }

const pack = (over: Partial<RulesPack> & { packId: string; version: string }): RulesPack => ({
  title: over.packId, edition: 'custom', license: 'test', content: emptyContent, ...over,
})

describe('resolvePacks', () => {
  it('resolves entries from a single installed, pinned pack', () => {
    const srd = pack({
      packId: 'srd-5.1', version: '1.0.0',
      content: { ...emptyContent, spells: [{ id: 'fireball', name: 'Fireball', level: 3, sub: '', desc: '' }] },
    })
    const index = resolvePacks([srd], [{ packId: 'srd-5.1', version: '1.0.0' }])
    expect(index.get('srd-5.1:spells/fireball')?.entry).toEqual(srd.content.spells[0])
  })

  it('namespaces by packId so two packs never collide on the same entry id', () => {
    const srd2014 = pack({
      packId: 'srd-5.1', version: '1.0.0',
      content: { ...emptyContent, spells: [{ id: 'fireball', name: 'Fireball (2014)', level: 3, sub: '', desc: '' }] },
    })
    const srd2024 = pack({
      packId: 'srd-5.2', version: '1.0.0',
      content: { ...emptyContent, spells: [{ id: 'fireball', name: 'Fireball (2024)', level: 3, sub: '', desc: '' }] },
    })
    const index = resolvePacks(
      [srd2014, srd2024],
      [{ packId: 'srd-5.1', version: '1.0.0' }, { packId: 'srd-5.2', version: '1.0.0' }],
    )
    expect(index.get('srd-5.1:spells/fireball')?.entry).toEqual(srd2014.content.spells[0])
    expect(index.get('srd-5.2:spells/fireball')?.entry).toEqual(srd2024.content.spells[0])
  })

  it('when the same packId is pinned twice, the later pin wins', () => {
    const v1 = pack({
      packId: 'homebrew-ashvale', version: '0.1.0',
      content: { ...emptyContent, feats: [{ id: 'brawler', name: 'Brawler v1', desc: 'old' }] },
    })
    const v2 = pack({
      packId: 'homebrew-ashvale', version: '0.2.0',
      content: { ...emptyContent, feats: [{ id: 'brawler', name: 'Brawler v2', desc: 'new' }] },
    })
    const index = resolvePacks(
      [v1, v2],
      [{ packId: 'homebrew-ashvale', version: '0.1.0' }, { packId: 'homebrew-ashvale', version: '0.2.0' }],
    )
    expect(index.get('homebrew-ashvale:feats/brawler')?.entry).toEqual(v2.content.feats[0])
  })

  it('silently skips a pin with no matching installed pack', () => {
    const index = resolvePacks([], [{ packId: 'missing', version: '1.0.0' }])
    expect(index.size).toBe(0)
  })
})

describe('pinStates', () => {
  const phb = (version: string) => pack({ packId: 'phb-2024', version })

  it('reports a pin that matches an installed pack as ok', () => {
    expect(pinStates([phb('4.0.0')], [{ packId: 'phb-2024', version: '4.0.0' }]))
      .toEqual([{ pin: { packId: 'phb-2024', version: '4.0.0' }, state: 'ok' }])
  })

  it('separates a wrong version from an absent pack', () => {
    const installed = [phb('4.0.0')]
    const pins = [{ packId: 'phb-2024', version: '0.1.0' }, { packId: 'homebrew-pugilist', version: '1.0.0' }]
    expect(pinStates(installed, pins)).toEqual([
      { pin: pins[0], state: 'version-mismatch', available: ['4.0.0'] },
      { pin: pins[1], state: 'missing' },
    ])
  })

  it('offers every installed version as a repin target', () => {
    const states = pinStates([phb('2.0.0'), phb('4.0.0')], [{ packId: 'phb-2024', version: '0.1.0' }])
    expect(states[0]).toMatchObject({ state: 'version-mismatch', available: ['2.0.0', '4.0.0'] })
  })

  it('unresolvedPins keeps only what the reader has to act on', () => {
    const installed = [phb('4.0.0'), pack({ packId: 'homebrew-pugilist', version: '1.0.0' })]
    const pins = [
      { packId: 'homebrew-pugilist', version: '1.0.0' },
      { packId: 'phb-2024', version: '0.1.0' },
    ]
    expect(unresolvedPins(installed, pins).map((s) => s.pin.packId)).toEqual(['phb-2024'])
  })

  // The case that started this: the sheet renders correctly off its cached
  // snapshots while every ref into the pack has stopped resolving.
  it('a stale pin resolves nothing even though the pack is installed', () => {
    const installed = [pack({
      packId: 'phb-2024', version: '4.0.0',
      content: { ...emptyContent, feats: [{ id: 'tavern-brawler', name: 'Tavern Brawler', desc: 'x' }] },
    })]
    const pins = [{ packId: 'phb-2024', version: '0.1.0' }]
    expect(resolvePacks(installed, pins).get('phb-2024:feats/tavern-brawler')).toBeUndefined()
    expect(pinStates(installed, pins)[0]).toMatchObject({ state: 'version-mismatch' })
  })
})

describe('pinStates: an upgrade sitting next to a working pin', () => {
  const pug = (version: string) => pack({ packId: 'homebrew-pugilist', version })

  it('reports outdated when a newer version is installed alongside', () => {
    const states = pinStates([pug('1.0.0'), pug('1.1.0')], [{ packId: 'homebrew-pugilist', version: '1.0.0' }])
    expect(states[0]).toMatchObject({ state: 'outdated', newer: ['1.1.0'] })
  })

  it('stays ok when the pin is already the newest', () => {
    const states = pinStates([pug('1.0.0'), pug('1.1.0')], [{ packId: 'homebrew-pugilist', version: '1.1.0' }])
    expect(states[0]).toMatchObject({ state: 'ok' })
  })

  it('compares numerically, not as strings', () => {
    const states = pinStates([pug('1.9.0'), pug('1.10.0')], [{ packId: 'homebrew-pugilist', version: '1.9.0' }])
    expect(states[0]).toMatchObject({ state: 'outdated', newer: ['1.10.0'] })
  })

  it('never offers an older version as an upgrade', () => {
    const states = pinStates([pug('1.0.0'), pug('1.1.0'), pug('0.9.0')], [{ packId: 'homebrew-pugilist', version: '1.1.0' }])
    expect(states[0]).toMatchObject({ state: 'ok' })
  })

  // A version string it cannot read must make no claim at all: a wrong
  // "update available" that is really a downgrade is worse than staying quiet.
  it('says nothing when a version is not dotted numbers', () => {
    const states = pinStates([pug('1.0.0'), pug('2024-beta')], [{ packId: 'homebrew-pugilist', version: '1.0.0' }])
    expect(states[0]).toMatchObject({ state: 'ok' })
  })

  it('brokenPins excludes outdated, unresolvedPins includes it', () => {
    const installed = [pug('1.0.0'), pug('1.1.0')]
    const pins = [{ packId: 'homebrew-pugilist', version: '1.0.0' }]
    expect(brokenPins(installed, pins)).toEqual([])
    expect(unresolvedPins(installed, pins)).toHaveLength(1)
  })
})
