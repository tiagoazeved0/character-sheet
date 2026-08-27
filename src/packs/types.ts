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

export type AbilityBlock = { score: number; mod: number; save: number }

/** A monster/mount/NPC stat block. Combat blocks (traits/actions/etc.) are prose, mirroring how the book itself presents them. */
export type MonsterDef = {
  id: string
  name: string
  size: string
  type: string
  alignment: string
  ac: number
  initiative: string
  hp: string
  speed: string
  abilities: Record<Ability, AbilityBlock>
  skills?: string
  resistances?: string
  immunities?: string
  vulnerabilities?: string
  senses: string
  languages: string
  cr: string
  traits?: string
  actions?: string
  bonusActions?: string
  reactions?: string
  legendaryActions?: string
}
export type SpellDef = { id: string; name: string; level: number; sub: string; desc: string }
export type ItemDef = { id: string; name: string; weight: number; desc: string }
export type ConditionPackDef = { id: string; name: string; note: string }

export type ChoiceDef = {
  id: string
  label: string
  prerequisite?: string
  /**
   * Tells the creation wizard/level-up how to apply the selected option:
   * 'subclass' -> becomes the character's subclassId; 'skill' -> the option
   * id is a skill id, marked proficient; 'feat' -> the option id is resolved
   * from the same pack's `content.feats` into a feature row. Absent means
   * informational only (no automatic application).
   */
  kind?: 'subclass' | 'skill' | 'feat'
  options: { id: string; label: string; requires?: string }[]
}

export type BackgroundDef = {
  id: string
  name: string
  feature: string
  /** Structured grants, filled in as source text becomes available. Absent -> the creation wizard falls back to manual selection. */
  skillProficiencies?: string[]
  toolProficiencies?: string[]
  languages?: string[]
  /** Always-granted feature ids, resolved within the same pack's `content.features`. */
  features?: string[]
  choices?: ChoiceDef[]
}

export type RaceDef = {
  id: string
  name: string
  desc: string
  /** Always-granted feature ids (e.g. Human's Creature Type, Resourceful), resolved within the same pack's `content.features`. */
  features?: string[]
  /** Choice-driven traits, e.g. Human's "choose 1 skill" (Skillful) / "choose 1 origin feat" (Versatile). */
  choices?: ChoiceDef[]
}

export type ClassLevel = {
  level: number
  proficiencyBonus: number
  /** Feature ids, resolved within the same pack's `content.features`. Base-class features only -- subclass features live on SubclassDef. */
  features: string[]
  choices?: ChoiceDef[]
}

/** A subclass's own feature grants, layered on top of the base class at the same character level. */
export type SubclassDef = {
  id: string
  name: string
  desc?: string
  levels: { level: number; features: string[] }[]
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
  subclasses?: SubclassDef[]
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
    monsters: MonsterDef[]
  }
}
