import type { Character } from '../rules/types.ts'
import { SKILLS } from '../rules/skills.ts'
import { fmt, skillMod } from '../rules/derive.ts'
import type { useSheetActions } from '../store/actions.ts'

export function Skills({ character: c, actions }: { character: Character; actions: ReturnType<typeof useSheetActions> }) {
  return (
    <div className="card skills">
      <div className="panel-head">
        <span className="panel-title">Skills</span>
        <span className="caps" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
          Prof {fmt(c.proficiencyBonus)}
        </span>
      </div>
      {SKILLS.map((s) => {
        const rank = c.skills[s.id] ?? 0
        return (
          <button key={s.id} className={`skill-row ${rank > 0 ? 'prof' : ''}`} onClick={() => actions.rollSkill(s.id, s.name)}>
            <span className={`dot ${rank === 2 ? 'p2' : rank === 1 ? 'p1' : ''}`} />
            <span>{s.name}</span>
            <span className="skill-ability">{s.ability}</span>
            <span className="skill-mod">{fmt(skillMod(c, s.id))}</span>
          </button>
        )
      })}
    </div>
  )
}
