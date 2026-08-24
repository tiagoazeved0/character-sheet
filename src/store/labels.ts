/** Human labels for JSON-pointer paths, so history reads as English. */
const EXACT: Record<string, string> = {
  '/maxHp': 'Maximum hit points',
  '/level': 'Level',
  '/proficiencyBonus': 'Proficiency bonus',
  '/ac': 'Armour class',
  '/speed': 'Speed',
  '/hitDie': 'Hit die',
  '/name': 'Name',
  '/classLine': 'Class line',
  '/notes': 'Notes',
  '/spellcastingAbility': 'Spellcasting ability',
  '/vitals/hp': 'Hit points',
  '/vitals/temp': 'Temporary HP',
  '/vitals/deathSuccess': 'Death save successes',
  '/vitals/deathFail': 'Death save failures',
  '/vitals/conditions': 'Conditions',
  '/vitals/concentration': 'Concentration',
}

const PREFIX: [string, string][] = [
  ['/scores/', 'Ability score: '],
  ['/skills/', 'Skill: '],
  ['/usage/', 'Resource: '],
  ['/spellcasting', 'Spellcasting'],
  ['/resources', 'Resource pools'],
  ['/spells', 'Spells'],
  ['/actions', 'Actions'],
  ['/features', 'Features'],
  ['/items', 'Inventory'],
  ['/riders', 'Damage riders'],
  ['/customTokens', 'Custom tokens'],
]

export function labelForPath(path: string): string {
  const exact = EXACT[path]
  if (exact) return exact
  for (const [prefix, label] of PREFIX) {
    if (path.startsWith(prefix)) {
      const tail = path.slice(prefix.length).replace(/\//g, ' ')
      return label.endsWith(': ') ? label + tail : label
    }
  }
  return path
}
