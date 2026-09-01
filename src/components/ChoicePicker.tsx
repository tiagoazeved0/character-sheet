import type { ChoiceDef } from '../packs/types.ts'

/**
 * A single ChoiceDef, rendered as selectable rows. Options with a `requires`
 * prerequisite are shown, not hidden -- PLAN.md is explicit that "Requires
 * warlock 12" is more useful than a row that silently isn't there. Nothing
 * here evaluates whether a prerequisite is actually met; it's informational
 * for the person making the choice.
 */
export function ChoicePicker({
  choice, selected, onSelect,
}: {
  choice: ChoiceDef
  selected: string | null
  onSelect: (optionId: string) => void
}) {
  return (
    <div className="card side-card">
      <span className="panel-title">{choice.label}</span>
      {choice.prerequisite && <p className="muted" style={{ fontSize: '0.75rem', margin: 0 }}>{choice.prerequisite}</p>}
      <div className="rows">
        {choice.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`pick-row ${selected === opt.id ? 'on' : ''}`}
            onClick={() => onSelect(opt.id)}
          >
            <div className="row-top">
              <span className="row-title" style={{ fontSize: '0.875rem' }}>{opt.label}</span>
              {selected === opt.id && <span className="tag">Selected</span>}
            </div>
            {opt.requires && <div className="row-sub">{opt.requires}</div>}
          </button>
        ))}
      </div>
    </div>
  )
}
