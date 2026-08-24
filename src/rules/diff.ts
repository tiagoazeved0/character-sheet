type Leaf = { path: string; before: unknown; after: unknown }

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const escape = (k: string) => k.replace(/~/g, '~0').replace(/\//g, '~1')

/**
 * Produces one entry per changed leaf, keyed by JSON pointer. Arrays are
 * compared as whole values: a reordered inventory is one change, not twelve.
 */
export function diffDocuments(before: unknown, after: unknown, base = ''): Leaf[] {
  if (Object.is(before, after)) return []

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const out: Leaf[] = []
    for (const k of keys) out.push(...diffDocuments(before[k], after[k], `${base}/${escape(k)}`))
    return out
  }

  if (JSON.stringify(before) === JSON.stringify(after)) return []
  return [{ path: base || '/', before, after }]
}
