import { ABILITIES, type Character } from '../rules/types.ts'
import { abilityMod, fmt, passiveInsight, passiveInvestigation, passivePerception, saveMod } from '../rules/derive.ts'
import type { useSheetActions } from '../store/actions.ts'

export function Abilities({ character: c, actions }: { character: Character; actions: ReturnType<typeof useSheetActions> }) {
  return (
    <>
      <div className="abil-grid">
        {ABILITIES.map((a) => {
          const proficient = c.saveProficiencies.includes(a)
          return (
            <div className="card abil" key={a}>
              <div className="abil-head">
                <span className="abil-abbr">{a}</span>
                <span className="abil-score">{c.scores[a]}</span>
              </div>
              <button className="abil-mod" onClick={() => actions.rollAbility(a)} title={`Roll ${a} check`}>
                {fmt(abilityMod(c, a))}
              </button>
              <button className={`abil-save ${proficient ? 'prof' : ''}`} onClick={() => actions.rollSave(a)}>
                {fmt(saveMod(c, a))} save
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

function ProficienciesPanel({ character: c }: { character: Character }) {
  const all: [string, string[]][] = [
    ['Armor', c.proficiencies.armor], ['Weapons', c.proficiencies.weapons],
    ['Tools', c.proficiencies.tools], ['Languages', c.proficiencies.languages],
  ]
  const groups = all.filter(([, v]) => v.length > 0)
  if (groups.length === 0) return null
  return (
    <div className="card side-card">
      <span className="panel-title">Proficiencies &amp; training</span>
      {groups.map(([label, values]) => (
        <div key={label}>
          <div className="caps" style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{label}</div>
          <div style={{ fontSize: '0.8125rem' }}>{values.join(', ')}</div>
        </div>
      ))}
    </div>
  )
}

function SensesPanel({ character: c }: { character: Character }) {
  const hasDefenses = c.defenses.resistant.length + c.defenses.immune.length + c.defenses.vulnerable.length > 0
  return (
    <div className="card side-card">
      <div style={{ display: 'flex', gap: 18 }}>
        <PassiveScore label="Perception" value={passivePerception(c)} />
        <PassiveScore label="Investigation" value={passiveInvestigation(c)} />
        <PassiveScore label="Insight" value={passiveInsight(c)} />
      </div>
      {c.senses.length > 0 && (
        <div className="chips">
          {c.senses.map((s) => (
            <span key={s.kind} className="chip">{s.kind[0]!.toUpperCase() + s.kind.slice(1)} {s.range} ft</span>
          ))}
        </div>
      )}
      {hasDefenses && (
        <div className="chips">
          {c.defenses.resistant.map((t) => <span key={`r-${t}`} className="chip">Resist {t}</span>)}
          {c.defenses.immune.map((t) => <span key={`i-${t}`} className="chip on">Immune {t}</span>)}
          {c.defenses.vulnerable.map((t) => <span key={`v-${t}`} className="chip">Vulnerable {t}</span>)}
        </div>
      )}
    </div>
  )
}

function PassiveScore({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="mono" style={{ fontSize: '1.125rem', fontWeight: 600 }}>{value}</span>
      <span className="caps" style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>Passive {label}</span>
    </div>
  )
}

/**
 * Split out of `Abilities` so each layout can place it. On a tablet the ability
 * scores span the top of the sheet, and dragging proficiencies and senses up
 * there with them put reference text above everything you actually play with.
 */
export function CharacterDetail({ character: c }: { character: Character }) {
  return (
    <>
      <SensesPanel character={c} />
      <ProficienciesPanel character={c} />
    </>
  )
}
