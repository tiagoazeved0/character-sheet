export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

export type RollType = 'attack' | 'check' | 'save'
export type AdvMode = 'normal' | 'adv' | 'dis'
/** Cover the character themself is behind, as a target -- bonus to AC and Dexterity saves. */
export type CoverDegree = 'none' | 'half' | 'three-quarters'

/** How a condition bends the maths. Mirrors the prototype's effect shape. */
export type ConditionEffect = {
  adv?: RollType[]
  dis?: RollType[]
  disSave?: Ability[]
  bonusDie?: { size: number; on: RollType[] }
}

export type ConditionDef = {
  id: string
  name: string
  effect: ConditionEffect
  /** Rules text, shown in the conditions panel. */
  note: string
  /** This turn's consequence, phrased as an outcome. Shown in combat mode. */
  turnText: string
  good: boolean
}

export type ResourcePool = {
  id: string
  name: string
  max: number
  recovery: 'short' | 'long' | 'none'
  colour: 'arcane' | 'violet' | 'green' | 'accent'
}

export type Spellcasting =
  | { kind: 'pact'; slots: number; castLevel: number }
  | { kind: 'slots'; perLevel: number[] }
  | { kind: 'none' }

export type DamageSpec = { count: number; size: number; flat: number; type?: string }

export type SpellEntry = {
  id: string
  name: string
  level: number
  sub: string
  desc: string
  concentration?: boolean
  /** Spends this pool instead of a spell slot (e.g. Mystic Arcanum). */
  pool?: string
  attack?: { mod?: number; label?: string }
  damage?: DamageSpec & { label: string }
  lane?: Lane
  favoredWhen?: string[]
}

export type Lane = 'action' | 'bonus' | 'move' | 'reaction' | 'free'

export type ActionEntry = {
  id: string
  name: string
  tag: string
  sub: string
  desc: string
  lane?: Lane
  attack?: { mod: number }
  damage?: DamageSpec & { label: string }
  check?: { mod: number; label: string }
  /** Sets concentration on this spell name when used. */
  concentrationOn?: string
  favoredWhen?: string[]
}

export type FeatureEntry = {
  id: string
  name: string
  tag: string
  sub: string
  desc: string
  /** Spends a pip from this resource pool when used. */
  pool?: string
  /** Fully-qualified pack id this was populated from, e.g. "homebrew-pugilist:features/fisticuffs". The fields above ARE the cached snapshot. */
  ref?: string
}

export type ItemEntry = {
  id: string
  name: string
  qty: number
  weight: number
  desc: string
  /** Consumable that heals when used. */
  heals?: DamageSpec
}

/** Damage riders that apply automatically, e.g. Hex while concentrating. */
export type Rider = { name: string; count: number; size: number; type: string; requiresConcentrationOn?: string }

export type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic'
  | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder'

export const DAMAGE_TYPES: DamageType[] = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
]

export type Defenses = { resistant: DamageType[]; immune: DamageType[]; vulnerable: DamageType[] }

export type SenseKind = 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight'
export type Sense = { kind: SenseKind; range: number }

export type Currency = { cp: number; sp: number; ep: number; gp: number; pp: number }

export type Background = { name: string; feature: string }
export type Personality = { traits: string; ideals: string; bonds: string; flaws: string }
export type Characteristics = {
  alignment: string; gender: string; eyes: string; size: string; height: string
  faith: string; hair: string; skin: string; age: string; weight: string
}

/** Reference-only: categories trained in, not individual skills. Never affects the maths. */
export type Proficiencies = { armor: string[]; weapons: string[]; tools: string[]; languages: string[] }

/**
 * Exact pack versions this character was built against. Metadata only for now --
 * nothing resolves against it until guided creation/level-up (phase 6) lands.
 * Kept here rather than imported from src/packs/ so src/rules/ stays dependency-free.
 */
export type PackPin = { packId: string; version: string }

export type Vitals = {
  hp: number
  temp: number
  deathSuccess: number
  deathFail: number
  conditions: string[]
  concentration: string | null
}

export type Character = {
  schemaVersion: number
  id: string
  name: string
  classLine: string
  level: number
  /** Stored, not derived: multiclass makes level-derivation wrong. */
  proficiencyBonus: number
  hitDie: number
  scores: Record<Ability, number>
  saveProficiencies: Ability[]
  /** 0 none, 1 proficient, 2 expertise. */
  skills: Record<string, 0 | 1 | 2>
  maxHp: number
  ac: number
  speed: number
  spellcastingAbility: Ability | null
  spellcasting: Spellcasting
  resources: ResourcePool[]
  spells: SpellEntry[]
  actions: ActionEntry[]
  features: FeatureEntry[]
  items: ItemEntry[]
  riders: Rider[]
  packs: PackPin[]
  /** Set when built/leveled through the guided-creation wizard; absent for blank-slate/duplicate characters. */
  raceRef?: string
  backgroundRef?: string
  classes: { classRef: string; level: number; subclassId?: string }[]
  customTokens: Record<string, string>
  notes: string
  heroicInspiration: boolean
  defenses: Defenses
  senses: Sense[]
  currency: Currency
  background: Background
  personality: Personality
  characteristics: Characteristics
  proficiencies: Proficiencies
  appearance: string
  portraitUrl: string
  vitals: Vitals
  /** Pool id -> pips spent. Spell slots use the reserved id 'slots:<level>'. */
  usage: Record<string, number>
  createdAt: string
  updatedAt: string
}

export type LogKind = 'normal' | 'crit' | 'fail' | 'damage' | 'system'
export type LogEntry = {
  id: number
  label: string
  detail: string
  total: number | null
  kind: LogKind
}
