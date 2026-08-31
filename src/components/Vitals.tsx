import { useState } from 'react'
import { DAMAGE_TYPES, type Character, type DamageType } from '../rules/types.ts'
import { abilityMod, coverBonus, fmt, spellAttack, spellDC } from '../rules/derive.ts'
import { hpFraction } from '../rules/vitals.ts'
import { useSession } from '../store/session.ts'
import type { useSheetActions } from '../store/actions.ts'

type Props = { character: Character; actions: ReturnType<typeof useSheetActions> }

/**
 * Everything about how the character is doing right now, in one strip across the
 * top of the sheet. This used to be crammed into the header at 11px; here the
 * numbers get the size they deserve and the damage entry gets room to be used at
 * a table rather than squinted at.
 */
export function Vitals({ character: c, actions }: Props) {
  const cover = useSession((s) => s.cover)
  const ac = c.ac + coverBonus(cover)

  const [amount, setAmount] = useState('')
  const [dmgType, setDmgType] = useState<DamageType | ''>('')
  const [crit, setCrit] = useState(false)

  /** The quick buttons cover chip damage; this is the only path that can carry a type or a crit. */
  const submitDamage = () => {
    const n = Number(amount)
    if (!n) return
    actions.takeDamage(n, dmgType || null, crit)
    setAmount('')
    setCrit(false)
  }

  const frac = hpFraction(c)
  const hpColour = frac < 0.34 ? 'var(--danger-fill)' : 'var(--green-fill)'
  const tempPct = c.maxHp === 0 ? 0 : Math.min(100 - frac * 100, (c.vitals.temp / c.maxHp) * 100)

  return (
    <section className="vitals card">
      <div className="vitals-hp">
        <div className="vitals-hp-head">
          <span className="caps vitals-label">Hit points</span>
          <span className="mono vitals-hp-value">
            {c.vitals.hp}
            {c.vitals.temp > 0 && <span className="vitals-temp"> +{c.vitals.temp}</span>}
            <span className="vitals-hp-max"> / {c.maxHp}</span>
          </span>
        </div>

        <div className="vitals-bar">
          <div style={{ width: `${frac * 100}%`, background: hpColour }} />
          <div style={{ width: `${tempPct}%`, background: 'var(--temp-hp)' }} />
        </div>

        <div className="vitals-quick">
          <button className="btn-dmg" onClick={() => actions.takeDamage(5)}>&minus;5</button>
          <button className="btn-dmg" onClick={() => actions.takeDamage(1)}>&minus;1</button>
          <button className="btn-heal" onClick={() => actions.healBy(1)}>+1</button>
          <button className="btn-heal" onClick={() => actions.healBy(5)}>+5</button>
        </div>

        <div className="vitals-entry">
          <input
            className="mono vitals-amount"
            inputMode="numeric"
            placeholder="0"
            aria-label="Damage amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') submitDamage() }}
          />
          <select
            className="vitals-type"
            aria-label="Damage type"
            value={dmgType}
            onChange={(e) => setDmgType(e.target.value as DamageType | '')}
          >
            <option value="">Untyped</option>
            {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {c.vitals.hp === 0 && (
            <button
              className={`vitals-crit ${crit ? 'on' : ''}`}
              onClick={() => setCrit(!crit)}
              title="Critical hit -- two death save failures instead of one, since you are at 0 HP"
            >
              Crit
            </button>
          )}
          <button className="btn primary" onClick={submitDamage}>Damage</button>
        </div>
      </div>

      <div className="vitals-stats">
        <div className="stat stat-ac" title={cover !== 'none' ? `${c.ac} base + ${coverBonus(cover)} cover` : undefined}>
          <span className="shield" aria-hidden>
            <svg viewBox="0 0 40 46" role="presentation">
              <path d="M20 1 L38 7 v16 c0 11-8 18-18 22 C10 41 2 34 2 23 V7 Z" />
            </svg>
            <span className="stat-value mono">{ac}</span>
          </span>
          <span className="stat-label caps">Armor class</span>
        </div>
        <button className="stat" onClick={() => actions.rollInitiative()}>
          <span className="stat-value mono">{fmt(abilityMod(c, 'dex'))}</span>
          <span className="stat-label caps">Initiative</span>
        </button>
        <div className="stat">
          <span className="stat-value mono">{c.speed}</span>
          <span className="stat-label caps">Speed</span>
        </div>
        <div className="stat">
          <span className="stat-value mono">{fmt(c.proficiencyBonus)}</span>
          <span className="stat-label caps">Proficiency</span>
        </div>
        {c.spellcastingAbility && (
          <div className="stat">
            <span className="stat-value mono">{spellDC(c)} / {fmt(spellAttack(c))}</span>
            <span className="stat-label caps">Spell DC / atk</span>
          </div>
        )}
      </div>
    </section>
  )
}
