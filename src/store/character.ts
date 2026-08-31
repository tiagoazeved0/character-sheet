import { create } from 'zustand'
import type { Character } from '../rules/types.ts'
import type { Change } from '../rules/schema.ts'
import { migrate } from '../rules/migrations.ts'
import { seedCharacter } from '../data/seed.ts'
import { blankCharacter, duplicateCharacter } from '../data/blank.ts'
import { coalesce, computeApply, prune, revertMutation, type Mutation } from './apply.ts'
import { dbAll, dbChangesFor, dbDelete, dbGet, dbPut } from './db.ts'
import { useSync } from './sync.ts'

type Store = {
  characters: Character[]
  activeId: string | null
  history: Change[]
  loaded: boolean

  load: () => Promise<void>
  apply: (mutation: Mutation) => void
  revert: (change: Change) => void
  revertBatch: (batchId: string) => void
  setActive: (id: string) => void
  createBlank: (name: string) => void
  createFromWizard: (character: Character) => void
  duplicateActive: (name: string) => void
  removeCharacter: (id: string) => void
  replaceActive: (raw: unknown) => { ok: true } | { ok: false; error: string }
}

const active = (s: Store) => s.characters.find((c) => c.id === s.activeId) ?? null

export const useCharacters = create<Store>((set, get) => ({
  characters: [],
  activeId: null,
  history: [],
  loaded: false,

  async load() {
    const stored = await dbAll<unknown>('characters')
    const characters: Character[] = []
    for (const raw of stored) {
      const result = migrate(raw)
      if (result.ok) characters.push(result.character)
      else console.error('Skipping unreadable character:', result.error)
    }
    if (characters.length === 0) {
      const seed = seedCharacter()
      characters.push(seed)
      await dbPut('characters', seed, seed.id)
      useSync.getState().queueCharacter(seed)
    }
    const lastId = (await dbGet<string>('meta', 'activeId').catch(() => undefined)) ?? characters[0]!.id
    const activeId = characters.some((c) => c.id === lastId) ? lastId : characters[0]!.id
    const history = await dbChangesFor<Change>(activeId)
    set({ characters, activeId, history, loaded: true })
  },

  apply(mutation) {
    const state = get()
    const current = active(state)
    if (!current) return
    const { next, changes } = computeApply(current, mutation)
    if (changes.length === 0) return

    const history = prune(coalesce(state.history, changes))
    set({
      characters: state.characters.map((c) => (c.id === next.id ? next : c)),
      history,
    })
    void dbPut('characters', next, next.id)
    useSync.getState().queueCharacter(next)
    for (const change of changes) {
      void dbPut('changes', change)
      useSync.getState().queueChange(change)
    }
  },

  revert(change) {
    get().apply(revertMutation(change))
  },

  revertBatch(batchId) {
    const batch = get().history.filter((c) => c.batchId === batchId)
    if (batch.length === 0) return
    const label = batch[0]?.batchLabel ?? 'batch'
    get().apply({
      label: `Revert: ${label}`,
      channel: 'edit',
      mutate: (c) => batch.reduceRight((doc, change) => revertMutation(change).mutate(doc), c),
    })
  },

  setActive(id) {
    set({ activeId: id })
    void dbPut('meta', id, 'activeId')
    void dbChangesFor<Change>(id).then((history) => set({ history }))
  },

  createBlank(name) {
    const character = blankCharacter(name)
    set((s) => ({ characters: [...s.characters, character] }))
    void dbPut('characters', character, character.id)
    useSync.getState().queueCharacter(character)
    get().setActive(character.id)
  },

  /** From the guided-creation wizard: the character is already fully assembled, just needs to land in the store like any other. */
  createFromWizard(character) {
    set((s) => ({ characters: [...s.characters, character] }))
    void dbPut('characters', character, character.id)
    useSync.getState().queueCharacter(character)
    get().setActive(character.id)
  },

  duplicateActive(name) {
    const current = active(get())
    if (!current) return
    const copy = duplicateCharacter(current, name)
    set((s) => ({ characters: [...s.characters, copy] }))
    void dbPut('characters', copy, copy.id)
    useSync.getState().queueCharacter(copy)
    get().setActive(copy.id)
  },

  removeCharacter(id) {
    const remaining = get().characters.filter((c) => c.id !== id)
    if (remaining.length === 0) return
    set({ characters: remaining })
    void dbDelete('characters', id)
    useSync.getState().queueDelete(id)
    if (get().activeId === id) get().setActive(remaining[0]!.id)
  },

  /** Used by the JSON editor. Goes through apply(), so the edit is in history. */
  replaceActive(raw) {
    const current = active(get())
    if (!current) return { ok: false as const, error: 'No active character' }
    const result = migrate(raw)
    if (!result.ok) return { ok: false as const, error: result.error }
    const incoming = { ...result.character, id: current.id, createdAt: current.createdAt }
    get().apply({ label: 'Edit: JSON', channel: 'edit', mutate: () => incoming })
    return { ok: true as const }
  },
}))

export const useActiveCharacter = (): Character | null =>
  useCharacters((s) => s.characters.find((c) => c.id === s.activeId) ?? null)
