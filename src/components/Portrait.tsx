import { useRef, useState } from 'react'
import type { Character } from '../rules/types.ts'
import type { useSheetActions } from '../store/actions.ts'

/**
 * Portraits are stored in the character document as data URLs so they survive
 * offline and travel with export/import. That makes size the constraint that
 * matters: every edit writes a before and an after into the history journal,
 * and the edit channel is never pruned, so a full-resolution photo would bloat
 * IndexedDB permanently. Downscale before storing, never after.
 */
const MAX_EDGE = 384
const QUALITY = 0.82
const MAX_INPUT_BYTES = 12 * 1024 * 1024

async function toStoredDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is over 12MB — scale it down first.')

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read that image.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', QUALITY)
}

type Props = { character: Character; actions: ReturnType<typeof useSheetActions> }

export function Portrait({ character: c, actions }: Props) {
  const picker = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState('')

  const accept = async (file: File | null | undefined) => {
    if (!file) return
    setError('')
    try {
      const url = await toStoredDataUrl(file)
      actions.edit('Portrait', (ch) => ({ ...ch, portraitUrl: url }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.')
    }
  }

  const has = c.portraitUrl !== ''

  return (
    <div className="card side-card portrait">
      <span className="panel-title">Portrait</span>

      <div
        className={`portrait-frame ${has ? 'has-image' : ''} ${over ? 'over' : ''}`}
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void accept(e.dataTransfer.files[0]) }}
        onPaste={(e) => { void accept(e.clipboardData.files[0]) }}
        onClick={() => { if (!has) picker.current?.click() }}
      >
        {has
          ? <img src={c.portraitUrl} alt={`${c.name}'s portrait`} />
          : <span>Drop an image here, paste one, or click to choose</span>}
      </div>

      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

      <div className="portrait-actions">
        <button className="btn ghost" onClick={() => picker.current?.click()}>
          {has ? 'Replace' : 'Choose image'}
        </button>
        {has && (
          <button className="btn ghost" onClick={() => actions.edit('Portrait', (ch) => ({ ...ch, portraitUrl: '' }))}>
            Remove
          </button>
        )}
      </div>

      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { void accept(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}
