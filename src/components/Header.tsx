import { useState } from 'react'
import { DAMAGE_TYPES, type Character, type DamageType } from '../rules/types.ts'
import { abilityMod, coverBonus, fmt, spellAttack, spellDC } from '../rules/derive.ts'
import { hpFraction } from '../rules/vitals.ts'
import { useSession } from '../store/session.ts'
import type { useSheetActions } from '../store/actions.ts'

type Props = {
  character: Character
  actions: ReturnType<typeof useSheetActions>
  onOpenEditor: () => void
  onOpenLevelUp: () => void
}

export function Header({ character: c, actions, onOpenEditor, onOpenLevelUp }: Props) {
  const combat = useSession((s) => s.combat)
  const toggleCombat = useSession((s) => s.toggleCombat)
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
    <header className="header">
      <div className="header-inner">
        <div className="header-identity">
          <div className="header-name">{c.name}</div>
          <div className="header-class">{c.classLine}</div>
        </div>

        <div className="header-vitals">
          <div className="hp-card">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="caps" style={{ fontSize: 10, color: 'var(--on-dark-muted)' }}>Hit points</span>
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 19, fontWeight: 600 }}>
                {c.vitals.temp > 0 ? `${c.vitals.hp} + ${c.vitals.temp} / ${c.maxHp}` : `${c.vitals.hp} / ${c.maxHp}`}
              </span>
            </div>
            <div className="hp-bar">
              <div style={{ width: `${frac * 100}%`, background: hpColour }} />
              <div style={{ width: `${tempPct}%`, background: 'var(--temp-hp)' }} />
            </div>
            <div className="hp-buttons">
              <button className="btn-dmg" onClick={() => actions.takeDamage(5)}>&minus;5</button>
              <button className="btn-dmg" onClick={() => actions.takeDamage(1)}>&minus;1</button>
              <button className="btn-heal" onClick={() => actions.healBy(1)}>+1</button>
              <button className="btn-heal" onClick={() => actions.healBy(5)}>+5</button>
            </div>
            <div className="hp-entry">
              <input
                className="hp-amount mono"
                inputMode="numeric"
                placeholder="0"
                aria-label="Damage amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') submitDamage() }}
              />
              <select
                className="hp-type"
                aria-label="Damage type"
                value={dmgType}
                onChange={(e) => setDmgType(e.target.value as DamageType | '')}
              >
                <option value="">Untyped</option>
                {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {c.vitals.hp === 0 && (
                <button
                  className={`hp-crit ${crit ? 'on' : ''}`}
                  onClick={() => setCrit(!crit)}
                  title="Critical hit -- two death save failures instead of one, since you are at 0 HP"
                >
                  Crit
                </button>
              )}
              <button className="btn-dmg" onClick={submitDamage}>Damage</button>
            </div>
          </div>

          <div className="tile" title={cover !== 'none' ? `${c.ac} base + ${coverBonus(cover)} cover` : undefined}>
            <div className="tile-value">{ac}</div>
            <div className="tile-caption">Armor</div>
          </div>
          <button className="tile" onClick={() => actions.rollInitiative()}>
            <div className="tile-value">{fmt(abilityMod(c, 'dex'))}</div>
            <div className="tile-caption">Initiative</div>
          </button>
          <div className="tile"><div className="tile-value">{c.speed}</div><div className="tile-caption">Speed</div></div>
          {c.spellcastingAbility && (
            <div className="tile" style={{ minWidth: 96 }}>
              <div className="tile-value">{spellDC(c)} / {fmt(spellAttack(c))}</div>
              <div className="tile-caption">Spell DC / atk</div>
            </div>
          )}
        </div>

        <div className="header-actions">
          <div>
            <button
              className={`hbtn inspiration ${c.heroicInspiration ? 'active' : ''}`}
              onClick={actions.toggleInspiration}
              title="Heroic inspiration"
            >
              Inspiration
            </button>
            <button className="hbtn" onClick={actions.shortRest}>Short rest</button>
            <button className="hbtn" onClick={actions.longRest}>Long rest</button>
            <button className={`hbtn combat ${combat ? 'active' : ''}`} onClick={toggleCombat}>Combat mode</button>
          </div>
          {/* Split from the play controls above so the cluster stays narrow: as one
              row it is 559px wide and squeezes a stat tile onto a second line. */}
          <div>
            <button className="hbtn" onClick={onOpenEditor}>Characters &amp; edit</button>
            {c.classes.length > 0 && <button className="hbtn" onClick={onOpenLevelUp}>Level up</button>}
          </div>
        </div>
      </div>
    </header>
  )
}
