import { describe, expect, it } from 'vitest'
import { resolvePacks } from './resolver.ts'
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
