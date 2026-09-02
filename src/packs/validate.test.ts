import { describe, expect, it } from 'vitest'
import { looksLikeRulesPack, validatePackImport } from './validate.ts'
import { looksLikeCharacter } from '../rules/schema.ts'

const shell = { packId: 'homebrew-pugilist', version: '1.0.0', title: 'Pugilist', edition: 'custom' as const, license: 'Homebrew' }

describe('validatePackImport', () => {
  it('rejects a non-object', () => {
    const { pack, errors } = validatePackImport('not an object')
    expect(pack).toBeNull()
    expect(errors.length).toBeGreaterThan(0)
  })

  it('rejects missing pack-level fields before looking at content', () => {
    const { pack, errors } = validatePackImport({ title: 'Missing everything else' })
    expect(pack).toBeNull()
    expect(errors.some((e) => e.startsWith('packId'))).toBe(true)
  })

  it('imports a fully valid pack with no errors', () => {
    const { pack, errors } = validatePackImport({
      ...shell,
      content: { features: [{ id: 'fisticuffs', name: 'Fisticuffs', tag: 'Passive', sub: '', desc: '' }] },
    })
    expect(errors).toEqual([])
    expect(pack?.content.features).toHaveLength(1)
    expect(pack?.content.spells).toEqual([]) // categories absent from raw content default to empty, not dropped
  })

  it('keeps the good entries and reports the bad one from a partially-invalid pack', () => {
    const { pack, errors } = validatePackImport({
      ...shell,
      content: {
        features: [
          { id: 'fisticuffs', name: 'Fisticuffs', tag: 'Passive', sub: '', desc: '' },
          { id: 'broken' }, // missing required name/tag/sub/desc
        ],
      },
    })
    expect(pack?.content.features).toHaveLength(1)
    expect(pack?.content.features[0]?.id).toBe('fisticuffs')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/^content\.features\[1\]/)
  })
})

describe('looksLikeRulesPack / looksLikeCharacter', () => {
  const packFile = { packId: 'phb-2024', version: '4.0.0', title: 'PHB', edition: '2024', license: 'x', content: {} }
  const characterFile = { schemaVersion: 6, name: 'Damiana', scores: { str: 17 }, packs: [] }

  it('tells the two importable files apart', () => {
    expect(looksLikeRulesPack(packFile)).toBe(true)
    expect(looksLikeRulesPack(characterFile)).toBe(false)
    expect(looksLikeCharacter(characterFile)).toBe(true)
    expect(looksLikeCharacter(packFile)).toBe(false)
  })

  it('claims nothing about junk, so a broken file still gets the real error', () => {
    for (const junk of [null, undefined, 42, 'x', [], {}, { packId: 'a' }, { name: 'b' }]) {
      expect(looksLikeRulesPack(junk)).toBe(false)
      expect(looksLikeCharacter(junk)).toBe(false)
    }
  })
})
