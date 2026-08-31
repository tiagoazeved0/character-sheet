import { useMemo } from 'react'
import type { Character, SpellEntry } from '../rules/types.ts'
import { carriedWeight, carryCapacity, castLevelFor, poolRemaining, slotsRemaining } from '../rules/derive.ts'
import { expandTokens } from '../rules/tokens.ts'
import { useSession, type Tab } from '../store/session.ts'
import { useCharacters } from '../store/character.ts'
import type { useSheetActions } from '../store/actions.ts'
import { History } from './History.tsx'
import { Portrait } from './Portrait.tsx'

const TABS: Tab[] = ['Actions', 'Spells', 'Features', 'Inventory', 'Background', 'Notes', 'History']

type Props = { character: Character; actions: ReturnType<typeof useSheetActions> }

export function Center({ character: c, actions }: Props) {
  const { tab, setTab, query, setQuery } = useSession()
  const tok = (s: string) => expandTokens(s, c)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const hit = (name: string, desc: string) => (name + ' ' + desc).toLowerCase().includes(q)
    return {
      actions: c.actions.filter((a) => hit(a.name, a.desc + a.sub)),
      spells: c.spells.filter((s) => hit(s.name, s.desc + s.sub)),
      features: c.features.filter((f) => hit(f.name, f.desc + f.sub)),
      items: c.items.filter((i) => hit(i.name, i.desc)),
    }
  }, [query, c])

  const count = results ? results.actions.length + results.spells.length + results.features.length + results.items.length : 0

  return (
    <div>
      <div className="tabbar">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anything — spells, features, items…"
        />
      </div>

      {results ? (
        <div className="rows">
          {results.actions.map((a) => <ActionRow key={a.id} entry={a} character={c} actions={actions} tok={tok} />)}
          {results.spells.map((s) => <SpellRow key={s.id} spell={s} character={c} actions={actions} tok={tok} />)}
          {results.features.map((f) => <FeatureRow key={f.id} entry={f} character={c} actions={actions} tok={tok} />)}
          {results.items.map((i) => <ItemRow key={i.id} entry={i} actions={actions} />)}
          <p className="muted" style={{ fontSize: 12 }}>{count} results across the whole sheet</p>
        </div>
      ) : (
        <TabBody character={c} actions={actions} tok={tok} tab={tab} />
      )}
    </div>
  )
}

function TabBody({ character: c, actions, tok, tab }: Props & { tok: (s: string) => string; tab: Tab }) {
  const apply = useCharacters((s) => s.apply)

  if (tab === 'Notes') {
    return (
      <textarea
        className="notes-area"
        value={c.notes}
        onChange={(e) => {
          const notes = e.target.value
          apply({ label: 'Notes', channel: 'edit', mutate: (doc) => ({ ...doc, notes }) })
        }}
      />
    )
  }

  if (tab === 'History') return <History characterId={c.id} />

  if (tab === 'Background') return <BackgroundTab character={c} actions={actions} />

  if (tab === 'Inventory') {
    const carried = carriedWeight(c)
    const cap = carryCapacity(c)
    const ratio = cap === 0 ? 0 : carried / cap
    const status = ratio > 1 ? 'Overloaded' : ratio > 2 / 3 ? 'Encumbered' : 'Unencumbered'
    const { currency } = c
    const coins: [string, number][] = [['pp', currency.pp], ['gp', currency.gp], ['ep', currency.ep], ['sp', currency.sp], ['cp', currency.cp]]
    return (
      <>
        <div className="card encumbrance">
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span className="caps" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{status}</span>
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 13 }}>{carried} / {cap} lb</span>
          </div>
          <div className="enc-bar">
            <div style={{ width: `${Math.min(100, ratio * 100)}%`, height: '100%', background: 'var(--encumbrance)' }} />
          </div>
        </div>
        {coins.some(([, n]) => n > 0) && (
          <div className="card side-card" style={{ flexDirection: 'row', gap: 16, marginBottom: 9 }}>
            {coins.filter(([, n]) => n > 0).map(([label, n]) => (
              <div key={label} className="mono" style={{ fontSize: 13 }}>
                {n} <span className="caps muted" style={{ fontSize: 10 }}>{label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="rows">
          {c.items.map((i) => <ItemRow key={i.id} entry={i} actions={actions} />)}
        </div>
      </>
    )
  }

  const list =
    tab === 'Actions' ? c.actions.map((a) => <ActionRow key={a.id} entry={a} character={c} actions={actions} tok={tok} />)
    : tab === 'Spells' ? [...c.spells].sort((a, b) => a.level - b.level).map((s) => <SpellRow key={s.id} spell={s} character={c} actions={actions} tok={tok} />)
    : c.features.map((f) => <FeatureRow key={f.id} entry={f} character={c} actions={actions} tok={tok} />)

  return <div className="rows">{list}</div>
}

function BackgroundTab({ character: c, actions }: Props) {
  const chars: [string, string][] = [
    ['Alignment', c.characteristics.alignment], ['Gender', c.characteristics.gender], ['Eyes', c.characteristics.eyes],
    ['Size', c.characteristics.size], ['Height', c.characteristics.height], ['Faith', c.characteristics.faith],
    ['Hair', c.characteristics.hair], ['Skin', c.characteristics.skin], ['Age', c.characteristics.age], ['Weight', c.characteristics.weight],
  ]
  const personality: [string, string][] = [
    ['Personality traits', c.personality.traits], ['Ideals', c.personality.ideals],
    ['Bonds', c.personality.bonds], ['Flaws', c.personality.flaws],
  ]
  const filledChars = chars.filter(([, v]) => v)
  const filledPersonality = personality.filter(([, v]) => v)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Portrait character={c} actions={actions} />

      {(c.background.name || c.background.feature) && (
        <div className="card side-card">
          <span className="panel-title">{c.background.name || 'Background'}</span>
          {c.background.feature && <p className="row-desc" style={{ margin: 0 }}>{c.background.feature}</p>}
        </div>
      )}

      <div className="card side-card">
        <span className="panel-title">Characteristics</span>
        {filledChars.length > 0 ? (
          <div className="field-grid">
            {filledChars.map(([label, value]) => (
              <div key={label}>
                <div className="caps" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
                <div style={{ fontSize: 13 }}>{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 12 }}>Nothing set yet — edit via Characters &amp; edit.</p>
        )}
      </div>

      {filledPersonality.length > 0 && (
        <div className="card side-card">
          <span className="panel-title">Personality</span>
          {filledPersonality.map(([label, value]) => (
            <div key={label}>
              <div className="caps" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {c.appearance && (
        <div className="card side-card">
          <span className="panel-title">Appearance</span>
          <p className="row-desc" style={{ margin: 0 }}>{c.appearance}</p>
        </div>
      )}
    </div>
  )
}

type RowProps = { character: Character; actions: ReturnType<typeof useSheetActions>; tok: (s: string) => string }

function ActionRow({ entry, character: c, actions, tok }: RowProps & { entry: Character['actions'][number] }) {
  return (
    <div className="card row">
      <div className="row-top">
        <span className="row-title">{entry.name}</span>
        <span className="tag">{entry.tag}</span>
        <div className="row-actions">
          {entry.attack && (
            <button className="btn primary" onClick={() => actions.rollAttack(entry.name, entry.attack!.mod)}>
              Attack {entry.attack.mod >= 0 ? '+' : ''}{entry.attack.mod}
            </button>
          )}
          {entry.damage && (
            <button className="btn ghost" onClick={() => actions.rollDamageSpec(entry.damage!.label, entry.damage!)}>
              {entry.damage.count}d{entry.damage.size}
              {entry.damage.flat ? `+${entry.damage.flat}` : ''}
            </button>
          )}
          {entry.check && (
            <button className="btn ghost" onClick={() => actions.rollAttack(entry.check!.label, entry.check!.mod)}>Roll</button>
          )}
          {entry.concentrationOn && (
            <button
              className="btn primary"
              onClick={() => actions.setConcentration(c.vitals.concentration === entry.concentrationOn ? null : entry.concentrationOn!)}
            >
              {c.vitals.concentration === entry.concentrationOn ? 'Drop' : 'Concentrate'}
            </button>
          )}
        </div>
      </div>
      <div className="row-sub">{tok(entry.sub)}</div>
      {entry.desc && <div className="row-desc">{tok(entry.desc)}</div>}
    </div>
  )
}

function SpellRow({ spell, character: c, actions, tok }: RowProps & { spell: SpellEntry }) {
  const castLevel = castLevelFor(c, spell.level)
  const usesPool = Boolean(spell.pool)
  const available = spell.level === 0
    ? true
    : usesPool
      ? poolRemaining(c, spell.pool!) > 0
      : slotsRemaining(c, castLevel) > 0

  const badge = spell.level === 0 ? 'cantrip' : usesPool ? 'arcanum' : 'spell'
  const badgeText = spell.level === 0 ? 'Cantrip' : usesPool ? 'Arcanum' : `Level ${spell.level}`

  const cast = () => {
    if (!available) return
    if (spell.level > 0) actions.spendPool(usesPool ? spell.pool! : c.spellcasting.kind === 'pact' ? 'slots:pact' : `slots:${castLevel}`)
    if (spell.concentration) actions.setConcentration(spell.name)
  }

  return (
    <div className={`card row ${available ? '' : 'dead'}`}>
      <div className="row-top">
        <span className="row-title">{spell.name}</span>
        <span className={`badge ${badge}`}>{badgeText}</span>
        {spell.concentration && <span className="tag">Concentration</span>}
        <div className="row-actions">
          {spell.attack && (
            <button className="btn ghost" onClick={() => actions.rollAttack(spell.attack!.label ?? spell.name, spellAtkMod(c))}>
              Attack
            </button>
          )}
          {spell.damage && (
            <button className="btn ghost" onClick={() => actions.rollDamageSpec(spell.damage!.label, spell.damage!)}>
              {spell.damage.count}d{spell.damage.size}
            </button>
          )}
          {spell.level === 0 ? (
            <span className="btn dead">Cantrip</span>
          ) : available ? (
            <button className="btn primary" onClick={cast}>
              Cast{usesPool ? '' : ` (${ordinal(castLevel)} slot)`}
            </button>
          ) : (
            <span className="btn dead">{usesPool ? 'Spent' : 'No slot'}</span>
          )}
        </div>
      </div>
      <div className="row-sub">{tok(spell.sub)}</div>
      <div className="row-desc">{tok(spell.desc)}</div>
    </div>
  )
}

function FeatureRow({ entry, character: c, actions, tok }: RowProps & { entry: Character['features'][number] }) {
  const remaining = entry.pool ? poolRemaining(c, entry.pool) : null
  return (
    <div className={`card row ${remaining === 0 ? 'dead' : ''}`}>
      <div className="row-top">
        <span className="row-title">{entry.name}</span>
        <span className="tag">{entry.tag}</span>
        <div className="row-actions">
          {entry.pool && (
            remaining! > 0
              ? <button className="btn ghost" onClick={() => actions.spendPool(entry.pool!)}>Use ({remaining})</button>
              : <span className="btn dead">Spent</span>
          )}
        </div>
      </div>
      <div className="row-sub">{tok(entry.sub)}</div>
      {entry.desc && <div className="row-desc">{tok(entry.desc)}</div>}
    </div>
  )
}

function ItemRow({ entry, actions }: { entry: Character['items'][number]; actions: ReturnType<typeof useSheetActions> }) {
  return (
    <div className="card row">
      <div className="row-top">
        <span className="row-title">{entry.name}</span>
        {entry.qty > 1 && <span className="tag">&times;{entry.qty}</span>}
        <div className="row-actions">
          {entry.heals && entry.qty > 0 && (
            <button
              className="btn ghost"
              onClick={() => {
                const rolled = actions.rollDamageSpec(`${entry.name}`, entry.heals!)
                if (rolled) actions.healBy(rolled.total)
                actions.edit('Inventory', (c) => ({
                  ...c,
                  items: c.items.map((i) => (i.id === entry.id ? { ...i, qty: i.qty - 1 } : i)),
                }))
              }}
            >
              Drink {entry.heals.count}d{entry.heals.size}+{entry.heals.flat}
            </button>
          )}
        </div>
      </div>
      <div className="row-sub">{entry.weight} lb each</div>
      {entry.desc && <div className="row-desc">{entry.desc}</div>}
    </div>
  )
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
const ordinal = (n: number) => ORDINALS[n] ?? `${n}th`
const spellAtkMod = (c: Character) =>
  c.spellcastingAbility === null ? 0 : c.proficiencyBonus + Math.floor((c.scores[c.spellcastingAbility] - 10) / 2)
