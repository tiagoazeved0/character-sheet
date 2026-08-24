import { ABILITIES, type Character } from '../rules/types.ts'
import { abilityMod, fmt, saveMod } from '../rules/derive.ts'
import type { useSheetActions } from '../store/actions.ts'

export function Abilities({ character: c, actions }: { character: Character; actions: ReturnType<typeof useSheetActions> }) {
  return (
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
  )
}
