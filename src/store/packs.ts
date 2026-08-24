import { create } from 'zustand'
import type { RulesPack } from '../packs/types.ts'
import { validatePackImport } from '../packs/validate.ts'
import { dbAll, dbDelete, dbPut } from './db.ts'

type Store = {
  packs: RulesPack[]
  loaded: boolean

  load: () => Promise<void>
  /** Installs whatever validates, even from a partially-bad file; `errors` lists the skipped entries. */
  install: (raw: unknown) => { ok: true; errors: string[] } | { ok: false; errors: string[] }
  remove: (packId: string, version: string) => void
}

const key = (packId: string, version: string) => `${packId}@${version}`

export const usePacks = create<Store>((set, get) => ({
  packs: [],
  loaded: false,

  async load() {
    const packs = await dbAll<RulesPack>('rules_packs')
    set({ packs, loaded: true })
  },

  install(raw) {
    const { pack, errors } = validatePackImport(raw)
    if (!pack) return { ok: false as const, errors }
    set((s) => ({ packs: [...s.packs.filter((p) => key(p.packId, p.version) !== key(pack.packId, pack.version)), pack] }))
    void dbPut('rules_packs', pack, key(pack.packId, pack.version))
    return { ok: true as const, errors }
  },

  remove(packId, version) {
    set((s) => ({ packs: s.packs.filter((p) => !(p.packId === packId && p.version === version)) }))
    void dbDelete('rules_packs', key(packId, version))
  },
}))
