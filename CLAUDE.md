# Project brief: D&D 5e character sheet

Personal-use 5e digital character sheet. Multiple characters, every modifier rollable, conditions
that change the maths, full change history. Local-first, installable as a PWA, hosted on GitHub
Pages, used on a laptop and a tablet at the table.

Built from a design handoff bundle (`design_handoff_character_sheet`: a README spec, a prototype
HTML file with a ~600-line logic class, and prototype scaffolding). The spec's look and feel is
authoritative. The logic class has been ported. The scaffolding was not ported and should not be.

`PLAN.md` holds the full architecture and phase plan. Read it before any structural work.

---

## Hard rules

**1. Every change to a character goes through `apply()` in `src/store/apply.ts`.**
That function computes the diff, writes the history journal, and marks the record dirty for sync.
Mutating a character document anywhere else means the change silently vanishes from history and,
once phase 4 lands, from sync. No exceptions — including in the editor, including for a single
field. If you find yourself reaching for `set({ characters: ... })` outside the store, stop.

**2. Derived values are never stored on the character document.**
Spell save DC, spell attack, skill totals, save totals, slot levels: all selectors in
`src/rules/derive.ts`, computed on demand. Storing them is what makes a sheet go stale mid-campaign.
The single deliberate exception is `proficiencyBonus`, stored because deriving it from level is
wrong the moment you multiclass; the editor suggests the by-level default instead.

**3. `src/rules/` and `src/packs/` stay framework-free.**
No React imports, no store imports. They are pure functions and they are the tested part. A wrong
`rollD20` is the bug that embarrasses you at the table.

**4. Ephemeral state never touches the character document.**
Dice log, advantage mode, combat lanes, round counter, situation chips live in
`src/store/session.ts` and are memory-only. They reset per encounter.

**5. No non-SRD rules content is ever committed.**
Bundled content must be SRD 5.1 under CC-BY-4.0 with attribution. Everything else — 2024 material,
homebrew, purchased books — is uploaded by the user at runtime once the pack loader lands, and
stored in their own database row. The repo is public.

**6. Never build an expression evaluator for tokens.**
`%DC%`, `%ATK%`, `%SLOT%`, `%MOD:cha%` etc. are a fixed built-in set plus a `customTokens` map of
literal strings. This is deliberate. It cannot break at the table.

---

## Stack

Vite + React 18 + TypeScript, Zustand for state, Zod for validation, IndexedDB for persistence,
`vite-plugin-pwa` for offline. No CSS framework: `src/styles/tokens.css` defines the palette as
custom properties, `src/styles/app.css` is one stylesheet of semantic classes.

TypeScript is strict, with `noUnusedLocals`, `noUncheckedIndexedAccess` and `verbatimModuleSyntax`
on. **Relative imports carry explicit `.ts` / `.tsx` extensions** (`allowImportingTsExtensions`).
Keep that convention.

## Layout

```
src/rules/          pure, framework-free, unit tested
  types.ts          Character, Vitals, ResourcePool, ConditionDef, entries
  version.ts        CURRENT_SCHEMA_VERSION — dependency-free on purpose
  dice.ts           rollD20 / rollDamage, injectable Roller seam
  vitals.ts         damage, healing, temp HP, death saves, concentration DC
  rest.ts           short and long rest restoration
  derive.ts         every computed value
  tokens.ts         token expansion
  skills.ts         the 18 skills and their abilities
  schema.ts         Zod schemas
  migrations.ts     versioned migration chain
  diff.ts           JSON-pointer document differ
src/store/
  apply.ts          dispatch layer: diff, coalesce, retention, revert
  character.ts      characters, active selection, history
  session.ts        ephemeral state
  actions.ts        every roll and state change the UI can trigger
  db.ts             IndexedDB wrapper
  labels.ts         JSON pointer -> human label for history
src/data/           conditions, seed character, blank/duplicate factories
src/components/     Header, Alerts, Abilities, Skills, Center, SideRail, History, Editor
```

## Verifying

```bash
npm install
npm test           # 44 tests: dice, vitals, apply/history, rest, derive, tokens
npm run build      # tsc --noEmit && vite build
npm run dev
```

Add tests for anything in `src/rules/` or `src/store/apply.ts`. UI components are untested by design.

---

## Current state

**Working:** rules engine with tests; the `apply()` dispatch layer with diffing, coalescing,
retention and per-field revert; IndexedDB persistence; the full sheet (header with HP bar and rest
buttons, abilities, skills, tabbed centre column with cross-sheet search, dice log side rail,
conditions, resource pips); multiple characters; JSON editor with Zod validation; export/import;
death-save and concentration alert strips; auto-selecting responsive layout with manual override;
PWA shell; GitHub Actions deploy and a Supabase keepalive workflow stub.

**Known gaps and risks:**

- **The React components have never been compiled or rendered.** They were written in an
  environment without `node_modules`. Expect type errors on the first `npm run build`. Fix them
  rather than loosening `tsconfig.json`.
- **`base` in `vite.config.ts` must be set to `'/<repo-name>/'`** before the first Pages deploy or
  every asset 404s.
- Bundled condition and spell text is paraphrased placeholder, not SRD text yet.
- There is no sync. `src/store/db.ts` is the only persistence; laptop and tablet do not share state
  until phase 4.
- Combat mode has a toggle in the header and session state, but no UI.

## Next work, in order

1. **Phase 3 — rules packs.** `src/packs/{resolver,validate}.ts`. A pack is a versioned bundle
   (spells, conditions, classes, races, backgrounds, feats, items). Characters pin exact pack
   versions in an ordered list; later packs override earlier ones by fully-qualified id
   (`srd-5.1:spell/fireball`) or an explicit `replaces`. Every reference on a character caches a
   snapshot of what it last resolved to, so the sheet still renders when a pack is missing. Import
   validates per-entry and reports failures individually rather than rejecting the whole file.
2. **Phase 4 — Supabase.** Auth via GitHub OAuth, RLS scoped to `auth.uid()`, three tables
   (`characters`, `character_changes`, `rules_packs`) — DDL is in `PLAN.md`. Local-first: writes
   land in IndexedDB synchronously and the push is debounced and allowed to fail. Per-row optimistic
   concurrency on `rev`; on mismatch show a modal and let the user pick a side. Never merge, never
   silently overwrite. Wire the keepalive workflow's secrets — free projects pause after ~7 days
   of inactivity and a fortnightly campaign will hit that.
3. **Phase 5 — history polish.** Filter by field, jump-to-date, batch collapse in the UI.
4. **Phase 6 — class tables in packs**, which unlock guided creation and the level-up flow. These
   two share one choice-rendering layer; build them together. Deliberately deferred — blank-slate
   plus duplicate may be enough indefinitely for a personal tool.
5. **Phase 7 — combat mode.** Lanes driven by tagged entries: each action/spell carries
   `lane`, a `requires` resource cost, and `favoredWhen` tags that reorder options when a situation
   chip is active. Do not hand-code per-character tactics.

## Style

Match the existing code. Comments explain *why*, not *what* — the codebase has few of them and each
one earns its place. Prefer small pure functions in `src/rules/` over logic embedded in components.
Keep the touch-target rules in `tokens.css` intact: the prototype is mouse-density throughout and
the tablet is the reason the `@media (pointer: coarse)` block exists.
