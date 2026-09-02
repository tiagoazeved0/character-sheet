import { create } from 'zustand'
import type { SupabaseClient, Session } from '@supabase/supabase-js'
import type { Character } from '../rules/types.ts'
import type { Change } from '../rules/schema.ts'
import { migrate } from '../rules/migrations.ts'
import { dbAll, dbGet, dbPut, dbDelete } from './db.ts'
import {
  changeRow, characterRow, dequeue, enqueue, pendingKey, resolveConflict, statusFor,
  type Conflict, type Pending, type SyncMeta, type SyncStatus,
} from './outbox.ts'

/**
 * Local-first. Every write has already landed in IndexedDB by the time this runs;
 * the push is debounced and allowed to fail. Table wifi is unreliable and a sheet
 * that blocks an HP change on a network round trip is useless.
 *
 * Unconfigured is a first-class state, not an error: without VITE_SUPABASE_URL
 * the app is exactly what it was before phase 4, and the client is never even
 * downloaded (the import below is dynamic so Vite splits it out of the bundle).
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const isConfigured = Boolean(URL && ANON)

const PUSH_DEBOUNCE_MS = 1500

let client: SupabaseClient | null = null
async function getClient(): Promise<SupabaseClient | null> {
  if (!isConfigured) return null
  if (client) return client
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient(URL!, ANON!, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

type Store = {
  status: SyncStatus
  email: string | null
  queue: Pending[]
  conflicts: Conflict[]
  lastSyncedAt: string | null
  lastError: string | null
  inFlight: boolean

  init: () => Promise<void>
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  queueCharacter: (c: Character) => void
  queueChange: (change: Change) => void
  queuePack: (packId: string, version: string) => void
  queueDelete: (characterId: string) => void
  flush: () => Promise<void>
  resolve: (characterId: string, choice: 'local' | 'remote') => Promise<void>
  pull: () => Promise<void>
}

const meta = (id: string) => dbGet<SyncMeta>('sync_meta', id)

let timer: ReturnType<typeof setTimeout> | null = null

export const useSync = create<Store>((set, get) => {
  const recompute = () => {
    const s = get()
    set({
      status: statusFor({
        configured: isConfigured,
        signedIn: s.email !== null,
        online: typeof navigator === 'undefined' ? true : navigator.onLine,
        conflicts: s.conflicts.length,
        pending: s.queue.length,
        inFlight: s.inFlight,
      }),
    })
  }

  /**
   * Nothing is owed to a server that does not exist. Without this the queue grows
   * for the lifetime of a local-only install -- change rows never collapse, and
   * they would soon outlive the journal entries they point at, since the play
   * channel is pruned at 400.
   */
  const owed = () => isConfigured

  const persistQueue = (queue: Pending[]) => {
    set({ queue })
    void dbPut('outbox', queue, 'queue')
    recompute()
  }

  const schedule = () => {
    if (!isConfigured) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void get().flush() }, PUSH_DEBOUNCE_MS)
  }

  /** Characters the server has never seen: everything made before sync was turned on. */
  const backfill = async () => {
    const locals = await dbAll<Character>('characters').catch(() => [])
    for (const c of locals) {
      const m = await meta(c.id)
      if (!m || m.rev === 0) get().queueCharacter(c)
    }
  }

  return {
    status: isConfigured ? 'signed-out' : 'local-only',
    email: null,
    queue: [],
    conflicts: [],
    lastSyncedAt: null,
    lastError: null,
    inFlight: false,

    async init() {
      const queue = (await dbGet<Pending[]>('outbox', 'queue').catch(() => undefined)) ?? []
      set({ queue })
      if (!isConfigured) { recompute(); return }

      const supabase = await getClient()
      if (!supabase) return
      const { data } = await supabase.auth.getSession()
      set({ email: data.session?.user.email ?? null })
      supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
        set({ email: session?.user.email ?? null })
        recompute()
        if (session) void get().pull()
      })

      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => { recompute(); schedule() })
        window.addEventListener('offline', recompute)
        // Pushes are debounced and automatic; pulls were not, so a device left
        // open never learned what the other one did. Coming back to the tablet
        // is the moment you want it current, and pull() no-ops when signed out.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void get().pull()
        })
      }
      recompute()
      if (data.session) {
        await get().pull()
        await backfill()
        schedule()
      }
    },

    async signIn() {
      const supabase = await getClient()
      if (!supabase) return
      await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.href },
      })
    },

    async signOut() {
      const supabase = await getClient()
      await supabase?.auth.signOut()
      set({ email: null })
      recompute()
    },

    queueCharacter(c) {
      if (!owed()) return
      persistQueue(enqueue(get().queue, { kind: 'character', id: c.id, updatedAt: c.updatedAt }))
      schedule()
    },

    queueChange(change) {
      if (!owed()) return
      persistQueue(enqueue(get().queue, { kind: 'change', id: change.id, characterId: change.characterId }))
      schedule()
    },

    queuePack(packId, version) {
      if (!owed()) return
      persistQueue(enqueue(get().queue, { kind: 'pack', packId, version }))
      schedule()
    },

    queueDelete(characterId) {
      if (!owed()) return
      void dbDelete('sync_meta', characterId)
      persistQueue(enqueue(get().queue, { kind: 'delete', id: characterId }))
      schedule()
    },

    async flush() {
      const supabase = await getClient()
      const s = get()
      if (!supabase || !s.email || s.inFlight || s.queue.length === 0) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) { recompute(); return }

      set({ inFlight: true, lastError: null })
      recompute()

      const sent: Pending[] = []
      const conflicts: Conflict[] = []
      try {
        for (const item of s.queue) {
          if (item.kind === 'character') {
            const local = (await dbGet<Character>('characters', item.id).catch(() => undefined))
            if (!local) { sent.push(item); continue }
            const m = (await meta(item.id)) ?? { characterId: item.id, rev: 0, pushedAt: null }

            if (m.rev === 0) {
              const { error } = await supabase.from('characters').insert(characterRow(local, 1))
              if (error && error.code !== '23505') throw new Error(error.message)
              if (!error) {
                await dbPut('sync_meta', { characterId: item.id, rev: 1, pushedAt: local.updatedAt }, item.id)
                sent.push(item)
                continue
              }
            }

            const { data, error } = await supabase
              .from('characters')
              .update({ rev: m.rev + 1, updated_at: local.updatedAt, data: local })
              .eq('id', item.id).eq('rev', m.rev).select('rev')
            if (error) throw new Error(error.message)

            if (!data || data.length === 0) {
              // Somebody else moved the row on. Never merge, never overwrite.
              const { data: theirs } = await supabase
                .from('characters').select('rev, updated_at, data').eq('id', item.id).single()
              const parsed = theirs ? migrate(theirs.data) : null
              if (parsed?.ok) {
                conflicts.push({
                  characterId: item.id, local, remote: parsed.character,
                  localUpdatedAt: local.updatedAt, remoteUpdatedAt: theirs!.updated_at,
                  remoteRev: theirs!.rev,
                })
              }
              sent.push(item)
              continue
            }
            await dbPut('sync_meta', { characterId: item.id, rev: data[0]!.rev, pushedAt: local.updatedAt }, item.id)
            sent.push(item)
          }

          if (item.kind === 'change') {
            const all = await dbAll<Change>('changes')
            const change = all.find((c) => c.id === item.id)
            if (change) {
              const { error } = await supabase.from('character_changes').upsert(changeRow(change), { onConflict: 'id' })
              if (error) throw new Error(error.message)
            }
            sent.push(item)
          }

          if (item.kind === 'delete') {
            const { error } = await supabase.from('characters').delete().eq('id', item.id)
            if (error) throw new Error(error.message)
            sent.push(item)
          }

          if (item.kind === 'pack') {
            const pack = await dbGet<unknown>('rules_packs', `${item.packId}@${item.version}`).catch(() => undefined)
            if (pack) {
              const { error } = await supabase.from('rules_packs')
                .upsert({ pack_id: item.packId, version: item.version, data: pack },
                  { onConflict: 'owner,pack_id,version' })
              if (error) throw new Error(error.message)
            }
            sent.push(item)
          }
        }
        persistQueue(dequeue(get().queue, sent))
        set({
          lastSyncedAt: new Date().toISOString(),
          conflicts: [...get().conflicts, ...conflicts],
        })
      } catch (e) {
        // Allowed to fail: the queue is durable and the next write reschedules.
        persistQueue(dequeue(get().queue, sent))
        set({ lastError: e instanceof Error ? e.message : 'Sync failed' })
      } finally {
        set({ inFlight: false })
        recompute()
      }
    },

    async pull() {
      const supabase = await getClient()
      if (!supabase || !get().email) return
      const { data, error } = await supabase.from('characters').select('id, rev, updated_at, data')
      if (error || !data) return
      const deleting = new Set(get().queue.filter((p) => p.kind === 'delete').map((p) => p.id))
      let adopted = false
      for (const row of data) {
        if (deleting.has(row.id)) continue
        const local = await dbGet<Character>('characters', row.id).catch(() => undefined)
        const m = await meta(row.id)
        // Only adopt rows this device has never seen, or has not touched since its
        // last successful push. Anything else is a conflict and flush() will say so.
        const untouched = !local || (m?.pushedAt !== undefined && m?.pushedAt === local.updatedAt)
        if (!untouched) continue
        const parsed = migrate(row.data)
        if (!parsed.ok) continue
        await dbPut('characters', parsed.character, row.id)
        await dbPut('sync_meta', { characterId: row.id, rev: row.rev, pushedAt: parsed.character.updatedAt }, row.id)
        adopted = true
      }

      // IndexedDB is not the screen. Without this a first sign-in writes the
      // character and keeps showing the old list until the page is reloaded --
      // which is exactly how this was found. The import is dynamic because
      // character.ts imports this module, and a static one would be a cycle.
      if (adopted) {
        const { useCharacters } = await import('./character.ts')
        await useCharacters.getState().load()
      }
    },

    async resolve(characterId, choice) {
      const conflict = get().conflicts.find((c) => c.characterId === characterId)
      if (!conflict) return
      const { document, rev } = resolveConflict(conflict, choice)
      await dbPut('characters', document, characterId)
      await dbPut('sync_meta', { characterId, rev, pushedAt: choice === 'remote' ? document.updatedAt : null }, characterId)
      set({ conflicts: get().conflicts.filter((c) => c.characterId !== characterId) })
      if (choice === 'local') get().queueCharacter(document)
      recompute()
    },
  }
})

/** Clears everything this device knows about the server. Used when signing out. */
export async function forgetSyncState() {
  await dbDelete('outbox', 'queue')
  for (const key of await dbAll<SyncMeta>('sync_meta')) await dbDelete('sync_meta', key.characterId)
}

export { pendingKey }
