import { CURRENT_SCHEMA_VERSION } from '../rules/version.ts'
import { SKILLS } from '../rules/skills.ts'
import type { Character } from '../rules/types.ts'

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

/** A valid, empty character. Guided creation is deferred; this plus duplicate covers it. */
export function blankCharacter(name = 'New character'): Character {
  const now = new Date().toISOString()
  const skills = Object.fromEntries(SKILLS.map((s) => [s.id, 0 as const]))
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: uid(),
    name,
    classLine: 'Level 1',
    level: 1,
    proficiencyBonus: 2,
    hitDie: 8,
    scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saveProficiencies: [],
    skills,
    maxHp: 8,
    ac: 10,
    speed: 30,
    spellcastingAbility: null,
    spellcasting: { kind: 'none' },
    resources: [{ id: 'hit-dice', name: 'Hit dice', max: 1, recovery: 'long', colour: 'green' }],
    spells: [],
    actions: [],
    features: [],
    items: [],
    riders: [],
    customTokens: {},
    notes: '',
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
    proficiencies: { armor: [], weapons: [], tools: [], languages: [] },
    appearance: '',
    portraitUrl: '',
    vitals: { hp: 8, temp: 0, deathSuccess: 0, deathFail: 0, conditions: [], concentration: null },
    usage: {},
    createdAt: now,
    updatedAt: now,
  }
}

/** Copy an existing character under a new id and name. */
export function duplicateCharacter(source: Character, name: string): Character {
  const now = new Date().toISOString()
  return { ...structuredClone(source), id: uid(), name, createdAt: now, updatedAt: now }
}

/** The by-level default, offered as a suggestion in the editor. */
export const suggestedProficiency = (level: number) => Math.floor((level - 1) / 4) + 2
