import type { Character } from '../rules/types.ts'
import { useSession } from '../store/session.ts'
import type { useSheetActions } from '../store/actions.ts'

export function Alerts({ character: c, actions }: { character: Character; actions: ReturnType<typeof useSheetActions> }) {
  const prompt = useSession((s) => s.concentrationPrompt)
  const dismiss = useSession((s) => s.promptConcentration)

  return (
    <>
      {c.vitals.hp === 0 && (
        <div className="alert alert-death">
          <span className="display" style={{ fontSize: 17 }}>Unconscious &mdash; making death saves</span>
          <span className="mono" style={{ fontSize: 12 }}>
            Successes {c.vitals.deathSuccess}/3 &middot; Failures {c.vitals.deathFail}/3
          </span>
          <button style={{ marginLeft: 'auto' }} onClick={actions.rollDeathSave}>Roll death save</button>
        </div>
      )}

      {prompt > 0 && c.vitals.concentration && (
        <div className="alert alert-conc">
          <span style={{ fontSize: 13 }}>
            You took damage while concentrating on <strong>{c.vitals.concentration}</strong> &mdash; CON save DC {prompt}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="solid" onClick={() => actions.rollConcentrationSave(prompt)}>Roll CON save</button>
            <button className="ghost" onClick={() => { actions.setConcentration(null); dismiss(0) }}>Drop it</button>
          </div>
        </div>
      )}
    </>
  )
}
