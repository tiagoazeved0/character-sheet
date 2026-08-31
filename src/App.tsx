import { useEffect, useState } from 'react'
import { useCharacters, useActiveCharacter } from './store/character.ts'
import { usePacks } from './store/packs.ts'
import { useSession, type Layout } from './store/session.ts'
import { useSheetActions } from './store/actions.ts'
import { Header } from './components/Header.tsx'
import { Alerts } from './components/Alerts.tsx'
import { Abilities } from './components/Abilities.tsx'
import { Skills } from './components/Skills.tsx'
import { Center } from './components/Center.tsx'
import { SideRail } from './components/SideRail.tsx'
import { Editor } from './components/Editor.tsx'
import { CreateCharacter } from './components/CreateCharacter.tsx'
import { LevelUp } from './components/LevelUp.tsx'

/**
 * The prototype makes layout a manual toggle with no media queries. Here the
 * viewport picks a default and the toggle becomes an override, so the tablet
 * does the right thing without being told.
 */
function useAutoLayout(): Layout {
  const override = useSession((s) => s.layoutOverride)
  const [auto, setAuto] = useState<Layout>(() => pick(window.innerWidth))
  useEffect(() => {
    const onResize = () => setAuto(pick(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return override ?? auto
}

const pick = (w: number): Layout => (w < 900 ? 'stacked' : w < 1300 ? 'tablet' : 'columns')

export default function App() {
  const load = useCharacters((s) => s.load)
  const loaded = useCharacters((s) => s.loaded)
  const loadPacks = usePacks((s) => s.load)
  const character = useActiveCharacter()
  const actions = useSheetActions(character)
  const layout = useAutoLayout()
  const [editorOpen, setEditorOpen] = useState(false)
  const [guidedOpen, setGuidedOpen] = useState(false)
  const [levelUpOpen, setLevelUpOpen] = useState(false)

  // Cover and a pending crit describe the character you were just playing, not the next one.
  useEffect(() => {
    useSession.getState().setCover('none')
    useSession.getState().setPendingCrit(false)
  }, [character?.id])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadPacks() }, [loadPacks])

  if (!loaded || !character) {
    return <p style={{ padding: 40, fontSize: 14 }} className="muted">Loading…</p>
  }

  return (
    <>
      <Header
        character={character}
        actions={actions}
        onOpenEditor={() => setEditorOpen(true)}
        onOpenLevelUp={() => setLevelUpOpen(true)}
      />
      <Alerts character={character} actions={actions} />
      <main className={`grid ${layout}`}>
        <div className="area-abil"><Abilities character={character} actions={actions} /></div>
        <div className="area-center"><Center character={character} actions={actions} /></div>
        <div className="area-side"><SideRail character={character} actions={actions} /></div>
        <div className="area-skills"><Skills character={character} actions={actions} /></div>
      </main>
      {editorOpen && (
        <Editor
          character={character}
          onClose={() => setEditorOpen(false)}
          onOpenGuided={() => { setEditorOpen(false); setGuidedOpen(true) }}
        />
      )}
      {guidedOpen && <CreateCharacter onClose={() => setGuidedOpen(false)} />}
      {levelUpOpen && <LevelUp character={character} onClose={() => setLevelUpOpen(false)} />}
    </>
  )
}
