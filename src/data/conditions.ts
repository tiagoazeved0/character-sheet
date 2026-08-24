import type { ConditionDef } from '../rules/types.ts'

/**
 * Bundled rules content. Paraphrased for now; replace with SRD 5.1 text under
 * CC-BY-4.0 when the rules-pack loader lands in phase 3.
 *
 * `note` is the rules text. `turnText` is this turn's consequence, phrased as an
 * outcome rather than a definition -- that phrasing is the point.
 */
export const CONDITIONS: ConditionDef[] = [
  {
    id: 'blessed', name: 'Blessed', good: true,
    effect: { bonusDie: { size: 4, on: ['attack', 'save'] } },
    note: 'Add 1d4 to attack rolls and saving throws.',
    turnText: 'Add 1d4 to every attack roll and saving throw.',
  },
  {
    id: 'poisoned', name: 'Poisoned', good: false,
    effect: { dis: ['attack', 'check'] },
    note: 'Disadvantage on attack rolls and ability checks.',
    turnText: 'Attacks and ability checks roll twice - keep the lower.',
  },
  {
    id: 'invisible', name: 'Invisible', good: true,
    effect: { adv: ['attack'] },
    note: 'Advantage on attack rolls; attacks against you have disadvantage.',
    turnText: 'Your attacks keep the higher of two dice; attacks against you keep the lower.',
  },
  {
    id: 'frightened', name: 'Frightened', good: false,
    effect: { dis: ['attack', 'check'] },
    note: 'Disadvantage while the source is in sight; you cannot move closer to it.',
    turnText: 'Disadvantage while you can see the source, and you cannot move closer to it.',
  },
  {
    id: 'restrained', name: 'Restrained', good: false,
    effect: { dis: ['attack'], disSave: ['dex'] },
    note: 'Speed 0, disadvantage on attacks and DEX saves.',
    turnText: 'Speed 0. Attacks and DEX saves roll twice, keep the lower.',
  },
  {
    id: 'exhaustion-1', name: 'Exhaustion 1', good: false,
    effect: { dis: ['check'] },
    note: 'Disadvantage on ability checks.',
    turnText: 'Ability checks roll twice - keep the lower. Skills and grapples both suffer.',
  },
  {
    id: 'prone', name: 'Prone', good: false,
    effect: { dis: ['attack'] },
    note: 'Disadvantage on attacks. Melee attacks against you have advantage.',
    turnText: 'Your attacks roll twice, keep the lower. Standing up costs half your movement.',
  },
]

export const conditionById = (id: string) => CONDITIONS.find((c) => c.id === id)
