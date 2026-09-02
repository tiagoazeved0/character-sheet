import { z } from 'zod'

export { CURRENT_SCHEMA_VERSION } from './version.ts'

const ability = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const lane = z.enum(['action', 'bonus', 'move', 'reaction', 'free'])
const damage = z.object({
  count: z.number().int().min(0),
  size: z.number().int().min(2),
  flat: z.number().int(),
  type: z.string().optional(),
})

const requirement = z.object({ pool: z.string().min(1), amount: z.number().int().min(1) })

const damageType = z.enum([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
])
const senseKind = z.enum(['darkvision', 'blindsight', 'tremorsense', 'truesight'])

const defensesSchema = z.object({
  resistant: z.array(damageType),
  immune: z.array(damageType),
  vulnerable: z.array(damageType),
})
const senseSchema = z.object({ kind: senseKind, range: z.number().int().min(0) })
const currencySchema = z.object({
  cp: z.number().int().min(0), sp: z.number().int().min(0), ep: z.number().int().min(0),
  gp: z.number().int().min(0), pp: z.number().int().min(0),
})
const backgroundSchema = z.object({ name: z.string(), feature: z.string() })
const personalitySchema = z.object({ traits: z.string(), ideals: z.string(), bonds: z.string(), flaws: z.string() })
const characteristicsSchema = z.object({
  alignment: z.string(), gender: z.string(), eyes: z.string(), size: z.string(), height: z.string(),
  faith: z.string(), hair: z.string(), skin: z.string(), age: z.string(), weight: z.string(),
})
const proficienciesSchema = z.object({
  armor: z.array(z.string()), weapons: z.array(z.string()), tools: z.array(z.string()), languages: z.array(z.string()),
})

export const resourcePoolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  max: z.number().int().min(0),
  recovery: z.enum(['short', 'long', 'none']),
  colour: z.enum(['arcane', 'violet', 'green', 'accent']),
})

export const spellcastingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pact'), slots: z.number().int().min(0), castLevel: z.number().int().min(1).max(9) }),
  z.object({ kind: z.literal('slots'), perLevel: z.array(z.number().int().min(0)).length(9) }),
  z.object({ kind: z.literal('none') }),
])

const actionEntry = z.object({
  id: z.string(), name: z.string(), tag: z.string(), sub: z.string(), desc: z.string(),
  lane: lane.optional(),
  attack: z.object({ mod: z.number() }).optional(),
  damage: damage.extend({ label: z.string() }).optional(),
  check: z.object({ mod: z.number(), label: z.string() }).optional(),
  concentrationOn: z.string().optional(),
  requires: requirement.optional(),
  favoredWhen: z.array(z.string()).optional(),
})

export const characterSchema = z.object({
  schemaVersion: z.number().int(),
  id: z.string().min(1),
  name: z.string().min(1),
  classLine: z.string(),
  level: z.number().int().min(1).max(20),
  proficiencyBonus: z.number().int().min(0).max(10),
  hitDie: z.number().int(),
  scores: z.record(ability, z.number().int().min(1).max(30)),
  saveProficiencies: z.array(ability),
  skills: z.record(z.string(), z.union([z.literal(0), z.literal(1), z.literal(2)])),
  maxHp: z.number().int().min(1),
  ac: z.number().int().min(0),
  speed: z.number().int().min(0),
  spellcastingAbility: ability.nullable(),
  spellcasting: spellcastingSchema,
  resources: z.array(resourcePoolSchema),
  spells: z.array(z.object({
    id: z.string(), name: z.string(), level: z.number().int().min(0).max(9),
    sub: z.string(), desc: z.string(),
    concentration: z.boolean().optional(),
    pool: z.string().optional(),
    attack: z.object({ mod: z.number().optional(), label: z.string().optional() }).optional(),
    damage: damage.extend({ label: z.string() }).optional(),
    lane: lane.optional(),
    requires: requirement.optional(),
    favoredWhen: z.array(z.string()).optional(),
  })),
  actions: z.array(actionEntry),
  companions: z.array(z.object({
    id: z.string(), name: z.string(), tag: z.string(),
    ac: z.number().int().min(0),
    maxHp: z.number().int().min(0),
    speed: z.string(), senses: z.string(), desc: z.string(),
    actions: z.array(actionEntry),
  })),
  features: z.array(z.object({
    id: z.string(), name: z.string(), tag: z.string(), sub: z.string(),
    desc: z.string(), pool: z.string().optional(), lane: lane.optional(), ref: z.string().optional(),
  })),
  items: z.array(z.object({
    id: z.string(), name: z.string(), qty: z.number().int().min(0),
    weight: z.number().min(0), desc: z.string(), heals: damage.optional(),
  })),
  riders: z.array(z.object({
    name: z.string(), count: z.number().int(), size: z.number().int(),
    type: z.string(), requiresConcentrationOn: z.string().optional(),
  })),
  packs: z.array(z.object({ packId: z.string().min(1), version: z.string().min(1) })),
  raceRef: z.string().optional(),
  backgroundRef: z.string().optional(),
  classes: z.array(z.object({
    classRef: z.string().min(1), level: z.number().int().min(1).max(20), subclassId: z.string().optional(),
  })),
  customTokens: z.record(z.string(), z.string()),
  notes: z.string(),
  heroicInspiration: z.boolean(),
  defenses: defensesSchema,
  senses: z.array(senseSchema),
  currency: currencySchema,
  background: backgroundSchema,
  personality: personalitySchema,
  characteristics: characteristicsSchema,
  proficiencies: proficienciesSchema,
  appearance: z.string(),
  portraitUrl: z.string(),
  vitals: z.object({
    hp: z.number().int().min(0),
    temp: z.number().int().min(0),
    deathSuccess: z.number().int().min(0).max(3),
    deathFail: z.number().int().min(0).max(3),
    conditions: z.array(z.string()),
    concentration: z.string().nullable(),
  }),
  usage: z.record(z.string(), z.number().int().min(0)),
  companionHp: z.record(z.string(), z.number().int().min(0)),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const changeSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  at: z.string(),
  batchId: z.string().optional(),
  batchLabel: z.string().optional(),
  channel: z.enum(['edit', 'play']),
  path: z.string(),
  label: z.string(),
  before: z.unknown(),
  after: z.unknown(),
})

export type CharacterInput = z.infer<typeof characterSchema>
export type Change = z.infer<typeof changeSchema>
