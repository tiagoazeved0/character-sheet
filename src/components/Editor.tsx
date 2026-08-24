import { useState, type ChangeEvent } from 'react'
import { useCharacters } from '../store/character.ts'
import { suggestedProficiency } from '../data/blank.ts'
import type { Character } from '../rules/types.ts'

/**
 * Tier 1 of the editor: raw JSON with schema validation, plus the handful of
 * fields that change often. Guided creation is deferred; blank-slate and
 * duplicate cover a personal tool.
 */
export function Editor({ character: c, onClose }: { character: Character; onClose: () => void }) {
  const { characters, setActive, createBlank, duplicateActive, removeCharacter, replaceActive, apply } = useCharacters()
  const [draft, setDraft] = useState(() => JSON.stringify(c, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const save = () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(draft)
    } catch (e) {
      setError(`JSON syntax: ${(e as Error).message}`)
      return
    }
    const result = replaceActive(parsed)
    if (!result.ok) { setError(result.error); return }
    setError(null); setDirty(false); onClose()
  }

  const quick = (label: string, mutate: (doc: Character) => Character) =>
    apply({ label: `Edit: ${label}`, channel: 'edit', mutate })

  const suggestion = suggestedProficiency(c.level)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="panel-title">Characters &amp; edit</span>
          <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
        </div>

        <div className="modal-body">
          <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={c.id} onChange={(e) => setActive(e.target.value)} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)' }}>
              {characters.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button className="btn ghost" onClick={() => createBlank(prompt('Name?', 'New character') ?? 'New character')}>New</button>
            <button className="btn ghost" onClick={() => duplicateActive(prompt('Name?', `${c.name} (copy)`) ?? `${c.name} (copy)`)}>Duplicate</button>
            <button className="btn ghost" onClick={() => exportJson(c)}>Export</button>
            <label className="btn ghost" style={{ display: 'inline-flex', alignItems: 'center' }}>
              Import
              <input type="file" accept="application/json" hidden onChange={(e) => importJson(e, (raw) => {
                const result = replaceActive(raw)
                if (!result.ok) setError(result.error)
              })} />
            </label>
            {characters.length > 1 && (
              <button className="btn ghost" style={{ color: 'var(--danger)' }} onClick={() => confirm(`Delete ${c.name}?`) && removeCharacter(c.id)}>Delete</button>
            )}
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <Field label="Name" value={c.name} onChange={(v) => quick('name', (d) => ({ ...d, name: v }))} />
            <Field label="Class line" value={c.classLine} onChange={(v) => quick('class line', (d) => ({ ...d, classLine: v }))} />
            <NumField label="Level" value={c.level} onChange={(v) => quick('level', (d) => ({ ...d, level: v }))} />
            <NumField
              label={`Proficiency (suggested ${suggestion})`}
              value={c.proficiencyBonus}
              onChange={(v) => quick('proficiency', (d) => ({ ...d, proficiencyBonus: v }))}
            />
            <NumField label="Max HP" value={c.maxHp} onChange={(v) => quick('max HP', (d) => ({ ...d, maxHp: v }))} />
            <NumField label="AC" value={c.ac} onChange={(v) => quick('AC', (d) => ({ ...d, ac: v }))} />
            <NumField label="Speed" value={c.speed} onChange={(v) => quick('speed', (d) => ({ ...d, speed: v }))} />
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 10 }}>
            <span className="caps" style={{ fontSize: 10, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>Currency</span>
            {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((coin) => (
              <NumField
                key={coin}
                label={coin.toUpperCase()}
                value={c.currency[coin]}
                onChange={(v) => quick(`currency (${coin})`, (d) => ({ ...d, currency: { ...d.currency, [coin]: v } }))}
              />
            ))}
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="caps" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Full document</span>
            <textarea
              className="json-area"
              value={draft}
              spellCheck={false}
              onChange={(e) => { setDraft(e.target.value); setDirty(true); setError(null) }}
            />
            {error && <div className="error">{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" onClick={save} disabled={!dirty}>Validate &amp; save</button>
              <button className="btn ghost" onClick={() => { setDraft(JSON.stringify(c, null, 2)); setDirty(false); setError(null) }}>
                Reset
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
      <span className="caps" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
      <span className="caps" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(n) }}
        style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
      />
    </label>
  )
}

const inputStyle = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 13 } as const

function exportJson(c: Character) {
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${c.name.replace(/\s+/g, '-').toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importJson(e: ChangeEvent<HTMLInputElement>, done: (raw: unknown) => void) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try { done(JSON.parse(String(reader.result))) } catch { done(null) }
  }
  reader.readAsText(file)
}
