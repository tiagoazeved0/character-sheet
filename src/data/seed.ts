import { CURRENT_SCHEMA_VERSION } from '../rules/version.ts'
import { SKILLS } from '../rules/skills.ts'
import type { Character } from '../rules/types.ts'

/**
 * Seed character from the design handoff, used as the first-run fixture.
 * Treat these numbers as sample data, not as product values.
 */
export function seedCharacter(): Character {
  const now = new Date().toISOString()
  const skills = Object.fromEntries(SKILLS.map((s) => [s.id, 0 as 0 | 1 | 2]))
  skills['arcana'] = 1; skills['insight'] = 1; skills['intimidation'] = 1; skills['investigation'] = 1
  skills['deception'] = 2; skills['persuasion'] = 2

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'seed-vessa',
    name: 'Vessa Thorne',
    classLine: 'Half-Elf - Warlock 8 - The Fiend',
    level: 8,
    proficiencyBonus: 3,
    hitDie: 8,
    scores: { str: 10, dex: 14, con: 14, int: 12, wis: 11, cha: 20 },
    saveProficiencies: ['wis', 'cha'],
    skills,
    maxHp: 62,
    ac: 15,
    speed: 30,
    spellcastingAbility: 'cha',
    spellcasting: { kind: 'pact', slots: 2, castLevel: 4 },
    resources: [
      { id: 'slots:pact', name: 'Pact Magic slots', max: 2, recovery: 'short', colour: 'arcane' },
      { id: 'arcanum', name: 'Mystic Arcanum', max: 1, recovery: 'long', colour: 'violet' },
      { id: 'dark-luck', name: "Dark One's Own Luck", max: 1, recovery: 'short', colour: 'accent' },
      { id: 'hit-dice', name: 'Hit dice', max: 8, recovery: 'long', colour: 'green' },
    ],
    spells: [
      { id: 'eldritch-blast', name: 'Eldritch Blast', level: 0, sub: 'Cantrip - 1 action - 120 ft - 3 beams', desc: 'Each beam is a ranged spell attack for 1d10 force + %MOD:cha% (Agonizing Blast). Repelling Blast pushes 10 ft.', attack: { label: 'Eldritch Blast beam' }, damage: { count: 1, size: 10, flat: 5, type: 'force', label: 'Eldritch Blast beam' }, lane: 'action', favoredWhen: ['range'] },
      { id: 'minor-illusion', name: 'Minor Illusion', level: 0, sub: 'Cantrip - 1 action - 30 ft - 1 min', desc: 'A sound, or an object no larger than a 5-foot cube.', lane: 'action' },
      { id: 'prestidigitation', name: 'Prestidigitation', level: 0, sub: 'Cantrip - 1 action - 10 ft', desc: 'Harmless sensory trick; clean or soil, chill or warm.', lane: 'action' },
      { id: 'hex', name: 'Hex', level: 1, concentration: true, sub: '1 bonus action - 90 ft - Conc. 1 hour', desc: 'Adds 1d6 necrotic to your hits against the target; it has disadvantage on one ability of your choice.', lane: 'bonus' },
      { id: 'armor-of-agathys', name: 'Armor of Agathys', level: 1, sub: '1 action - Self - 1 hour', desc: 'Temporary HP, and melee attackers take the same in cold damage while it lasts (%SLOT%-level slot).', lane: 'action' },
      { id: 'misty-step', name: 'Misty Step', level: 2, sub: '1 bonus action - Self - 30 ft teleport', desc: 'Vanish in silver mist and reappear in an unoccupied space you can see.', lane: 'bonus' },
      { id: 'hold-person', name: 'Hold Person', level: 2, concentration: true, sub: '1 action - 60 ft - Conc. 1 min - WIS save DC %DC%', desc: 'Paralyses a humanoid; it repeats the save at the end of each of its turns.', lane: 'action' },
      { id: 'counterspell', name: 'Counterspell', level: 3, sub: '1 reaction - 60 ft', desc: 'Interrupt a spell of 4th level or lower automatically; higher needs a DC 10 + level check.', lane: 'reaction' },
      { id: 'fireball', name: 'Fireball', level: 3, sub: '1 action - 150 ft - 20-ft sphere - DEX save DC %DC%', desc: 'Fire damage in a %SLOT%-level slot, half on a successful save.', damage: { count: 9, size: 6, flat: 0, type: 'fire', label: 'Fireball damage' }, lane: 'action' },
      { id: 'hunger-of-hadar', name: 'Hunger of Hadar', level: 3, concentration: true, sub: '1 action - 150 ft - Conc. 1 min', desc: '20-ft sphere of blind cold: 2d6 cold on entry, 2d6 acid at the end of each turn.', lane: 'action' },
      { id: 'banishment', name: 'Banishment', level: 4, concentration: true, sub: '1 action - 60 ft - Conc. 1 min - CHA save DC %DC%', desc: 'Send a creature to a harmless demiplane for the duration.', lane: 'action' },
      { id: 'dimension-door', name: 'Dimension Door', level: 4, sub: '1 action - 500 ft', desc: 'Teleport yourself and one willing creature to a place you can picture.', lane: 'action' },
      { id: 'hold-monster', name: 'Hold Monster', level: 5, pool: 'arcanum', concentration: true, sub: 'Mystic Arcanum - 1 action - 90 ft - WIS save DC %DC%', desc: 'As Hold Person, but any creature except undead. Once per long rest, no slot spent.', lane: 'action' },
    ],
    actions: [
      { id: 'eb', name: 'Eldritch Blast', tag: 'Action', sub: '3 beams - %ATK% to hit - 1d10+5 force each', desc: 'Roll each beam separately; Repelling Blast shoves 10 ft on a hit.', attack: { mod: 8 }, damage: { count: 1, size: 10, flat: 5, type: 'force', label: 'Eldritch Blast beam' }, lane: 'action', favoredWhen: ['range'] },
      { id: 'pact-blade', name: 'Pact Blade (glaive)', tag: 'Action', sub: 'Thirsting Blade - 2 attacks - %ATK% to hit - 1d10+5 slashing', desc: 'Charisma-based attacks with the manifested pact weapon; reach 10 ft.', attack: { mod: 8 }, damage: { count: 1, size: 10, flat: 5, type: 'slashing', label: 'Pact Blade damage' }, lane: 'action' },
      { id: 'cast-hex', name: 'Hex', tag: 'Bonus action', sub: 'Concentration - adds 1d6 necrotic to your hits', desc: 'Mark a target; also gives it disadvantage on an ability of your choice.', concentrationOn: 'Hex', lane: 'bonus' },
      { id: 'dodge', name: 'Dodge', tag: 'Action', sub: 'Attacks against you have disadvantage until your next turn', desc: 'You also make DEX saves with advantage. Ends if you are incapacitated or your speed drops to 0.', lane: 'action' },
      { id: 'disengage', name: 'Disengage', tag: 'Action', sub: 'Your movement no longer provokes opportunity attacks', desc: '', lane: 'action' },
      { id: 'grapple', name: 'Grapple', tag: 'Action', sub: 'Athletics contest', desc: 'Your STR (Athletics) against the target Athletics or Acrobatics.', check: { mod: 0, label: 'Athletics (grapple)' }, lane: 'action' },
      { id: 'ready', name: 'Ready an action', tag: 'Action', sub: 'Choose a trigger and a reaction', desc: 'Concentration is required if the readied action is a spell.', lane: 'action' },
    ],
    features: [
      { id: 'dark-blessing', name: "Dark One's Blessing", tag: 'Passive', sub: 'Temp HP equal to CHA mod + warlock level', desc: 'When you reduce a hostile creature to 0 HP you gain temporary hit points.' },
      { id: 'dark-luck', name: "Dark One's Own Luck", tag: '1 per rest', sub: 'Add 1d10 to an ability check or saving throw', desc: 'Declare it after rolling but before the outcome is known.', pool: 'dark-luck' },
      { id: 'agonizing', name: 'Agonizing Blast', tag: 'Invocation', sub: 'Add CHA mod to each Eldritch Blast beam that hits', desc: '' },
      { id: 'thirsting', name: 'Thirsting Blade', tag: 'Invocation', sub: 'Attack twice with your pact weapon', desc: '' },
      { id: 'devils-sight', name: "Devil's Sight", tag: 'Invocation', sub: 'See normally in darkness, magical or not, out to 120 ft', desc: '' },
      { id: 'repelling', name: 'Repelling Blast', tag: 'Invocation', sub: 'Push a creature up to 10 ft away on an Eldritch Blast hit', desc: '' },
      { id: 'fey-ancestry', name: 'Fey Ancestry', tag: 'Racial', sub: 'Advantage on saves against being charmed; immune to magical sleep', desc: '' },
      { id: 'pact-magic', name: 'Pact Magic', tag: 'Class', sub: '2 slots - always %SLOT% level - return on a short rest', desc: 'Every spell you cast is cast at %SLOT% level, so displayed damage is already upcast.' },
    ],
    items: [
      { id: 'blade', name: 'Pact Blade (glaive)', qty: 1, weight: 6, desc: 'Manifests in a breath of soot; counts as magical.' },
      { id: 'armor', name: 'Studded leather +1', qty: 1, weight: 13, desc: 'AC 15 with DEX. Attuned.' },
      { id: 'cloak', name: 'Cloak of Protection', qty: 1, weight: 1, desc: '+1 AC and +1 to all saving throws. Attuned.' },
      { id: 'potion', name: 'Potion of healing', qty: 2, weight: 1, desc: 'Regain 2d4+2 hit points as an action.', heals: { count: 2, size: 4, flat: 2 } },
      { id: 'bag', name: 'Bag of holding', qty: 1, weight: 15, desc: '500 lb inside; 15 lb always.' },
      { id: 'dagger', name: 'Silvered dagger', qty: 1, weight: 1, desc: '' },
      { id: 'rope', name: 'Rope, hempen (50 ft)', qty: 1, weight: 10, desc: '' },
      { id: 'purse', name: 'Coin purse', qty: 1, weight: 3, desc: '148 gp - 12 sp - 40 cp' },
    ],
    riders: [{ name: 'Hex', count: 1, size: 6, type: 'necrotic', requiresConcentrationOn: 'Hex' }],
    packs: [],
    classes: [],
    customTokens: {},
    notes: 'Session 12 - the Sanguine Ledger names a fourth signatory.\n\nOwed: 40gp to Brannock. Owed to me: one favour, House Velen.',
    heroicInspiration: false,
    defenses: { resistant: ['necrotic'], immune: [], vulnerable: [] },
    senses: [{ kind: 'darkvision', range: 120 }],
    currency: { cp: 40, sp: 12, ep: 0, gp: 148, pp: 0 },
    background: { name: 'Charlatan', feature: 'False Identity - a second, well-documented identity, with access it affords' },
    personality: {
      traits: 'I know a story relevant to almost every situation.',
      ideals: 'Freedom. Chains are meant to be broken, including the ones I made this pact with.',
      bonds: 'The Fiend owns a piece of me I mean to buy back.',
      flaws: 'I can\'t resist swindling people out of their money.',
    },
    characteristics: {
      alignment: 'Chaotic Neutral', gender: 'Female', eyes: 'Black, faintly glowing', size: 'Medium', height: '5\'6"',
      faith: 'The Fiend', hair: 'Auburn', skin: 'Pale', age: '29', weight: '138 lb',
    },
    proficiencies: { armor: ['Light armor'], weapons: ['Simple weapons', 'Hand crossbows', 'Rapiers', 'Shortswords'], tools: [], languages: ['Common', 'Infernal', 'Undercommon'] },
    appearance: 'A soot-dark tattoo of a broken chain runs from her left wrist to her elbow, brighter when the pact stirs.',
    portraitUrl: '',
    vitals: { hp: 62, temp: 0, deathSuccess: 0, deathFail: 0, conditions: [], concentration: null },
    usage: {},
    createdAt: now,
    updatedAt: now,
  }
}
