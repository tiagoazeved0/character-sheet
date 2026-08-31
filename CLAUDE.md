# Project brief: D&D 5e character sheet

Personal-use 5e digital character sheet. Multiple characters, every modifier rollable, conditions
that change the maths, full change history. Local-first, installable as a PWA, hosted on GitHub
Pages, used on a laptop and a tablet at the table. Rules content (SRD, homebrew classes, purchased
2024 material) comes from installed rules packs, which a character can build itself from via a
guided-creation wizard, or reference afterward for updates.

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
field, including the creation wizard and level-up (those two are the one exception for *creating* a
brand-new character document — `createFromWizard`/`createBlank`/`duplicateActive` don't go through
`apply()` either, since there's no prior document to diff against; every subsequent change to that
character does). If you find yourself reaching for `set({ characters: ... })` outside the store, stop.

**2. Derived values are never stored on the character document.**
Spell save DC, spell attack, skill totals, save totals, slot levels, passive scores: all selectors
in `src/rules/derive.ts`, computed on demand. Storing them is what makes a sheet go stale mid-campaign.
The deliberate exceptions are `proficiencyBonus` (deriving it from level is wrong the moment you
multiclass; the editor suggests the by-level default instead) and a `FeatureEntry`'s own
`name`/`tag`/`sub`/`desc`/`pool` fields when it carries a pack `ref` — those ARE the cached
resolution snapshot per `PLAN.md` §2, not a derived value; `ref` is only where to check for updates,
never auto-applied (see rule 7).

**3. `src/rules/` and `src/packs/` stay framework-free.**
No React imports, no store imports. They are pure functions and they are the tested part. A wrong
`rollD20` is the bug that embarrasses you at the table.

**4. Ephemeral state never touches the character document.**
Dice log, advantage mode, combat lanes, round counter, situation chips live in
`src/store/session.ts` and are memory-only. They reset per encounter.

**5. No non-SRD rules content is ever committed.**
Bundled content must be SRD under CC-BY-4.0 with attribution. Everything else — 2024 material,
homebrew classes, purchased books — is uploaded by the user at runtime and stored in IndexedDB
(`rules_packs` store, `src/store/packs.ts`), never in the repo. The repo is public.
**Concretely: `homebrew-pugilist.json`, `phb-2024.json`, and any real character JSON (e.g.
`damiana.json`) live in the user's Downloads folder, not in git.** A fresh clone of this repo does
not have them — ask the user for the files (they know where they keep them) rather than assuming
they're recoverable from git history.

**6. Never build an expression evaluator for tokens.**
`%DC%`, `%ATK%`, `%SLOT%`, `%MOD:cha%` etc. are a fixed built-in set plus a `customTokens` map of
literal strings. This is deliberate. It cannot break at the table.

**7. Pack content only updates a character explicitly, never silently.**
Uploading a new pack version, or a `FeatureEntry.ref` resolving to different text than what's
stored, never auto-overwrites a live character. The Editor's Packs section and `FeatureRow`'s
"Update from pack" button are the only paths, and both go through `apply()` on the `edit` channel,
so History shows the before/after and revert is one click. See `PLAN.md` §2.

---

## Stack

Vite + React 18 + TypeScript, Zustand for state, Zod for validation, IndexedDB for persistence,
`vite-plugin-pwa` for offline. No CSS framework: `src/styles/tokens.css` defines the palette and
type as custom properties, `src/styles/app.css` is one stylesheet of semantic classes, and
`src/styles/grimoire.css` is the theme layer imported after it (paper texture, hard corners,
letterpress edges — the things a variable cannot express). **Every colour in the app resolves to a
token in `tokens.css`.** The one literal left is `theme-color` in `index.html`, which cannot take a
`var()`; keep it in step with `--dark`. A restyle should be those two files and nothing else.

TypeScript is strict, with `noUnusedLocals`, `noUncheckedIndexedAccess` and `verbatimModuleSyntax`
on. **Relative imports carry explicit `.ts` / `.tsx` extensions** (`allowImportingTsExtensions`).
Keep that convention.

## Layout

```
src/rules/          pure, framework-free, unit tested
  types.ts          Character, Vitals, ResourcePool, ConditionDef, entries, PackPin
  version.ts        CURRENT_SCHEMA_VERSION (5) — dependency-free on purpose
  dice.ts           rollD20 / rollDamage, injectable Roller seam
  vitals.ts         damage, healing, temp HP, death saves, concentration DC, startingHp
  rest.ts           short and long rest restoration
  derive.ts         every computed value, including passive scores and mitigateDamage
  abilityScores.ts  standard array, point-buy cost table
  tokens.ts         token expansion
  skills.ts         the 18 skills and their abilities
  schema.ts         Zod schemas
  migrations.ts     versioned migration chain
  diff.ts           JSON-pointer document differ
src/packs/           pure, framework-free, unit tested -- the rules-pack subsystem
  types.ts          RulesPack, ClassDef, RaceDef, BackgroundDef, ChoiceDef, FeatureDef, ...
  schema.ts         Zod schemas mirroring types.ts
  resolver.ts       resolvePacks() -- flattens installed packs + a character's pins into one fqid index
  validate.ts       validatePackImport() -- per-entry validation, partial packs import what's valid
  levelup.ts        featuresAtLevel / grantsForLevelRange -- what a class(+subclass) grants across a level range
src/store/
  apply.ts          dispatch layer: diff, coalesce, retention, revert
  character.ts      characters, active selection, history, createFromWizard
  packs.ts          installed rules packs (IndexedDB `rules_packs` store)
  session.ts        ephemeral state
  actions.ts        every roll and state change the UI can trigger
  db.ts             IndexedDB wrapper (DB_VERSION 2: characters, changes, meta, rules_packs)
  labels.ts         JSON pointer -> human label for history
src/data/           conditions, seed character, blank/duplicate factories
src/components/     Header, Alerts, Abilities, Skills, Center, SideRail, History, Editor, Portrait,
                    CreateCharacter (guided-creation wizard), LevelUp, ChoicePicker (shared)
```

## Verifying

```bash
npm install
npm test           # 85 tests: dice, vitals, apply/history, rest, derive, tokens, packs/*, abilityScores
npm run build      # tsc --noEmit && vite build
npm run dev
```

Add tests for anything in `src/rules/`, `src/packs/`, or `src/store/apply.ts`. UI components are
untested by design *except* that any new UI touching the rules-pack pipeline (wizard, level-up,
pack import) should be smoke-tested end-to-end with Playwright against a running `npm run dev`
before calling it done — several real bugs in this project were only ever caught that way, never by
`tsc`. Set up Playwright in the scratchpad, never in the repo (it's a dev-only verification tool,
not a project dependency): `npm init -y && npm install playwright@1.62.1` in a scratch dir, `npx
playwright install chromium` (usually cached already), then a throwaway driver script. Delete the
scratch dir when done.

---

## Current state

**Working, end to end:** the full sheet (header, abilities, skills, tabbed center column, dice log,
conditions, resource pips), multiple characters, the `apply()` dispatch layer with history/revert,
IndexedDB persistence, JSON editor with Zod validation and export/import, PWA shell, GitHub Actions
deploy. Extended character schema: resistances/immunities/vulnerabilities (wired into real damage
math via `mitigateDamage`), senses + derived passive scores, currency, background/personality/
characteristics/appearance/portrait, Heroic Inspiration, armor/weapon/tool proficiencies + languages.

**Rules packs (phase 3) are built and populated**, not just scaffolded: `src/packs/` has the full
type system, a resolver, a per-entry validator, and a level-application engine. Two real packs exist
(kept out of git per Hard Rule 5 — ask the user for the files): `homebrew-pugilist` (a full 3rd-party
OGL class, levels 1-20, 6 subclasses, transcribed and cross-checked against two independent source
exports) and `phb-2024` (Human race with structured skill/feat choices, Noble background, Tavern
Brawler/Skilled feats — grown incrementally, most of the 2024 PHB isn't in it yet and shouldn't be
added in bulk, see `PLAN.md` §11).

**Guided character creation and level-up (phase 6) are built**, driven entirely by installed packs:
`CreateCharacter.tsx` (packs → race → class + starting level + any choices it surfaces → background
→ ability scores → class skill choices → review) and `LevelUp.tsx` (target level → resolved choices,
e.g. a subclass pick → applied as one batched, revertable History row). Both are additional routes
alongside the pre-existing blank-slate and duplicate, which still work unchanged.

**Combat RAW and the grimoire theme landed after phase 6.** Crits double base and rider dice but
not flat modifiers; cover gives +2/+5 to AC and Dex saves only; damage taken at 0 HP is a death-save
failure, two on a crit; Massive Damage kills outright. The Header's HP card carries the only damage
path that can name a type or a crit, so `mitigateDamage` and the stored resistances are finally
reachable. Portraits are live: `Portrait.tsx` downscales to 384px JPEG before storing, because
`portraitUrl` lives in the character document and the `edit` channel is never pruned — a
full-resolution photo would sit in the journal forever.

**Known gaps and risks:**

- AC and starting HP default to generic formulas in the wizard (10+DEX, average-per-level) since
  `ClassDef` has no structured way yet to say "this class overrides AC" — both are plain editable
  fields, correct them after creation for a class like Pugilist (Iron Chin: 12+CON).
- Resource pools beyond hit dice (e.g. Pugilist's Moxie Points) aren't auto-wired by the wizard —
  `ClassDef` doesn't carry pool-by-level data yet. Add them by hand via the Editor after creation.
- `phb-2024`'s `BackgroundDef`s don't have verified skill/tool/language grants (Noble's aren't
  confirmed from real source text) — the wizard's background step falls back to manual skill
  selection when `skillProficiencies` is absent. Don't fabricate specific grants; get real source
  text from the user the same way the Pugilist pack's gaps got closed.
- Bundled condition and spell text is paraphrased placeholder, not SRD text yet.
- There is no sync. `src/store/db.ts` is the only persistence; laptop and tablet do not share state
  until phase 4.
- Combat mode has a toggle in the header and session state, but no UI.
- The header is 330px on a 768px-wide screen (iPad mini portrait) because the layout segmented
  control will not share a row. It is a set-once display preference sitting in prime real estate;
  moving it into the Editor is the fix if that device ever matters.
- Multiclassing isn't modeled — `Character.classes` is architecturally an array but `LevelUp.tsx`
  only ever touches `classes[0]`.

## Next work, in order

1. **Phase 4 — Supabase.** Auth via GitHub OAuth, RLS scoped to `auth.uid()`, tables for
   `characters`, `character_changes`, and `rules_packs` — DDL is in `PLAN.md`. Local-first: writes
   land in IndexedDB synchronously and the push is debounced and allowed to fail. Per-row optimistic
   concurrency on `rev`; on mismatch show a modal and let the user pick a side. Never merge, never
   silently overwrite. Wire the keepalive workflow's secrets — free projects pause after ~7 days
   of inactivity and a fortnightly campaign will hit that.
2. **Phase 5 — history polish.** Filter by field, jump-to-date, visual batch collapse in the UI (the
   data already supports all three; History currently only filters by channel).
3. **Grow `phb-2024` incrementally** as new characters need content from it — real source text only,
   same process as the Pugilist pack.
4. **Auto-wire resource pools from `ClassDef`** (Moxie-Points-style pools with a max-by-level table),
   closing the biggest gap in the guided-creation wizard's automation.
5. **Phase 7 — combat mode.** Lanes driven by tagged entries: each action/spell carries `lane`, a
   `requires` resource cost, and `favoredWhen` tags that reorder options when a situation chip is
   active. Do not hand-code per-character tactics.

## Style

Match the existing code. Comments explain *why*, not *what* — the codebase has few of them and each
one earns its place. Prefer small pure functions in `src/rules/`/`src/packs/` over logic embedded in
components. Keep the touch-target rules in `tokens.css` intact: the prototype is mouse-density
throughout and the tablet is the reason the `@media (pointer: coarse)` block exists.
