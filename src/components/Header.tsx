import type { Character } from '../rules/types.ts'
import { Menu } from './Menu.tsx'
import { useSession } from '../store/session.ts'
import type { useSheetActions } from '../store/actions.ts'

type Props = {
  character: Character
  actions: ReturnType<typeof useSheetActions>
  onOpenEditor: () => void
  onOpenLevelUp: () => void
}

/**
 * Identity and navigation only. How the character is doing right now lives in
 * `Vitals`, down in the sheet body where it has room to be read -- which is also
 * what stops this bar eating a third of the tablet.
 */
export function Header({ character: c, actions, onOpenEditor, onOpenLevelUp }: Props) {
  const combat = useSession((s) => s.combat)
  const toggleCombat = useSession((s) => s.toggleCombat)

  const initials = c.name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-identity">
          {c.portraitUrl
            ? <img className="header-avatar" src={c.portraitUrl} alt="" />
            : <span className="header-avatar placeholder">{initials}</span>}
          <div className="header-titles">
            <div className="header-name">{c.name}</div>
            <div className="header-class">{c.classLine}</div>
          </div>
        </div>

        <div className="header-actions">
          <button
            className={`hbtn inspiration ${c.heroicInspiration ? 'active' : ''}`}
            onClick={actions.toggleInspiration}
            title="Heroic inspiration"
          >
            <span aria-hidden>✦</span> Inspiration
          </button>

          <Menu label="Rest">
            {(close) => (
              <>
                <button onClick={() => { actions.shortRest(); close() }}>Short rest</button>
                <button onClick={() => { actions.longRest(); close() }}>Long rest</button>
              </>
            )}
          </Menu>

          <button className={`hbtn combat ${combat ? 'active' : ''}`} onClick={toggleCombat}>
            <span aria-hidden>⚔</span> Combat
          </button>

          <Menu label="Character">
            {(close) => (
              <>
                <button onClick={() => { onOpenEditor(); close() }}>Characters &amp; edit</button>
                {c.classes.length > 0 && <button onClick={() => { onOpenLevelUp(); close() }}>Level up</button>}
              </>
            )}
          </Menu>
        </div>
      </div>
    </header>
  )
}
