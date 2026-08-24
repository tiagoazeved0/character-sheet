import type { ChoiceDef, ClassDef } from './types.ts'

export type LevelGrants = { features: string[]; choices: ChoiceDef[] }

/**
 * What a class -- and, if one is chosen, its subclass -- grants at exactly
 * this character level. Subclass features layer on top of the base class's
 * at the same level; a subclass with nothing at this level contributes
 * nothing extra.
 */
export function featuresAtLevel(classDef: ClassDef, subclassId: string | undefined, level: number): LevelGrants {
  const base = classDef.levels.find((l) => l.level === level)
  const features = [...(base?.features ?? [])]
  const choices = [...(base?.choices ?? [])]

  if (subclassId) {
    const subclass = classDef.subclasses?.find((s) => s.id === subclassId)
    const subLevel = subclass?.levels.find((l) => l.level === level)
    if (subLevel) features.push(...subLevel.features)
  }

  return { features, choices }
}

/**
 * Accumulates grants across (fromLevel, toLevel] -- creating a level-2
 * character calls this with (0, 2); leveling up from 2 to 3 calls it with
 * (2, 3). A feature already granted earlier in the range isn't re-listed
 * even if it somehow appears at two levels.
 */
export function grantsForLevelRange(
  classDef: ClassDef,
  subclassId: string | undefined,
  fromLevel: number,
  toLevel: number,
): LevelGrants {
  const seen = new Set<string>()
  const features: string[] = []
  const choices: ChoiceDef[] = []

  for (let level = fromLevel + 1; level <= toLevel; level++) {
    const grant = featuresAtLevel(classDef, subclassId, level)
    for (const id of grant.features) {
      if (seen.has(id)) continue
      seen.add(id)
      features.push(id)
    }
    choices.push(...grant.choices)
  }

  return { features, choices }
}
