import { describe, expect, it } from 'vitest'
import { migrate } from './migrations.ts'
import { CURRENT_SCHEMA_VERSION } from './version.ts'
import { seedCharacter } from '../data/seed.ts'

/** An old document is the current one minus whatever the newer steps added. */
const atVersion = (version: number) => {
  const doc = JSON.parse(JSON.stringify(seedCharacter())) as Record<string, unknown>
  doc.schemaVersion = version
  if (version < 6) { delete doc.companions; delete doc.companionHp }
  if (version < 5) delete doc.classes
  if (version < 4) delete doc.packs
  if (version < 3) delete doc.proficiencies
  return doc
}

describe('schema migrations', () => {
  it('carries a version 5 document to the current version and gives it companions', () => {
    const r = migrate(atVersion(5))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.migrated).toBe(true)
    expect(r.character.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(r.character.companions).toEqual([])
    expect(r.character.companionHp).toEqual({})
  })

  it('walks the whole chain from the oldest migratable version', () => {
    const r = migrate(atVersion(1))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.character.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(r.character.proficiencies.armor).toEqual([])
    expect(r.character.packs).toEqual([])
    expect(r.character.classes).toEqual([])
    expect(r.character.companions).toEqual([])
  })

  it('leaves a current document alone', () => {
    const r = migrate(seedCharacter())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.migrated).toBe(false)
  })

  it('keeps a companion that is already there', () => {
    const r = migrate(atVersion(CURRENT_SCHEMA_VERSION))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.character.companions[0]?.name).toBe('Sable')
    expect(r.character.companions[0]?.actions[0]?.attack?.mod).toBe(3)
    // HP lives in the keyed record, so an undamaged companion carries no entry
    expect(r.character.companionHp).toEqual({})
  })

  it('refuses a version it has no path from', () => {
    const r = migrate({ ...seedCharacter(), schemaVersion: 0 })
    expect(r.ok).toBe(false)
  })

  it('refuses something that is not an object', () => {
    expect(migrate('nope').ok).toBe(false)
  })
})
