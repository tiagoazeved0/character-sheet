import { useState } from 'react'
import { useSync } from '../store/sync.ts'
import { useCharacters } from '../store/character.ts'
import { STATUS_LABEL } from '../store/outbox.ts'

/**
 * Deliberately not in the header. The header is fixed furniture that already
 * fights for room on a tablet, and this needs to be visible without costing it
 * any height -- if sync is quietly failing you want to know before you shut the
 * laptop, but not at the price of a row of sheet.
 */
export function SyncBar() {
  const { status, queue, conflicts, lastError, lastSyncedAt, email, flush } = useSync()
  const [open, setOpen] = useState(false)

  if (status === 'local-only') return null

  const detail =
    status === 'conflict' ? `${conflicts.length} character${conflicts.length === 1 ? '' : 's'} changed in two places`
      : status === 'pending' ? `${queue.length} change${queue.length === 1 ? '' : 's'} waiting`
        : lastError ? lastError
          : status === 'synced' && lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
            : email ?? ''

  return (
    <div className={`syncbar ${status}`}>
      <button className="syncbar-pill" onClick={() => setOpen(!open)} title={detail}>
        <span className="syncbar-dot" />
        {STATUS_LABEL[status]}
      </button>
      {open && (
        <div className="syncbar-detail">
          {detail && <p>{detail}</p>}
          {status === 'pending' && <button className="btn ghost" onClick={() => void flush()}>Sync now</button>}
        </div>
      )}
    </div>
  )
}

/**
 * Two devices, one person: the conflict is always "I left the tablet open", so
 * the honest fix is to ask which side wins. Merging would invent a document
 * neither device ever had.
 */
export function ConflictModal() {
  const { conflicts, resolve } = useSync()
  const load = useCharacters((s) => s.load)
  const conflict = conflicts[0]
  if (!conflict) return null

  const pick = async (choice: 'local' | 'remote') => {
    await resolve(conflict.characterId, choice)
    await load()
  }

  const when = (iso: string) => new Date(iso).toLocaleString()

  return (
    <div className="overlay">
      <div className="modal" style={{ width: 'min(620px, 100%)' }}>
        <div className="modal-head">
          <span className="panel-title">{conflict.local.name} changed in two places</span>
        </div>
        <div className="modal-body">
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            This device and the server both have edits. Nothing is merged — pick the one to keep.
            The other is not deleted from History, so you can still see what it said.
          </p>

          <div className="conflict-sides">
            <button className="card conflict-side" onClick={() => void pick('local')}>
              <span className="caps" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>This device</span>
              <span className="row-title">{conflict.local.name}</span>
              <span className="mono" style={{ fontSize: 12 }}>
                {conflict.local.vitals.hp} / {conflict.local.maxHp} HP · level {conflict.local.level}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>{when(conflict.localUpdatedAt)}</span>
              <span className="btn primary" style={{ marginTop: 6 }}>Keep this one</span>
            </button>

            <button className="card conflict-side" onClick={() => void pick('remote')}>
              <span className="caps" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Other device</span>
              <span className="row-title">{conflict.remote.name}</span>
              <span className="mono" style={{ fontSize: 12 }}>
                {conflict.remote.vitals.hp} / {conflict.remote.maxHp} HP · level {conflict.remote.level}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>{when(conflict.remoteUpdatedAt)}</span>
              <span className="btn primary" style={{ marginTop: 6 }}>Keep this one</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
