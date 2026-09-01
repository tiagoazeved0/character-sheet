import { useMemo, useState } from 'react'
import { useCharacters } from '../store/character.ts'

/** A portrait is a data URL tens of thousands of characters long; the row wants
 *  to say that it changed, not to print it. */
const show = (v: unknown) => {
  if (v === null || v === undefined) return '—'
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (s.startsWith('data:image/')) return '(image)'
  return s.length > 160 ? s.slice(0, 160) + '…' : s
}

const when = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Sheet edits are kept forever; play churn is pruned. Showing edits by default
 * is the whole point -- "what was my max HP before I broke it".
 */
export function History({ characterId }: { characterId: string }) {
  const history = useCharacters((s) => s.history)
  const revert = useCharacters((s) => s.revert)
  const revertBatch = useCharacters((s) => s.revertBatch)
  const [channel, setChannel] = useState<'edit' | 'play' | 'all'>('edit')

  const rows = useMemo(
    () =>
      history
        .filter((c) => c.characterId === characterId)
        .filter((c) => channel === 'all' || c.channel === channel)
        .slice()
        .reverse(),
    [history, characterId, channel],
  )

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="panel-head">
        <span className="panel-title">History</span>
        <div className="segmented" style={{ marginLeft: 'auto', background: 'var(--track)' }}>
          {(['edit', 'play', 'all'] as const).map((ch) => (
            <button
              key={ch}
              className={channel === ch ? 'on' : ''}
              style={channel === ch ? {} : { color: 'var(--text-secondary)' }}
              onClick={() => setChannel(ch)}
            >
              {ch === 'edit' ? 'Sheet edits' : ch === 'play' ? 'Play' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 && (
        <p className="muted" style={{ padding: '14px', fontSize: '0.8125rem' }}>
          Nothing recorded yet. Every change to this character lands here.
        </p>
      )}

      {rows.map((change) => (
        <div className="history-row" key={change.id}>
          <span className="history-when">{when(change.at)}</span>
          <span style={{ fontWeight: 600 }}>{change.label}</span>
          <span className="history-before">{show(change.before)}</span>
          <span aria-hidden>&rarr;</span>
          <span className="history-after">{show(change.after)}</span>
          <button
            className="history-revert"
            onClick={() => (change.batchId ? revertBatch(change.batchId) : revert(change))}
          >
            {change.batchId ? `Revert ${change.batchLabel ?? 'batch'}` : 'Revert'}
          </button>
        </div>
      ))}
    </div>
  )
}
