import type { ConditionDef } from '../rules/types.ts'

/**
 * The fifteen conditions, plus a few common spell effects that behave like one
 * at the table. Wording is paraphrased, not SRD text -- replace with the real
 * CC-BY-4.0 text and its attribution when a bundled SRD pack lands.
 *
 * `note` is the rules text. `turnText` is this turn's consequence, phrased as an
 * outcome rather than a definition -- that phrasing is the point.
 *
 * Only what bends a roll *you* make is in `effect`. Plenty of these also give
 * attackers advantage against you, which the sheet cannot roll on their behalf,
 * so it stays in the text.
 */
export const CONDITIONS: ConditionDef[] = [
  {
    id: 'blinded', name: 'Blinded', good: false,
    effect: { dis: ['attack'] },
    note: 'You cannot see and automatically fail any check that needs sight. Your attacks have disadvantage; attacks against you have advantage.',
    turnText: 'Your attacks roll twice, keep the lower. Anything you try to see, you fail.',
  },
  {
    id: 'charmed', name: 'Charmed', good: false,
    effect: {},
    note: 'You cannot attack the charmer or target them with a harmful effect. They have advantage on social checks against you.',
    turnText: 'You cannot attack whoever charmed you, or target them harmfully.',
  },
  {
    id: 'deafened', name: 'Deafened', good: false,
    effect: {},
    note: 'You cannot hear and automatically fail any check that needs hearing.',
    turnText: 'Anything you try to hear, you fail.',
  },
  {
    id: 'frightened', name: 'Frightened', good: false,
    effect: { dis: ['attack', 'check'] },
    note: 'Disadvantage on checks and attacks while the source is in sight, and you cannot willingly move closer to it.',
    turnText: 'Disadvantage while you can see the source, and you cannot move closer to it.',
  },
  {
    id: 'grappled', name: 'Grappled', good: false,
    effect: {},
    note: 'Your speed is 0 and cannot be increased. Ends if the grappler is incapacitated or you are moved out of reach.',
    turnText: 'Speed 0. Escape with an Athletics or Acrobatics check against their DC.',
  },
  {
    id: 'incapacitated', name: 'Incapacitated', good: false,
    effect: {},
    note: 'You can take no actions and no reactions.',
    turnText: 'No actions, no reactions. Concentration ends.',
  },
  {
    id: 'invisible', name: 'Invisible', good: true,
    effect: { adv: ['attack'] },
    note: 'You cannot be seen without magic or a special sense. Your attacks have advantage; attacks against you have disadvantage.',
    turnText: 'Your attacks keep the higher of two dice; attacks against you keep the lower.',
  },
  {
    id: 'paralyzed', name: 'Paralyzed', good: false,
    effect: { autoFailSave: ['str', 'dex'] },
    note: 'Incapacitated, cannot move or speak, and you fail STR and DEX saves automatically. Attacks against you have advantage, and any hit from within 5 ft is a critical hit.',
    turnText: 'No actions. STR and DEX saves fail outright. Anything hitting you from 5 ft crits.',
  },
  {
    id: 'petrified', name: 'Petrified', good: false,
    effect: { autoFailSave: ['str', 'dex'] },
    note: 'You and your gear turn to stone: incapacitated, unaware, resistant to all damage, immune to poison and disease. STR and DEX saves fail automatically.',
    turnText: 'Stone. No actions, resistance to everything, STR and DEX saves fail outright.',
  },
  {
    id: 'poisoned', name: 'Poisoned', good: false,
    effect: { dis: ['attack', 'check'] },
    note: 'Disadvantage on attack rolls and ability checks.',
    turnText: 'Attacks and ability checks roll twice - keep the lower.',
  },
  {
    id: 'prone', name: 'Prone', good: false,
    effect: { dis: ['attack'] },
    note: 'You can only crawl. Disadvantage on attacks. Melee attacks against you have advantage; ranged attacks against you have disadvantage.',
    turnText: 'Your attacks roll twice, keep the lower. Standing up costs half your movement.',
  },
  {
    id: 'restrained', name: 'Restrained', good: false,
    effect: { dis: ['attack'], disSave: ['dex'] },
    note: 'Speed 0, disadvantage on attacks and DEX saves. Attacks against you have advantage.',
    turnText: 'Speed 0. Attacks and DEX saves roll twice, keep the lower.',
  },
  {
    id: 'stunned', name: 'Stunned', good: false,
    effect: { autoFailSave: ['str', 'dex'] },
    note: 'Incapacitated, cannot move, can speak only falteringly. STR and DEX saves fail automatically, and attacks against you have advantage.',
    turnText: 'No actions, no movement. STR and DEX saves fail outright.',
  },
  {
    id: 'unconscious', name: 'Unconscious', good: false,
    effect: { autoFailSave: ['str', 'dex'] },
    note: 'Incapacitated, unaware, prone, and you drop what you are holding. STR and DEX saves fail automatically. Attacks against you have advantage, and any hit from within 5 ft is a critical hit.',
    turnText: 'Out. STR and DEX saves fail outright. Anything hitting you from 5 ft crits.',
  },

  // Exhaustion is a ladder, not a switch: each level also carries every level
  // below it, so exactly one of these should be active at a time.
  {
    id: 'exhaustion-1', name: 'Exhaustion 1', good: false,
    effect: { dis: ['check'] },
    note: 'Disadvantage on ability checks.',
    turnText: 'Ability checks roll twice - keep the lower. Skills and grapples both suffer.',
  },
  {
    id: 'exhaustion-2', name: 'Exhaustion 2', good: false,
    effect: { dis: ['check'] },
    note: 'Disadvantage on ability checks. Speed halved.',
    turnText: 'Ability checks roll twice, keep the lower. Half speed.',
  },
  {
    id: 'exhaustion-3', name: 'Exhaustion 3', good: false,
    effect: { dis: ['check', 'attack', 'save'] },
    note: 'Disadvantage on ability checks, attack rolls and saving throws. Speed halved.',
    turnText: 'Everything rolls twice and keeps the lower. Half speed.',
  },
  {
    id: 'exhaustion-4', name: 'Exhaustion 4', good: false,
    effect: { dis: ['check', 'attack', 'save'] },
    note: 'Disadvantage on checks, attacks and saves. Speed halved. Hit point maximum halved.',
    turnText: 'Everything rolls twice, keeps the lower. Half speed, half maximum hit points.',
  },
  {
    id: 'exhaustion-5', name: 'Exhaustion 5', good: false,
    effect: { dis: ['check', 'attack', 'save'] },
    note: 'Disadvantage on checks, attacks and saves. Hit point maximum halved. Speed reduced to 0.',
    turnText: 'Everything rolls twice, keeps the lower. Half maximum hit points. You cannot move.',
  },
  {
    id: 'exhaustion-6', name: 'Exhaustion 6', good: false,
    effect: { dis: ['check', 'attack', 'save'] },
    note: 'Death.',
    turnText: 'Death.',
  },

  // Not a condition, but it behaves like one on the sheet and gets toggled just
  // as often. The panel is called "Conditions & effects" for this reason. Bane is
  // the obvious counterpart and is deliberately absent: ConditionEffect can add a
  // die but not subtract one, and a chip whose maths does nothing is worse than
  // no chip at all.
  {
    id: 'blessed', name: 'Blessed', good: true,
    effect: { bonusDie: { size: 4, on: ['attack', 'save'] } },
    note: 'Add 1d4 to attack rolls and saving throws. Concentration, from Bless.',
    turnText: 'Add 1d4 to every attack roll and saving throw.',
  },
]

export const conditionById = (id: string) => CONDITIONS.find((c) => c.id === id)
