import type { Ability } from '../rules/types.ts'

export type FeatureDef = {
  id: string
  name: string
  tag: string
  sub: string
  desc: string
  pool?: { max: number; recovery: 'short' | 'long' | 'none' }
}

export type FeatDef = { id: string; name: string; desc: string }
export type BackgroundDef = { id: string; name: string; feature: string }
export type RaceDef = { id: string; name: string; desc: string }
export type SpellDef = { id: string; name: string; level: number; sub: string; desc: string }
export type ItemDef = { id: string; name: string; weight: number; desc: string }
export type ConditionPackDef = { id: string; name: string; note: string }

export type ChoiceDef = {
  id: string
  label: string
  prerequisite?: string
  options: { id: string; label: string; requires?: string }[]
}

export type ClassLevel = {
  level: number
  proficiencyBonus: number
  /** Feature ids, resolved within the same pack's `content.features`. */
  features: string[]
  choices?: ChoiceDef[]
}

export type ClassDef = {
  id: string
  name: string
  hitDie: 6 | 8 | 10 | 12
  saveProficiencies: Ability[]
  skillChoices: { count: number; from: string[] }
  spellcasting?:
    | { kind: 'pact'; table: { level: number; slots: number; castLevel: number }[] }
    | { kind: 'slots'; table: number[][] } // [charLevel][spellLevel]
  levels: ClassLevel[]
}

export type RulesPack = {
  packId: string
  version: string
  title: string
  edition: '2014' | '2024' | 'custom'
  license: string
  content: {
    spells: SpellDef[]
    conditions: ConditionPackDef[]
    classes: ClassDef[]
    races: RaceDef[]
    backgrounds: BackgroundDef[]
    feats: FeatDef[]
    items: ItemDef[]
    features: FeatureDef[]
  }
}
