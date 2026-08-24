import { create } from 'zustand'
import type { AdvMode, Lane, LogEntry, LogKind } from '../rules/types.ts'
import { LOG_CAP } from '../rules/dice.ts'

export type Tab = 'Actions' | 'Spells' | 'Features' | 'Inventory' | 'Background' | 'Notes' | 'History'
export type Layout = 'columns' | 'tablet' | 'stacked'

/**
 * Ephemeral, per-encounter state. Never persisted, never synced: the dice log
 * and the turn budget belong to this fight, not to the character.
 */
type Session = {
  adv: AdvMode
  log: LogEntry[]
  tab: Tab
  query: string
  layoutOverride: Layout | null
  concentrationPrompt: number
  combat: boolean
  round: number
  situations: string[]
  lanes: Record<Lane, boolean>

  setAdv: (adv: AdvMode) => void
  push: (entry: { label: string; detail: string; total: number | null; kind: LogKind }) => void
  clearLog: () => void
  setTab: (tab: Tab) => void
  setQuery: (query: string) => void
  setLayout: (layout: Layout | null) => void
  promptConcentration: (dc: number) => void
  toggleCombat: () => void
  toggleSituation: (id: string) => void
  spendLane: (lane: Lane) => void
  endTurn: () => void
}

let nextId = 1
const EMPTY_LANES: Record<Lane, boolean> = { action: false, bonus: false, move: false, reaction: false, free: false }

export const useSession = create<Session>((set) => ({
  adv: 'normal',
  log: [],
  tab: 'Actions',
  query: '',
  layoutOverride: null,
  concentrationPrompt: 0,
  combat: false,
  round: 1,
  situations: [],
  lanes: { ...EMPTY_LANES },

  setAdv: (adv) => set({ adv }),
  push: (entry) =>
    set((s) => ({ log: [{ id: nextId++, ...entry }, ...s.log].slice(0, LOG_CAP), adv: 'normal' })),
  clearLog: () => set({ log: [] }),
  setTab: (tab) => set({ tab, query: '' }),
  setQuery: (query) => set({ query }),
  setLayout: (layoutOverride) => set({ layoutOverride }),
  promptConcentration: (concentrationPrompt) => set({ concentrationPrompt }),
  toggleCombat: () => set((s) => ({ combat: !s.combat, round: 1, lanes: { ...EMPTY_LANES } })),
  toggleSituation: (id) =>
    set((s) => ({
      situations: s.situations.includes(id) ? s.situations.filter((x) => x !== id) : [...s.situations, id],
    })),
  spendLane: (lane) => set((s) => ({ lanes: { ...s.lanes, [lane]: true } })),
  endTurn: () => set((s) => ({ round: s.round + 1, lanes: { ...EMPTY_LANES } })),
}))
