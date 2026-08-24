import type { Character } from '../rules/types.ts'
import { abilityMod, fmt, spellAttack, spellDC } from '../rules/derive.ts'
import { hpFraction } from '../rules/vitals.ts'
import { useSession, type Layout } from '../store/session.ts'
import type { useSheetActions } from '../store/actions.ts'

type Props = {
  character: Character
  actions: ReturnType<typeof useSheetActions>
  layout: Layout
  onOpenEditor: () => void
  onOpenLevelUp: () => void
}

export function Header({ character: c, actions, layout, onOpenEditor, onOpenLevelUp }: Props) {
  const setLayout = useSession((s) => s.setLayout)
  const combat = useSession((s) => s.combat)
  const toggleCombat = useSession((s) => s.toggleCombat)

  const frac = hpFraction(c)
  const hpColour = frac < 0.34 ? 'var(--danger-fill)' : 'var(--green-fill)'
  const tempPct = c.maxHp === 0 ? 0 : Math.min(100 - frac * 100, (c.vitals.temp / c.maxHp) * 100)

  return (
    <header className="header">
      <div className="header-inner">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 210 }}>
          <div className="header-name">{c.name}</div>
          <div className="header-class">{c.classLine}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, flexWrap: 'wrap', flex: 1 }}>
          <div className="hp-card">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="caps" style={{ fontSize: 10, color: 'var(--on-dark-muted)' }}>Hit points</span>
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 19, fontWeight: 600 }}>
                {c.vitals.temp > 0 ? `${c.vitals.hp} + ${c.vitals.temp} / ${c.maxHp}` : `${c.vitals.hp} / ${c.maxHp}`}
              </span>
            </div>
            <div className="hp-bar">
              <div style={{ width: `${frac * 100}%`, background: hpColour }} />
              <div style={{ width: `${tempPct}%`, background: 'oklch(0.7 0.12 250)' }} />
            </div>
            <div className="hp-buttons">
              <button className="btn-dmg" onClick={() => actions.takeDamage(5)}>&minus;5</button>
              <button className="btn-dmg" onClick={() => actions.takeDamage(1)}>&minus;1</button>
              <button className="btn-heal" onClick={() => actions.healBy(1)}>+1</button>
              <button className="btn-heal" onClick={() => actions.healBy(5)}>+5</button>
            </div>
          </div>

          <button
            className={`hbtn inspiration ${c.heroicInspiration ? 'active' : ''}`}
            style={{ alignSelf: 'center' }}
            onClick={actions.toggleInspiration}
            title="Heroic inspiration"
          >
            Inspiration
          </button>
          <div className="tile"><div className="tile-value">{c.ac}</div><div className="tile-caption">Armor</div></div>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="hbtn" onClick={actions.shortRest}>Short rest</button>
            <button className="hbtn" onClick={actions.longRest}>Long rest</button>
            <button className={`hbtn combat ${combat ? 'active' : ''}`} onClick={toggleCombat}>Combat mode</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="hbtn" onClick={onOpenEditor}>Characters &amp; edit</button>
            {c.classes.length > 0 && <button className="hbtn" onClick={onOpenLevelUp}>Level up</button>}
            <div className="segmented">
              {(['columns', 'tablet', 'stacked'] as Layout[]).map((l) => (
                <button key={l} className={layout === l ? 'on' : ''} onClick={() => setLayout(l)}>
                  {l[0]!.toUpperCase() + l.slice(1)}
                </button>
              ))}
              <button onClick={() => setLayout(null)} title="Follow the screen size">Auto</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
