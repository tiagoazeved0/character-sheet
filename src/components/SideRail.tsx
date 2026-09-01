import { useState } from 'react'
import type { AdvMode, Character } from '../rules/types.ts'
import { CONDITIONS, conditionById } from '../data/conditions.ts'
import { useSession } from '../store/session.ts'
import { Menu } from './Menu.tsx'
import type { useSheetActions } from '../store/actions.ts'

type Props = { character: Character; actions: ReturnType<typeof useSheetActions> }

export function SideRail({ character: c, actions }: Props) {
  return (
    <>
      <DicePanel actions={actions} />
      <ConditionsPanel character={c} actions={actions} />
      <ResourcesPanel character={c} actions={actions} />
    </>
  )
}

const DICE = [4, 6, 8, 10, 12, 20, 100]

function DicePanel({ actions }: { actions: Props['actions'] }) {
  const { adv, setAdv, log, clearLog } = useSession()
  const [count, setCount] = useState(1)
  return (
    <div className="dice">
      <div className="dice-head">
        <span className="display" style={{ fontSize: 15 }}>Dice</span>
        <button className="dice-clear" onClick={clearLog}>Clear</button>
      </div>
      <div className="segmented">
        {(['dis', 'normal', 'adv'] as AdvMode[]).map((m) => (
          <button key={m} className={adv === m ? 'on' : ''} onClick={() => setAdv(m)} style={{ flex: 1 }}>
            {m === 'dis' ? 'Disadv.' : m === 'adv' ? 'Adv.' : 'Normal'}
          </button>
        ))}
      </div>
      {/* The adv/disadv toggle above governs rolls the sheet makes for you. These
          are plain dice with nothing added -- the roll you want when the table
          asks for one and the sheet has no opinion about it. */}
      <div className="tray">
        <div className="tray-count">
          <button onClick={() => setCount(Math.max(1, count - 1))} aria-label="One fewer die">&minus;</button>
          <span className="mono">{count}d</span>
          <button onClick={() => setCount(Math.min(20, count + 1))} aria-label="One more die">+</button>
        </div>
        <div className="tray-dice">
          {DICE.map((size) => (
            <button key={size} className="tray-die" onClick={() => actions.rollDice(count, size)}>
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="log">
        {log.length === 0 ? (
          <p className="log-empty">
            Click any modifier, save, skill, attack or spell on the sheet to roll it. Every roll lands here with its
            maths shown.
          </p>
        ) : (
          log.map((e) => (
            <div key={e.id} className={`log-entry ${e.kind}`}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="log-label">{e.label}</div>
                <div className="log-detail">{e.detail}</div>
              </div>
              {e.total !== null && <div className={`log-total ${e.kind}`}>{e.total}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ConditionsPanel({ character: c, actions }: Props) {
  const active = c.vitals.conditions.map(conditionById).filter((x): x is NonNullable<typeof x> => Boolean(x))
  const exhaustion = Number(c.vitals.conditions.find((x) => x.startsWith('exhaustion-'))?.split('-')[1] ?? 0)

  // Twenty-one chips, most of them off, buried the two that were actually on.
  // Active conditions stay visible; the rest live behind one button. Exhaustion
  // is excluded from both -- the stepper below is its only control, since the
  // six levels are exclusive and a chip per level says otherwise.
  const isExhaustion = (id: string) => id.startsWith('exhaustion-')
  const chips = active.filter((cond) => !isExhaustion(cond.id))
  const inactive = CONDITIONS.filter(
    (cond) => !isExhaustion(cond.id) && !c.vitals.conditions.includes(cond.id),
  )

  return (
    <div className="card side-card">
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span className="panel-title">Conditions &amp; effects</span>
        {c.vitals.concentration && <span className="conc-pill">Conc: {c.vitals.concentration}</span>}
      </div>

      <div className="chips">
        {chips.map((cond) => (
          <button
            key={cond.id}
            className={`chip on ${cond.good ? 'good' : ''}`}
            onClick={() => actions.toggleCondition(cond.id)}
            title="Remove"
          >
            {cond.name} <span className="chip-x" aria-hidden>×</span>
          </button>
        ))}
        <Menu label="Add" className="chip add" align="left">
          {(close) => inactive.map((cond) => (
            <button key={cond.id} onClick={() => { actions.toggleCondition(cond.id); close() }}>
              {cond.name}
            </button>
          ))}
        </Menu>
      </div>

      <div className="exhaustion">
        <span className="caps" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Exhaustion</span>
        <div className="exhaustion-steps">
          <button onClick={() => actions.setExhaustion(Math.max(0, exhaustion - 1))} aria-label="Less exhaustion">&minus;</button>
          <span className="mono">{exhaustion}</span>
          <button onClick={() => actions.setExhaustion(Math.min(6, exhaustion + 1))} aria-label="More exhaustion">+</button>
        </div>
      </div>

      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {active.map((cond) => (
            <div key={cond.id} style={{ fontSize: 12, color: 'var(--text-body)', lineHeight: 1.45 }}>
              <strong>{cond.name}.</strong> {cond.note}
            </div>
          ))}
        </div>
      )}

      {c.vitals.concentration && (
        <button className="btn ghost" onClick={() => actions.setConcentration(null)}>
          Drop concentration
        </button>
      )}
    </div>
  )
}

function ResourcesPanel({ character: c, actions }: Props) {
  return (
    <div className="card side-card">
      <span className="panel-title">Resources</span>
      {c.resources.map((pool) => {
        const used = c.usage[pool.id] ?? 0
        return (
          <div className="pool" key={pool.id}>
            <div className="pool-head">
              <span>{pool.name}</span>
              <span className="pool-recovery">{pool.recovery === 'none' ? '—' : `${pool.recovery} rest`}</span>
            </div>
            <div className="pips">
              {Array.from({ length: pool.max }, (_, i) => {
                // Available pips fill from the left; spent ones hollow out from the right.
                const filled = i < pool.max - used
                return (
                  <button
                    key={i}
                    className={`pip ${filled ? `filled ${pool.colour}` : ''}`}
                    title={filled ? 'Spend' : 'Refund'}
                    // Tap pip i to spend down to it; tap an already-spent pip to refund.
                    onClick={() => actions.setUsage(pool.id, filled ? pool.max - i : pool.max - i - 1)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
