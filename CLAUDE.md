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

**Every font size in the app is `rem`**, so the root `font-size` in `tokens.css` is the whole type
scale: 16px on a mouse, 20px under `@media (pointer: coarse)`. A ten-inch tablet reports ~1333 CSS
px across 8.9 inches of glass — ~149 CSS px to the inch against a laptop's ~108 — so identical `px`
are a third smaller in the hand, and that bump is the correction. Boxes, gaps and `--tap` stay `px`
on purpose: they are laid out against the viewport, and scaling them here would fight the media
queries. Adding a `px` font size anywhere, stylesheet or inline `style`, opts that text out.

TypeScript is strict, with `noUnusedLocals`, `noUncheckedIndexedAccess` and `verbatimModuleSyntax`
on. **Relative imports carry explicit `.ts` / `.tsx` extensions** (`allowImportingTsExtensions`).
Keep that convention.

## Layout

```
src/rules/          pure, framework-free, unit tested
  types.ts          Character, Vitals, ResourcePool, ConditionDef, entries, CompanionEntry, PackPin
  version.ts        CURRENT_SCHEMA_VERSION (6) — dependency-free on purpose
  dice.ts           rollD20 / rollDamage, injectable Roller seam
  vitals.ts         damage, healing, temp HP, death saves, concentration DC, startingHp
  rest.ts           short and long rest restoration
  derive.ts         every computed value, including passive scores and mitigateDamage
  combat.ts         lanePlan / turnPlan / spellCost -- what the character can do this turn
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
  db.ts             IndexedDB wrapper (DB_VERSION 3: characters, changes, meta, rules_packs, outbox, sync_meta)
  outbox.ts         pure sync logic — queue, conflict resolution, status. unit tested
  sync.ts           the Supabase half: auth, debounced push, pull, conflicts
  labels.ts         JSON pointer -> human label for history
src/data/           conditions, seed character, blank/duplicate factories
src/components/     Header, Vitals, Alerts, Abilities, Skills, Center, Combat, SideRail, History, Editor,
                    Portrait, CreateCharacter (guided-creation wizard), LevelUp, ChoicePicker, Menu (shared)
```

## Verifying

```bash
npm install
npm test           # 150 tests: dice, vitals, apply/history, rest, derive, combat, tokens, migrations, packs/*, abilityScores
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

**Combat mode (phase 7) is built.** The header toggle swaps the centre column for `Combat.tsx`:
the turn in lanes — action, bonus, move, reaction, free — each listing what this character can
actually do right now. `src/rules/combat.ts` makes every decision and the component only draws it.
`lanePlan()` reads `lane`, `requires` and `favoredWhen` off the entries themselves, drops the
options there is nothing left to pay for (and says how many it dropped, so a spell vanishing
mid-fight has a reason), and floats the ones an active situation chip favours to the top. It reads
actions, spells **and features**: a feature is a turn option when it carries a `pool` or a `lane`,
which is what puts a Pugilist's Moxie kit on the lanes and leaves Iron Chin off them. That last
part was missing until the first real character walked into it — Damiana has two actions, no
spells, and eleven features. The chips
are built from the character's own `favoredWhen` tags rather than a fixed vocabulary. Nothing is
hand-coded per character — that is what made the prototype's version fit exactly one warlock.
`requires: { pool, amount }` is new on `ActionEntry`/`SpellEntry`; it is optional, so old documents
still validate and there is no migration or schema bump. Casting goes through `actions.castSpell()`
now, one `apply()` that spends the slot or pool and picks up concentration together, and the
sheet's spell row shares its `spellCost()` — the two can never charge different pools.

**Companions are on the sheet.** Familiars, wild shape forms, steeds, summons and beast companions
live on the character as `companions: CompanionEntry[]`, with their attacks reusing `ActionEntry` so
they roll like anything else. Their current HP is `companionHp: Record<id, number>`, deliberately
*not* a field on the entry: `diffDocuments` compares arrays as whole values, so HP inside the entry
would journal two full copies of the array every time the familiar took a hit. This is the same
pattern `resources[]` + `usage{}` already uses, for the same reason. An absent key means undamaged.
Stat blocks are added and edited through the JSON editor, like every other entry type.

**Known gaps and risks** — real holes, all fair game:

- AC and starting HP default to generic formulas in the wizard (10+DEX, average-per-level) since
  `ClassDef` has no structured way yet to say "this class overrides AC" — both are plain editable
  fields, correct them after creation for a class like Pugilist (Iron Chin: 12+CON).
- Resource pools beyond hit dice (e.g. Pugilist's Moxie Points) aren't auto-wired by the wizard —
  `ClassDef` doesn't carry pool-by-level data yet. Add them by hand via the Editor after creation.
- `phb-2024`'s `BackgroundDef`s don't have verified skill/tool/language grants (Noble's aren't
  confirmed from real source text) — the wizard's background step falls back to manual skill
  selection when `skillProficiencies` is absent. Don't fabricate specific grants; get real source
  text from the user the same way the Pugilist pack's gaps got closed.
- Bundled condition and spell text is paraphrased placeholder, not SRD text yet. The condition
  *list* is complete: all fifteen plus six exhaustion levels, plus Bless and Bane.
- **Sync is built but not switched on.** `supabase/README.md` has the five setup steps; until the
  two `VITE_SUPABASE_*` values exist the app is local-only, the indicator says "This device only",
  and the Supabase client is never even downloaded (dynamic import, so Vite splits it out). It has
  not been exercised against a real project yet — only the pure logic is tested.
- Combat mode is only as good as the tagging. An entry with no `lane` lands in the Action lane, and
  `lane` / `requires` / `favoredWhen` are set by hand in the JSON editor — nothing in the pack
  pipeline emits them yet, so a freshly created character opens combat mode with everything in one
  lane. The seed character is tagged and is the worked example. A `FeatureEntry`'s `tag` often
  already names the cost ("Bonus Action", "Reaction, 1/Short Rest") and is the honest source to
  tag from; a tag like "Class 2" is a category, not a cost, and is not something to guess at.
- The spell and inventory rows still build their dice label inline, so a flat-damage spell would read
  `0d6+2`. `damageLabel()` in `derive.ts` fixes that shape; the action row and the combat view use
  it, the other two do not.
- Multiclassing isn't modeled — `Character.classes` is architecturally an array but `LevelUp.tsx`
  only ever touches `classes[0]`.

**Settled — these look like oversights and are not. Don't undo them:**

- **The header carries identity and navigation only** — avatar, name, class line, and four controls
  (Inspiration, Rest menu, Combat, Character menu). It is 65px. Everything about how the character is
  doing lives in `Vitals.tsx`, a full-width strip at the top of the sheet body: hit points with the
  bar and both damage paths, then AC / initiative / speed / proficiency / spell DC as stat tiles.
  This is the shape every mature sheet app uses, and it is why the header stopped being 230px of
  fixed furniture. Do not put combat state back in the masthead.
- **Conditions are active chips plus one "Add" menu**, with exhaustion as a 0-6 stepper, not
  twenty-one chips. `actions.setExhaustion` clears the other levels in the same `apply()`, so
  History shows one change and the six exclusive levels stay exclusive.
- **Cover hangs off the AC tile**, not the dice rail: it is a fact about where you are standing, and
  it belongs next to the two numbers it moves. Because the control is no longer beside the log, a
  Dex save passes `notes` to `rollD20` so the detail line names the cover that produced the bonus.
- **Bane is its own `penaltyDie` field**, not a negative `bonusDie`, so a roll under both spells
  shows two dice and cancels where the player can watch it happen.
- **`pick()` never gives a coarse-pointer device the `columns` layout**, whatever width it reports.
  The Tab S6 Lite reports 1333 px and used to land on the laptop layout, which also handed it the
  sticky side rail. That rail is capped to the viewport with its own scroll on a mouse and is plain
  `static` on touch — a sticky box taller than the viewport pins in place and refuses to scroll
  until the page under it runs out.
- **A used lane mutes its own heading and nothing else.** It never locks — Extra Attack is two
  swings out of one Action — and it never dims the options, which made the thing you had just
  rolled look disabled. There is no "mark used" button either: using something marks its lane, and
  the only control is the `Used ↺` pill that puts it back. One button per header, on the four
  headers you never touch, was all noise.
- **An attack asks before it rolls damage.** The DM calls hits, so the row asks "Did it hit?" and
  the damage button only appears on Hit. The two ends skip the question, because the die already
  answered: a natural 20 hits, a natural 1 misses. Options with damage and no attack roll — a
  save-for-half spell — keep their damage button at all times.
- **Move carries a distance, not a used flag.** Movement is the one part of a turn that is a
  quantity, so the lane gets a ±5 ft stepper reading what is left. Going past your speed is allowed
  and shown as "ft over": Dash doubles it and the sheet has no way to know you took it.
- **A feature reaches the lanes only with a `pool` or a `lane`.** Iron Chin and Creature Type are
  facts about the character, not things you do on a turn, and a lane full of them is worse than an
  empty one. `featureIsOption()` in `src/rules/combat.ts` is that rule.
- **An entry with no `lane` is an action**, and situation chips are built from the tags the
  character's own entries carry. A fixed chip vocabulary would fill the row with chips that reorder
  nothing, and defaulting the lane is what stops a pre-lanes character opening to five empty panels.
- **Every font size is `rem`.** The root `font-size` in `tokens.css` is the type scale, 16px going
  to 20px under `@media (pointer: coarse)`. Adding a `px` font size anywhere opts that text out.

## Next work

Ordered by what unblocks the most, but they are independent — pick any one cold. Each says where it
lives and what "done" looks like. Read `PLAN.md` before the structural ones (2 and 3).

Combat mode was phase 7 and is now built; what is left of it is content, not code — tagging a real
character's entries with `lane` and `requires` in the editor.

### 1. Finish phase 4 — turn sync on · *setup, then one real test*

The code is written and the pure half is tested; none of it has ever spoken to a real server. What
is left is the five steps in `supabase/README.md` (project, `schema.sql`, GitHub OAuth app, the two
build secrets, the two keepalive secrets), which need your account and are yours to do. Then the
test that actually matters: **edit the same character on both devices with one of them offline, and
check the conflict modal appears and neither side is silently merged.** Until that runs, treat
`src/store/sync.ts` as unproven — `outbox.ts` is the tested part, `sync.ts` is the I/O around it.
Done when two devices agree and a deliberate conflict is survivable.

### 2. Auto-wire resource pools from `ClassDef` · *closes the wizard's biggest gap*

`ClassDef` has no pool-by-level table, so the wizard can only create hit dice — a Pugilist's Moxie
Points have to be added by hand in the Editor after creation. Add the table to `src/packs/types.ts`
+ `schema.ts`, teach `src/packs/levelup.ts` to emit pools, and wire it into `CreateCharacter.tsx`
and `LevelUp.tsx`. Same shape as the existing feature grants, so it follows an established path.
Note the sibling gap while you are there: AC and starting HP fall back to 10+DEX and average-per-level
because `ClassDef` cannot say "Iron Chin: 12+CON" either. Done when creating a Pugilist gives a
correct Moxie pool with no manual editing.

### 3. Phase 5 — history polish · *self-contained, data already exists*

`History.tsx` filters by channel only. The journal already supports filter-by-field, jump-to-date
and batch grouping — this is UI over data that is already there, no schema or store work. Done when
you can find "when did AC change" without scrolling.

### 4. Dice panel in the stacked layout · *small, real table annoyance*

In portrait the side rail sorts last, so the most-used control on the sheet sits at the bottom of a
long scroll. `PLAN.md` §8 recommends a sticky bottom sheet collapsed to the last roll's total. A
deliberate deviation from the handoff, and worth it.

### 5. Grow `phb-2024` · *do this when a character needs it, not in bulk*

Real source text only, same process as the Pugilist pack: you supply the text, it gets transcribed
and cross-checked. See `PLAN.md` §11. The nearest concrete gap is that its `BackgroundDef`s have no
verified skill/tool/language grants, so the wizard falls back to manual skill selection. **Do not
fabricate grants to fill it.**

### Small and self-contained

- **`damageLabel()` for the spell and inventory rows.** Both still build their dice label inline, so
  a flat-damage spell reads `0d6+2`. `derive.ts` already has the fix; only the action row uses it.
- **Real SRD text for conditions and spells.** `src/data/conditions.ts` is paraphrased placeholder.
  The *list* is complete and the maths is right — this is a text swap plus the CC-BY-4.0 attribution.
- **Multiclassing.** `Character.classes` is architecturally an array; `LevelUp.tsx` only ever touches
  `classes[0]`. Not hard, but it also changes what `proficiencyBonus` means (see Hard Rule 2).
- **The tablet type scale is one number.** `font-size` under `@media (pointer: coarse)` in
  `tokens.css`, currently `20px`. If the sheet still reads small at the table, change that and
  nothing else.

## Style

Match the existing code. Comments explain *why*, not *what* — the codebase has few of them and each
one earns its place. Prefer small pure functions in `src/rules/`/`src/packs/` over logic embedded in
components. Keep the touch-target rules in `tokens.css` intact: the prototype is mouse-density
throughout and the tablet is the reason the `@media (pointer: coarse)` block exists.
