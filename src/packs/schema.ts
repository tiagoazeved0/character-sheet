import { z } from 'zod'

const ability = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])

export const featureDefSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), tag: z.string(), sub: z.string(), desc: z.string(),
  pool: z.object({ max: z.number().int().min(0), recovery: z.enum(['short', 'long', 'none']) }).optional(),
})
export const featDefSchema = z.object({ id: z.string().min(1), name: z.string().min(1), desc: z.string() })
export const spellDefSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), level: z.number().int().min(0).max(9), sub: z.string(), desc: z.string(),
})
export const itemDefSchema = z.object({ id: z.string().min(1), name: z.string().min(1), weight: z.number().min(0), desc: z.string() })
export const conditionPackDefSchema = z.object({ id: z.string().min(1), name: z.string().min(1), note: z.string() })


const choiceDefSchema = z.object({
  id: z.string().min(1), label: z.string(), prerequisite: z.string().optional(),
  kind: z.enum(['subclass', 'skill', 'feat']).optional(),
  options: z.array(z.object({ id: z.string().min(1), label: z.string(), requires: z.string().optional() })),
})

export const backgroundDefSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), feature: z.string(),
  skillProficiencies: z.array(z.string()).optional(),
  toolProficiencies: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  choices: z.array(choiceDefSchema).optional(),
})
export const raceDefSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), desc: z.string(),
  features: z.array(z.string()).optional(),
  choices: z.array(choiceDefSchema).optional(),
})

export const classDefSchema = z.object({
  id: z.string().min(1), name: z.string().min(1),
  hitDie: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  saveProficiencies: z.array(ability),
  skillChoices: z.object({ count: z.number().int().min(0), from: z.array(z.string()) }),
  spellcasting: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('pact'),
      table: z.array(z.object({ level: z.number().int().min(1), slots: z.number().int().min(0), castLevel: z.number().int().min(1).max(9) })),
    }),
    z.object({ kind: z.literal('slots'), table: z.array(z.array(z.number().int().min(0))) }),
  ]).optional(),
  pools: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1),
    recovery: z.enum(['short', 'long', 'none']),
    colour: z.enum(['arcane', 'violet', 'green', 'accent']),
    // Exactly 20: a short column is a transcription that stopped early, and the
    // levels past its end would silently read 0 -- a pool that vanishes at 11.
    byLevel: z.array(z.number().int().min(0)).length(20),
  })).optional(),
  levels: z.array(z.object({
    level: z.number().int().min(1).max(20),
    proficiencyBonus: z.number().int().min(0).max(10),
    features: z.array(z.string()),
    choices: z.array(choiceDefSchema).optional(),
  })),
  subclasses: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), desc: z.string().optional(),
    levels: z.array(z.object({ level: z.number().int().min(1).max(20), features: z.array(z.string()) })),
  })).optional(),
})

export const rulesPackSchema = z.object({
  packId: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  edition: z.enum(['2014', '2024', 'custom']),
  license: z.string().min(1),
  content: z.object({
    spells: z.array(spellDefSchema),
    conditions: z.array(conditionPackDefSchema),
    classes: z.array(classDefSchema),
    races: z.array(raceDefSchema),
    backgrounds: z.array(backgroundDefSchema),
    feats: z.array(featDefSchema),
    items: z.array(itemDefSchema),
    features: z.array(featureDefSchema),
  }),
})

export type RulesPackInput = z.infer<typeof rulesPackSchema>
