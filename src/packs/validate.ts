import { z } from 'zod'
import {
  backgroundDefSchema, classDefSchema, conditionPackDefSchema, featDefSchema,
  featureDefSchema, itemDefSchema, raceDefSchema, spellDefSchema,
} from './schema.ts'
import type { RulesPack } from './types.ts'

const packShellSchema = z.object({
  packId: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  edition: z.enum(['2014', '2024', 'custom']),
  license: z.string().min(1),
})

const CATEGORY_SCHEMAS = {
  spells: spellDefSchema,
  conditions: conditionPackDefSchema,
  classes: classDefSchema,
  races: raceDefSchema,
  backgrounds: backgroundDefSchema,
  feats: featDefSchema,
  items: itemDefSchema,
  features: featureDefSchema,
} as const

export type PackImportResult = { pack: RulesPack | null; errors: string[] }

/**
 * Validates pack-level fields strictly; validates each content category
 * entry-by-entry so one bad spell doesn't reject an otherwise-good pack.
 * Mirrors migrations.ts's `${path}: ${message}` error shape.
 */
export function validatePackImport(raw: unknown): PackImportResult {
  if (typeof raw !== 'object' || raw === null) return { pack: null, errors: ['Not an object'] }
  const doc = raw as Record<string, unknown>

  const shell = packShellSchema.safeParse(doc)
  if (!shell.success) {
    return { pack: null, errors: shell.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }

  const rawContent = typeof doc.content === 'object' && doc.content !== null ? (doc.content as Record<string, unknown>) : {}
  const errors: string[] = []
  const content: RulesPack['content'] = { spells: [], conditions: [], classes: [], races: [], backgrounds: [], feats: [], items: [], features: [] }

  for (const category of Object.keys(CATEGORY_SCHEMAS) as (keyof typeof CATEGORY_SCHEMAS)[]) {
    const list = rawContent[category]
    if (!Array.isArray(list)) continue
    const schema = CATEGORY_SCHEMAS[category]
    list.forEach((item, i) => {
      const result = schema.safeParse(item)
      if (result.success) (content[category] as unknown[]).push(result.data)
      else errors.push(...result.error.issues.map((issue) => `content.${category}[${i}].${issue.path.join('.')}: ${issue.message}`))
    })
  }

  return { pack: { ...shell.data, content }, errors }
}
