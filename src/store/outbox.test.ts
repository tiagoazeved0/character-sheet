import { describe, expect, it } from 'vitest'
import { dequeue, enqueue, QUEUE_LIMIT, resolveConflict, statusFor, type Pending } from './outbox.ts'
import { seedCharacter } from '../data/seed.ts'

const char = (id: string, updatedAt: string): Pending => ({ kind: 'character', id, updatedAt })

describe('outbox queue', () => {
  it('collapses repeated pushes of the same character to the newest state', () => {
    let q: Pending[] = []
    q = enqueue(q, char('a', '1'))
    q = enqueue(q, char('a', '2'))
    q = enqueue(q, char('a', '3'))
    expect(q).toHaveLength(1)
    expect(q[0]).toEqual(char('a', '3'))
  })

  it('keeps characters separate', () => {
    let q: Pending[] = []
    q = enqueue(q, char('a', '1'))
    q = enqueue(q, char('b', '1'))
    expect(q).toHaveLength(2)
  })

  it('never collapses change rows, which are append-only', () => {
    let q: Pending[] = []
    q = enqueue(q, { kind: 'change', id: 'c1', characterId: 'a' })
    q = enqueue(q, { kind: 'change', id: 'c2', characterId: 'a' })
    expect(q).toHaveLength(2)
  })

  it('ignores a duplicate change row rather than sending it twice', () => {
    let q: Pending[] = []
    q = enqueue(q, { kind: 'change', id: 'c1', characterId: 'a' })
    q = enqueue(q, { kind: 'change', id: 'c1', characterId: 'a' })
    expect(q).toHaveLength(1)
  })

  it('removes only what was actually sent', () => {
    const q: Pending[] = [char('a', '1'), { kind: 'change', id: 'c1', characterId: 'a' }]
    expect(dequeue(q, [char('a', '1')])).toEqual([{ kind: 'change', id: 'c1', characterId: 'a' }])
  })

  it('keeps a character queued when it was edited again mid-push', () => {
    let q: Pending[] = [char('a', '1')]
    q = enqueue(q, char('a', '2'))                  // edited while '1' was in flight
    expect(dequeue(q, [char('a', '1')])).toEqual([char('a', '2')])
  })

  it('drops a character once the state that was pushed is the state that is queued', () => {
    expect(dequeue([char('a', '2')], [char('a', '2')])).toEqual([])
  })
})

describe('conflict resolution', () => {
  const local = { ...seedCharacter(), name: 'Laptop' }
  const remote = { ...seedCharacter(), name: 'Tablet' }
  const conflict = {
    characterId: local.id, local, remote,
    localUpdatedAt: '2026-01-01T10:00:00Z', remoteUpdatedAt: '2026-01-01T11:00:00Z',
    remoteRev: 7,
  }

  it('takes the local document but adopts the server rev', () => {
    const r = resolveConflict(conflict, 'local')
    expect(r.document.name).toBe('Laptop')
    expect(r.rev).toBe(7)
  })

  it('takes the remote document and its rev', () => {
    const r = resolveConflict(conflict, 'remote')
    expect(r.document.name).toBe('Tablet')
    expect(r.rev).toBe(7)
  })

  it('never invents a merged document', () => {
    for (const choice of ['local', 'remote'] as const) {
      const r = resolveConflict(conflict, choice)
      expect([local, remote]).toContainEqual(r.document)
    }
  })
})

describe('status', () => {
  const base = { configured: true, signedIn: true, online: true, conflicts: 0, pending: 0, inFlight: false }

  it('says local-only before Supabase is configured', () => {
    expect(statusFor({ ...base, configured: false })).toBe('local-only')
  })

  it('lets a conflict outrank everything else', () => {
    expect(statusFor({ ...base, configured: true, signedIn: false, online: false, conflicts: 1 })).toBe('conflict')
  })

  it('reports signed-out before offline', () => {
    expect(statusFor({ ...base, signedIn: false, online: false })).toBe('signed-out')
  })

  it('reports offline rather than pending when there is no network', () => {
    expect(statusFor({ ...base, online: false, pending: 3 })).toBe('offline')
  })

  it('distinguishes waiting from in flight', () => {
    expect(statusFor({ ...base, pending: 2 })).toBe('pending')
    expect(statusFor({ ...base, pending: 2, inFlight: true })).toBe('syncing')
  })

  it('is synced only when nothing is owed', () => {
    expect(statusFor(base)).toBe('synced')
  })
})

describe('deletes', () => {
  it('supersedes a queued push of the same character', () => {
    let q: Pending[] = []
    q = enqueue(q, char('a', '1'))
    q = enqueue(q, { kind: 'delete', id: 'a' })
    expect(q).toEqual([{ kind: 'delete', id: 'a' }])
  })

  it('leaves other characters alone', () => {
    let q: Pending[] = [char('b', '1')]
    q = enqueue(q, { kind: 'delete', id: 'a' })
    expect(q).toEqual([char('b', '1'), { kind: 'delete', id: 'a' }])
  })

  it('keeps the character journal, which outlives the character row', () => {
    let q: Pending[] = [{ kind: 'change', id: 'c1', characterId: 'a' }]
    q = enqueue(q, { kind: 'delete', id: 'a' })
    expect(q).toHaveLength(2)
  })
})

describe('queue ceiling', () => {
  it('drops the oldest journal rows rather than growing without bound', () => {
    let q: Pending[] = []
    for (let i = 0; i < QUEUE_LIMIT + 50; i++) q = enqueue(q, { kind: 'change', id: `c${i}`, characterId: 'a' })
    expect(q).toHaveLength(QUEUE_LIMIT)
    expect((q[0] as { id: string }).id).toBe('c50')      // the oldest 50 went
  })

  it('never drops a character or a delete to make room', () => {
    let q: Pending[] = [char('keep', '1'), { kind: 'delete', id: 'gone' }]
    for (let i = 0; i < QUEUE_LIMIT + 100; i++) q = enqueue(q, { kind: 'change', id: `c${i}`, characterId: 'a' })
    expect(q).toContainEqual(char('keep', '1'))
    expect(q).toContainEqual({ kind: 'delete', id: 'gone' })
    expect(q.length).toBeLessThanOrEqual(QUEUE_LIMIT)
  })
})
