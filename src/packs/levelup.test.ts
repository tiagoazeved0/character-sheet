import { describe, expect, it } from 'vitest'
import { featuresAtLevel, grantsForLevelRange, mergePools, poolsAtLevel } from './levelup.ts'
import type { ClassDef } from './types.ts'

/** A trimmed stand-in for the real Pugilist ClassDef -- same shape, fewer levels. */
const pugilist: ClassDef = {
  id: 'pugilist',
  name: 'Pugilist',
  hitDie: 10,
  saveProficiencies: ['str', 'con'],
  skillChoices: { count: 2, from: ['acrobatics', 'athletics'] },
  levels: [
    { level: 1, proficiencyBonus: 2, features: ['fisticuffs', 'iron-chin'] },
    { level: 2, proficiencyBonus: 2, features: ['moxie', 'bloodied-but-unbowed'] },
    {
      level: 3, proficiencyBonus: 2, features: ['heavy-hitter'],
      choices: [{ id: 'subclass', label: 'Pugilist Subclass', options: [{ id: 'dog-and-hound', label: 'Dog and Hound' }] }],
    },
    { level: 4, proficiencyBonus: 2, features: ['ability-score-improvement'] },
  ],
  subclasses: [
    {
      id: 'dog-and-hound', name: 'Dog and Hound',
      levels: [
        { level: 3, features: ['brawlers-best-friend', 'mutt-with-moxie'] },
        { level: 6, features: ['coordinated-attack'] },
      ],
    },
  ],
}

describe('featuresAtLevel', () => {
  it('returns only base-class features when no subclass is chosen', () => {
    expect(featuresAtLevel(pugilist, undefined, 1).features).toEqual(['fisticuffs', 'iron-chin'])
  })

  it('surfaces the subclass choice at the level it appears, unresolved', () => {
    const grant = featuresAtLevel(pugilist, undefined, 3)
    expect(grant.features).toEqual(['heavy-hitter'])
    expect(grant.choices).toHaveLength(1)
    expect(grant.choices[0]!.id).toBe('subclass')
  })

  it('layers subclass features onto the base class at the same level once chosen', () => {
    const grant = featuresAtLevel(pugilist, 'dog-and-hound', 3)
    expect(grant.features).toEqual(['heavy-hitter', 'brawlers-best-friend', 'mutt-with-moxie'])
  })

  it('contributes nothing extra at a level the subclass has no features for', () => {
    expect(featuresAtLevel(pugilist, 'dog-and-hound', 1).features).toEqual(['fisticuffs', 'iron-chin'])
  })

  it('returns nothing for a level past the top of the table', () => {
    expect(featuresAtLevel(pugilist, undefined, 20)).toEqual({ features: [], choices: [] })
  })
})

describe('grantsForLevelRange', () => {
  it('creating a level-1 character grants exactly level-1 features', () => {
    expect(grantsForLevelRange(pugilist, undefined, 0, 1).features).toEqual(['fisticuffs', 'iron-chin'])
  })

  it('creating a level-2 character grants levels 1 and 2, not level 3\'s subclass choice', () => {
    const grant = grantsForLevelRange(pugilist, undefined, 0, 2)
    expect(grant.features).toEqual(['fisticuffs', 'iron-chin', 'moxie', 'bloodied-but-unbowed'])
    expect(grant.choices).toEqual([])
  })

  it('leveling up surfaces only the newly-crossed levels, including the subclass choice', () => {
    const grant = grantsForLevelRange(pugilist, undefined, 2, 3)
    expect(grant.features).toEqual(['heavy-hitter'])
    expect(grant.choices).toHaveLength(1)
  })

  it('leveling up with a subclass already chosen layers its features in across the range', () => {
    const grant = grantsForLevelRange(pugilist, 'dog-and-hound', 2, 6)
    expect(grant.features).toEqual([
      'heavy-hitter', 'brawlers-best-friend', 'mutt-with-moxie',
      'ability-score-improvement',
      'coordinated-attack',
    ])
  })

  it('does not duplicate a feature that appears at two levels', () => {
    const dup: ClassDef = {
      ...pugilist,
      levels: [
        { level: 1, proficiencyBonus: 2, features: ['fisticuffs'] },
        { level: 2, proficiencyBonus: 2, features: ['fisticuffs'] },
      ],
    }
    expect(grantsForLevelRange(dup, undefined, 0, 2).features).toEqual(['fisticuffs'])
  })
})

describe('poolsAtLevel', () => {
  // A plateau then a jump, which is what a real class table looks like and why
  // the column is stored rather than interpolated.
  const withPools: ClassDef = {
    ...pugilist,
    pools: [{
      id: 'moxie', name: 'Moxie Points', recovery: 'short', colour: 'accent',
      byLevel: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 11, 12, 12],
    }],
  }

  it('omits a pool the class has none of yet', () => {
    expect(poolsAtLevel(withPools, 1)).toEqual([])
  })

  it('reads the column at the character level, plateaus included', () => {
    expect(poolsAtLevel(withPools, 2)[0]).toMatchObject({ id: 'moxie', max: 2, recovery: 'short' })
    expect(poolsAtLevel(withPools, 3)[0]).toMatchObject({ max: 3 })
    expect(poolsAtLevel(withPools, 4)[0]).toMatchObject({ max: 3 })
    expect(poolsAtLevel(withPools, 20)[0]).toMatchObject({ max: 12 })
  })

  it('is empty for a class that defines no pools', () => {
    expect(poolsAtLevel(pugilist, 5)).toEqual([])
  })
})

describe('mergePools', () => {
  const hitDice = { id: 'hit-dice', name: 'Hit dice (d10)', max: 2, recovery: 'long' as const, colour: 'green' as const }
  const moxie2 = { id: 'moxie', name: 'Moxie Points', max: 2, recovery: 'short' as const, colour: 'accent' as const }
  const moxie3 = { ...moxie2, max: 3 }

  it('raises the max of a pool the class defines', () => {
    expect(mergePools([hitDice, moxie2], [moxie3])).toEqual([hitDice, moxie3])
  })

  it('leaves pools the class knows nothing about untouched', () => {
    const homebrew = { id: 'luck', name: 'Luck', max: 1, recovery: 'long' as const, colour: 'violet' as const }
    expect(mergePools([homebrew], [moxie3])).toEqual([homebrew, moxie3])
  })

  it('writes only max, so a renamed or recoloured pool survives a level-up', () => {
    const renamed = { ...moxie2, name: 'Grit', colour: 'violet' as const }
    expect(mergePools([renamed], [moxie3])).toEqual([{ ...renamed, max: 3 }])
  })

  it('appends a pool that first appears at this level', () => {
    expect(mergePools([hitDice], [moxie2])).toEqual([hitDice, moxie2])
  })
})
