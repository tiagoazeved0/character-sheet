import { rollD20, rollDamage, type DamageRider } from '../rules/dice.ts'
import { applyDamage, applyDeathSave, concentrationDC, grantTemp, heal } from '../rules/vitals.ts'
import { longRest, shortRest } from '../rules/rest.ts'
import { abilityMod, coverBonus, fmt, mitigateDamage, saveMod, skillMod } from '../rules/derive.ts'
import { ABILITY_NAMES, type Ability, type Character, type DamageSpec, type DamageType } from '../rules/types.ts'
import { conditionById } from '../data/conditions.ts'
import { useCharacters } from './character.ts'
import { useSession } from './session.ts'

const activeConditions = (c: Character) =>
  c.vitals.conditions.map(conditionById).filter((x): x is NonNullable<typeof x> => Boolean(x))

const activeRiders = (c: Character): DamageRider[] =>
  c.riders
    .filter((r) => !r.requiresConcentrationOn || c.vitals.concentration === r.requiresConcentrationOn)
    .map((r) => ({ name: r.name, count: r.count, size: r.size, type: r.type }))

/**
 * Every roll and every state change the sheet can perform. Rolls go to the
 * session log; state changes go through the character store's apply().
 */
export function useSheetActions(character: Character | null) {
  const apply = useCharacters((s) => s.apply)
  const push = useSession((s) => s.push)
  const adv = useSession((s) => s.adv)
  const pendingCrit = useSession((s) => s.pendingCrit)
  const setPendingCrit = useSession((s) => s.setPendingCrit)
  const cover = useSession((s) => s.cover)
  const promptConcentration = useSession((s) => s.promptConcentration)

  const d20 = (label: string, modifier: number, type: 'attack' | 'check' | 'save', ability?: Ability) => {
    if (!character) return null
    const result = rollD20({ label, modifier, type, ability, mode: adv, conditions: activeConditions(character) })
    push({ label, detail: result.detail, total: result.total, kind: result.kind })
    if (type === 'attack') setPendingCrit(result.kind === 'crit')
    return result
  }

  /** Doubles all damage dice if the most recent attack roll for this character was a Critical Hit. */
  const damage = (label: string, spec: DamageSpec) => {
    if (!character) return null
    const result = rollDamage(spec.count, spec.size, spec.flat, activeRiders(character), pendingCrit)
    push({ label, detail: result.detail, total: result.total, kind: 'damage' })
    setPendingCrit(false)
    return result
  }

  return {
    rollAbility: (a: Ability) => d20(`${ABILITY_NAMES[a]} check`, abilityMod(character!, a), 'check', a),
    /** Cover adds its bonus to Dexterity saves only, per RAW. */
    rollSave: (a: Ability) => d20(`${ABILITY_NAMES[a]} save`, saveMod(character!, a) + (a === 'dex' ? coverBonus(cover) : 0), 'save', a),
    rollSkill: (id: string, name: string) => d20(name, skillMod(character!, id), 'check'),
    rollInitiative: () => d20('Initiative', abilityMod(character!, 'dex'), 'check', 'dex'),
    rollAttack: (label: string, mod: number) => d20(`${label} (${fmt(mod)})`, mod, 'attack'),
    rollDamageSpec: damage,

    /**
     * `type` mitigates against the character's stored resistances/immunities/vulnerabilities;
     * omit for untyped damage. `crit` doubles the death-save failure if this damage lands
     * while the character is already at 0 HP (RAW: "Damage at 0 Hit Points").
     */
    takeDamage(amount: number, type: DamageType | null = null, crit = false) {
      if (!character) return
      const mitigated = mitigateDamage(character, amount, type)
      const conc = character.vitals.concentration
      apply({
        label: type ? `Damage ${mitigated} ${type}` : `Damage ${mitigated}`,
        channel: 'play',
        mutate: (c) => ({ ...c, vitals: applyDamage(c.vitals, mitigated, c.maxHp, crit) }),
      })
      if (conc) promptConcentration(concentrationDC(mitigated))
    },

    healBy(amount: number) {
      apply({
        label: `Heal ${amount}`,
        channel: 'play',
        mutate: (c) => ({ ...c, vitals: heal(c.vitals, amount, c.maxHp) }),
      })
    },

    gainTemp(amount: number) {
      apply({ label: `Temp HP ${amount}`, channel: 'play', mutate: (c) => ({ ...c, vitals: grantTemp(c.vitals, amount) }) })
    },

    toggleCondition(id: string) {
      apply({
        label: 'Conditions',
        channel: 'play',
        mutate: (c) => ({
          ...c,
          vitals: {
            ...c.vitals,
            conditions: c.vitals.conditions.includes(id)
              ? c.vitals.conditions.filter((x) => x !== id)
              : [...c.vitals.conditions, id],
          },
        }),
      })
    },

    setConcentration(spell: string | null) {
      apply({ label: 'Concentration', channel: 'play', mutate: (c) => ({ ...c, vitals: { ...c.vitals, concentration: spell } }) })
    },

    toggleInspiration() {
      apply({ label: 'Heroic inspiration', channel: 'play', mutate: (c) => ({ ...c, heroicInspiration: !c.heroicInspiration }) })
    },

    /** Tap pip i to spend up to i+1; tap the last filled pip to refund one. */
    setUsage(poolId: string, used: number) {
      apply({
        label: 'Resource',
        channel: 'play',
        mutate: (c) => {
          const usage = { ...c.usage }
          if (used <= 0) delete usage[poolId]
          else usage[poolId] = used
          return { ...c, usage }
        },
      })
    },

    spendPool(poolId: string, amount = 1) {
      apply({
        label: 'Resource',
        channel: 'play',
        mutate: (c) => ({ ...c, usage: { ...c.usage, [poolId]: (c.usage[poolId] ?? 0) + amount } }),
      })
    },

    rollDeathSave() {
      if (!character) return
      const result = rollD20(
        { label: 'Death save', modifier: 0, type: 'save', mode: adv, conditions: [] },
      )
      apply({
        label: 'Death save',
        channel: 'play',
        mutate: (c) => ({ ...c, vitals: applyDeathSave(c.vitals, result.natural).vitals }),
      })
      const outcome = applyDeathSave(character.vitals, result.natural)
      push({ label: 'Death save', detail: `${result.detail} - ${outcome.message}`, total: result.total, kind: result.kind })
    },

    rollConcentrationSave(dc: number) {
      if (!character) return
      const result = d20(`Concentration save (DC ${dc})`, saveMod(character, 'con'), 'save', 'con')
      promptConcentration(0)
      if (result && result.total < dc) {
        apply({ label: 'Concentration', channel: 'play', mutate: (c) => ({ ...c, vitals: { ...c.vitals, concentration: null } }) })
      }
    },

    shortRest() {
      apply({ label: 'Short rest', channel: 'play', mutate: shortRest })
      push({ label: 'Short rest', detail: 'Short-rest resources restored', total: null, kind: 'system' })
    },

    longRest() {
      apply({ label: 'Long rest', channel: 'play', mutate: longRest })
      push({ label: 'Long rest', detail: 'Everything restored, conditions and concentration cleared', total: null, kind: 'system' })
    },

    /** Companions take damage like anything else at the table, so their HP is
     *  play-channel state, not something the editor has to be opened for. */
    companionHp(id: string, delta: number) {
      apply({
        label: 'Companion HP',
        channel: 'play',
        mutate: (c) => {
          const companion = c.companions.find((k) => k.id === id)
          if (!companion) return c
          const current = c.companionHp[id] ?? companion.maxHp
          return { ...c, companionHp: { ...c.companionHp, [id]: Math.max(0, Math.min(companion.maxHp, current + delta)) } }
        },
      })
    },

    edit(label: string, mutate: (c: Character) => Character) {
      apply({ label, channel: 'edit', mutate })
    },
  }
}
