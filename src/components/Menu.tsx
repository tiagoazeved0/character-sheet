import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A button that opens a list. Closes on outside click and on Escape, so it never
 * strands the sheet under it.
 */
export function Menu({ label, className = 'hbtn', align = 'right', children }: {
  label: ReactNode
  className?: string
  align?: 'left' | 'right'
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div className="menu" ref={box}>
      <button className={`${className} ${open ? 'active' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {label} <span className="menu-caret" aria-hidden>▾</span>
      </button>
      {open && <div className={`menu-list ${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  )
}
