import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { unresolvedPins } from '../packs/resolver.ts'
import { useCharacters } from '../store/character.ts'
import { useSession, type Layout } from '../store/session.ts'
import { isConfigured, useSync } from '../store/sync.ts'
import { STATUS_LABEL } from '../store/outbox.ts'
import { usePacks } from '../store/packs.ts'
import { suggestedProficiency } from '../data/blank.ts'
import type { Character } from '../rules/types.ts'

/**
 * Tier 1 of the editor: raw JSON with schema validation, plus the handful of
 * fields that change often. Blank-slate, duplicate, and guided (pack-driven)
 * creation are the three routes; all three stay available side by side.
 */
export function Editor({
  character: c, onClose, onOpenGuided,
}: {
  character: Character
  onClose: () => void
  onOpenGuided: () => void
}) {
  const { characters, setActive, createBlank, duplicateActive, removeCharacter, replaceActive, apply } = useCharacters()
  const { packs, install: installPack, remove: removePack } = usePacks()
  const sync = useSync()
  const layoutOverride = useSession((s) => s.layoutOverride)
  const setLayout = useSession((s) => s.setLayout)
  const [draft, setDraft] = useState(() => JSON.stringify(c, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Quick fields and Import both write straight to the store and bypass this
  // textarea's own onChange, so without this the draft goes stale the moment
  // either happens -- saving it back then silently discards what just landed.
  useEffect(() => {
    if (!dirty) setDraft(JSON.stringify(c, null, 2))
  }, [c, dirty])

  const pinProblems = useMemo(() => unresolvedPins(packs, c.packs), [packs, c.packs])

  /**
   * Only `packs[]` changes. The cached snapshots on each entry are left exactly
   * as they are -- pack content updates a character through FeatureRow's
   * "Update from pack" and nowhere else (Hard Rule 7), so repinning restores
   * what `ref` points at without rewriting a word of the sheet.
   */
  const repin = (packId: string, to: string) =>
    apply({
      label: `Repin ${packId} to ${to}`,
      channel: 'edit',
      mutate: (d) => ({ ...d, packs: d.packs.map((p) => (p.packId === packId ? { ...p, version: to } : p)) }),
    })

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
            <button className="btn ghost" onClick={onOpenGuided}>Guided</button>
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

          <section style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="caps" style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Sync</span>
            <span style={{ fontSize: '0.8125rem' }}>{STATUS_LABEL[sync.status]}</span>
            {sync.email && <span className="muted" style={{ fontSize: '0.75rem' }}>{sync.email}</span>}
            {!isConfigured && (
              <span className="muted" style={{ fontSize: '0.75rem' }}>
                Supabase is not configured for this build — see <code>supabase/README.md</code>.
              </span>
            )}
            {isConfigured && !sync.email && (
              <button className="btn ghost" onClick={() => void sync.signIn()}>Sign in with GitHub</button>
            )}
            {isConfigured && sync.email && (
              <>
                <button className="btn ghost" onClick={() => void sync.flush()}>Sync now</button>
                <button className="btn ghost" onClick={() => void sync.signOut()}>Sign out</button>
              </>
            )}
            {sync.lastError && <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{sync.lastError}</span>}
          </section>

          <section style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="caps" style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Layout</span>
            <div className="segmented light">
              {(['columns', 'tablet', 'stacked'] as Layout[]).map((l) => (
                <button key={l} className={layoutOverride === l ? 'on' : ''} onClick={() => setLayout(l)}>
                  {l[0]!.toUpperCase() + l.slice(1)}
                </button>
              ))}
              <button className={layoutOverride === null ? 'on' : ''} onClick={() => setLayout(null)}>Auto</button>
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 10 }}>
            <span className="caps" style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>Currency</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="caps" style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Rules packs</span>
              <label className="btn ghost" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
                Import pack
                <input type="file" accept="application/json" hidden onChange={(e) => importJson(e, (raw) => {
                  if (raw === null) { setError('Pack import: invalid JSON'); return }
                  const result = installPack(raw)
                  if (result.errors.length === 0) setError(null)
                  else setError(`Pack import: ${result.errors.length} ${result.ok ? 'entries skipped' : 'error(s)'} -- ${result.errors.join('; ')}`)
                })} />
              </label>
            </div>
            {pinProblems.length > 0 && (
              <div className="rows">
                {pinProblems.map((s) => (
                  <div key={s.pin.packId} className="card row" style={{ padding: '9px 12px' }}>
                    <div className="row-top">
                      <span className="row-title" style={{ fontSize: '0.875rem' }}>{s.pin.packId}</span>
                      <span className="tag" style={{ color: 'var(--danger)' }}>pinned {s.pin.version}</span>
                      {s.state === 'version-mismatch' && (
                        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                          {s.available.map((v) => (
                            <button key={v} className="btn ghost" onClick={() => repin(s.pin.packId, v)}>
                              Repin to {v}
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="row-sub">
                      {s.state === 'version-mismatch'
                        ? `Installed: ${s.available.join(', ')}. Until this is repinned, every reference into ${s.pin.packId} resolves to nothing — the sheet still reads correctly from its stored copy, but "Update from pack" finds nothing to check against.`
                        : `Not installed. Import the pack file to restore this character's references; the sheet itself keeps working from its stored copy meanwhile.`}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {packs.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.75rem' }}>No rules packs installed.</p>
            ) : (
              <div className="rows">
                {packs.map((p) => (
                  <div key={`${p.packId}@${p.version}`} className="card row" style={{ padding: '9px 12px' }}>
                    <div className="row-top">
                      <span className="row-title" style={{ fontSize: '0.875rem' }}>{p.title}</span>
                      <span className="tag">{p.version}</span>
                      <button
                        className="btn ghost"
                        style={{ marginLeft: 'auto', color: 'var(--danger)' }}
                        onClick={() => confirm(`Remove ${p.title}?`) && removePack(p.packId, p.version)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="row-sub">{p.license}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="caps" style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Full document</span>
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

export function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.6875rem' }}>
      <span className="caps" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  )
}

export function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.6875rem' }}>
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

const inputStyle = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', fontSize: '0.8125rem' } as const

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
