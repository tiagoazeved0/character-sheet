import type { AdvMode, Character, CoverDegree } from '../rules/types.ts'
import { CONDITIONS, conditionById } from '../data/conditions.ts'
import { useSession } from '../store/session.ts'
import type { useSheetActions } from '../store/actions.ts'

type Props = { character: Character; actions: ReturnType<typeof useSheetActions> }

export function SideRail({ character: c, actions }: Props) {
  return (
    <>
      <DicePanel />
      <ConditionsPanel character={c} actions={actions} />
      <ResourcesPanel character={c} actions={actions} />
    </>
  )
}

function DicePanel() {
  const { adv, setAdv, cover, setCover, log, clearLog } = useSession()
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
      <div className="segmented" title="Cover you're behind, as a target -- bonus to AC and Dex saves until you change it">
        {(['none', 'half', 'three-quarters'] as CoverDegree[]).map((m) => (
          <button key={m} className={cover === m ? 'on' : ''} onClick={() => setCover(m)} style={{ flex: 1 }}>
            {m === 'none' ? 'No cover' : m === 'half' ? 'Half cover' : '3/4 cover'}
          </button>
        ))}
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
  const active = c.vitals.conditions.map(conditionById).filter(Boolean)
  return (
    <div className="card side-card">
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span className="panel-title">Conditions &amp; effects</span>
        {c.vitals.concentration && <span className="conc-pill">Conc: {c.vitals.concentration}</span>}
      </div>
      <div className="chips">
        {CONDITIONS.map((cond) => (
          <button
            key={cond.id}
            className={`chip ${c.vitals.conditions.includes(cond.id) ? 'on' : ''}`}
            onClick={() => actions.toggleCondition(cond.id)}
          >
            {cond.name}
          </button>
        ))}
      </div>
      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {active.map((cond) => (
            <div key={cond!.id} style={{ fontSize: 12, color: 'var(--text-body)', lineHeight: 1.45 }}>
              <strong>{cond!.name}.</strong> {cond!.note}
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
