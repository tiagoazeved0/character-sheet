import { characterSchema } from './schema.ts'
import { CURRENT_SCHEMA_VERSION } from './version.ts'
import type { Character } from './types.ts'

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>

/**
 * Keyed by the version being migrated FROM. Add one entry per breaking change
 * and never edit an existing entry -- old documents still need the old path.
 */
const MIGRATIONS: Record<number, Migration> = {
  // 0: (doc) => ({ ...doc, schemaVersion: 1, riders: [] }),
  1: (doc) => ({
    ...doc,
    schemaVersion: 2,
    heroicInspiration: false,
    defenses: { resistant: [], immune: [], vulnerable: [] },
    senses: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    background: { name: '', feature: '' },
    personality: { traits: '', ideals: '', bonds: '', flaws: '' },
    characteristics: {
      alignment: '', gender: '', eyes: '', size: '', height: '',
      faith: '', hair: '', skin: '', age: '', weight: '',
    },
    appearance: '',
    portraitUrl: '',
  }),
  2: (doc) => ({
    ...doc,
    schemaVersion: 3,
    proficiencies: { armor: [], weapons: [], tools: [], languages: [] },
  }),
}

export type MigrationResult =
  | { ok: true; character: Character; migrated: boolean }
  | { ok: false; error: string; raw: unknown }

export function migrate(raw: unknown): MigrationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Not an object', raw }
  }
  let doc = raw as Record<string, unknown>
  const startVersion = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0
  let version = startVersion

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) return { ok: false, error: `No migration from schema version ${version}`, raw }
    doc = step(doc)
    version += 1
    doc.schemaVersion = version
  }

  const parsed = characterSchema.safeParse(doc)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), raw }
  }
  return { ok: true, character: parsed.data as Character, migrated: version !== startVersion }
}
