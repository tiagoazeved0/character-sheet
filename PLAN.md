# Character sheet — implementation plan

A 5e digital character sheet: multi-character, character creation, pluggable rules content with
version switching, full change history, usable on laptop and tablet. Hosted on GitHub Pages,
state synced through Supabase. Personal use, actively developed.

Source material: the `design_handoff_character_sheet` bundle. Its `README.md` is the visual and
behavioural spec and stays authoritative for look and feel. The logic class inside
`Character Sheet.dc.html` is the rules engine to port. `support.js` is prototype scaffolding and
is not ported.

---

## 1. Decisions taken

| Decision | Choice |
|---|---|
| Stack | Vite + React + TypeScript, fresh repo |
| Hosting | GitHub Pages, public repo, deployed via GitHub Actions |
| State store | Zustand, with all mutations routed through one dispatch layer |
| Persistence | Local-first (IndexedDB), Supabase as sync target |
| Auth | Supabase Auth, GitHub OAuth provider |
| Characters | Multiple, created and edited in-app |
| Rules content | Versioned, layered rules packs; SRD 5.1 bundled, everything else uploaded |
| History | Append-only diff journal, per character, with per-field revert |
| Level-up flow | Deferred, returns for free once class tables exist in a pack |
| Styling | CSS custom properties for the token set, CSS Modules for components |

### The load-bearing decision: one dispatch layer

Every change to a character — a `−5` HP tap, a long rest, an edit to max HP, a level-up — goes
through a single `apply(characterId, mutation)` function. That function, and only that function:

1. computes the new document,
2. emits one or more diff entries into the history journal,
3. marks the record dirty for sync,
4. writes to IndexedDB.

History, sync, and undo all fall out of this for free. Scattering `setState` calls across
components and adding logging afterwards means touching every call site and missing some. Build
this in phase 1, before any UI.

---

## 2. Rules packs

A rules pack is a versioned, self-contained bundle of game content. The app ships with one (SRD
5.1). Everything else — a 2024 pack, homebrew, a campaign's house rules — is uploaded by the user
at runtime and stored in their own Supabase row. **No non-SRD content is ever committed to the
repo.**

```ts
type RulesPack = {
  packId: string          // "srd-5.1", "homebrew-ashvale"
  version: string         // semver; characters pin an exact version
  title: string
  edition: '2014' | '2024' | 'custom'
  license: string         // shown in the UI; required for bundled packs
  content: {
    spells:      SpellDef[]
    conditions:  ConditionDef[]
    classes:     ClassDef[]
    races:       RaceDef[]
    backgrounds: BackgroundDef[]
    feats:       FeatDef[]
    items:       ItemDef[]
  }
}
```

### Layering and references

A character pins an ordered list of packs:

```ts
packs: [
  { packId: 'srd-5.1',           version: '1.0.0' },
  { packId: 'homebrew-ashvale',  version: '0.4.2' },  // later entries win
]
```

On load, a resolver builds a flat index by walking the list in order. Later packs override earlier
ones when they declare the same fully-qualified id or list it in `replaces`. References inside a
character are always fully qualified — `srd-5.1:spell/fireball` — so a 2014 and a 2024 Fireball can
coexist without collision.

Two rules that matter more than they look:

- **Pinned versions.** A character records the exact pack version it was built against. Uploading
  a new version of a pack never silently changes a live character; the UI offers an explicit
  "update to 1.1.0" with a diff of what would change.
- **Cached resolution snapshots.** Every reference on a character also stores a snapshot of what it
  resolved to last time — name, description, the numbers. If a pack is missing, deleted, or fails
  to load, the sheet still renders and is still playable, with a "content unavailable, showing
  cached" marker. This matters a lot when you are actively rewriting your own packs.

### Validation and import

Packs are validated with Zod on import, with errors reported per-entry rather than rejecting the
whole file. A partially valid pack imports the valid entries and lists the rest. Import is a JSON
file drop; export produces the same format, so packs round-trip and can be hand-edited.

### Class definitions

`ClassDef` is what makes both character creation and level-up possible, so it needs the whole
progression table:

```ts
type ClassDef = {
  id: string
  hitDie: 6 | 8 | 10 | 12
  saveProficiencies: Ability[]
  skillChoices: { count: number; from: SkillId[] }
  spellcasting?:
    | { kind: 'pact'; table: { level: number; slots: number; castLevel: number }[] }
    | { kind: 'slots'; table: number[][] }   // [charLevel][spellLevel]
  levels: {
    level: number
    features: string[]          // references into the same pack
    choices?: ChoiceDef[]       // invocations, ASI, subclass, new spells
    proficiencyBonus: number
  }[]
}
```

`ChoiceDef` carries prerequisites so the level-up UI can show ineligible options with the reason,
which the handoff is right to insist on — "Requires warlock 12" is more useful than hiding the row.

---

## 3. Character creation

Three routes, built in this order:

1. **Blank slate.** An empty character conforming to the schema, filled in by hand. Available from
   phase 3, before any class tables exist. Unglamorous and sufficient.
2. **Duplicate as template.** Copy an existing character, rename, edit. Covers most real cases for
   a personal tool.
3. **Guided creation,** driven by `ClassDef` / `RaceDef` / `BackgroundDef` from the selected packs:
   race → class → background → ability scores → skill and spell choices → derived values computed.
   Only possible once packs carry class tables, and it shares its entire choice-rendering layer
   with level-up. Build them together or not at all.

Ability score generation should offer standard array, point buy, and manual entry. If rolling is
included, it pushes to the dice log like any other roll.

---

## 4. Change history

Not event sourcing. The character document stays the source of truth; every mutation also appends
an immutable diff row.

```ts
type Change = {
  id: string
  characterId: string
  at: string              // ISO timestamp
  batchId?: string        // groups multi-field operations
  batchLabel?: string     // "Long rest", "Level up 8 → 9", "Edit: vitals"
  channel: 'edit' | 'play'
  path: string            // JSON pointer, e.g. "/maxHp"
  label: string           // "Maximum hit points"
  before: unknown
  after: unknown
}
```

### Two channels, different retention

- **`edit`** — sheet changes: max HP, level, proficiency, adding a spell, changing a score, pack
  updates. Rare, permanent, kept forever. This is the channel that answers "what was my max HP
  before I broke it."
- **`play`** — session churn: HP up and down, resource pips, conditions, concentration, rests.
  High volume. Kept per session, bounded by storage rather than a fixed session count (see §12.3):
  when it grows too large, force a local export before pruning the oldest sessions.

Without this split the log is ninety-five percent HP ticks and useless for the thing you actually
want it for.

### Coalescing and batching

- Repeated changes to the same path within about ten seconds collapse into one entry, so four taps
  of `−5` become a single `62 → 42`.
- A long rest touches HP, several resource pools, conditions and concentration. Those share a
  `batchId` and render as one collapsible row.

### UI

A History tab beside Notes. Reverse-chronological, filterable by field and by channel. Each row
shows `label: before → after` with a timestamp, and offers **revert this field**, which is itself
a normal mutation and so is itself logged. Reverting a batch replays the whole group backwards.

This also supersedes the level-up snapshot/undo from the prototype — general undo covers it.

### Storage

A separate `character_changes` table, insert-only. Because it is append-only it can never
conflict, which makes the sync story simpler rather than harder.

---

## 5. Sync

Local-first. Table wifi is unreliable and the sheet is useless if a network hiccup blocks an HP
change mid-fight. Writes land in IndexedDB synchronously; the Supabase push is debounced and
allowed to fail, with a visible sync-status indicator (synced / pending / offline / conflict).

**Characters** use per-row optimistic concurrency: `rev` integer plus `updated_at`, pushed as
`update … where id = ? and rev = ?`. On mismatch, do not merge and do not silently overwrite —
show a modal with each side's timestamp and a diff of HP and resources, and let the user pick.
Realistically you are one person on two devices and the conflict is always "I left the tablet
open", so a prompt is the right amount of machinery.

**Change rows and rules packs** are append-only and immutable respectively, so they just push.

**Ephemeral state never syncs:** dice log, advantage mode, combat lanes, round counter, situation
chips. It resets per encounter and lives in memory only.

### Supabase schema

```sql
create table characters (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) default auth.uid(),
  rev integer not null default 1,
  updated_at timestamptz not null default now(),
  data jsonb not null
);

create table character_changes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  character_id uuid not null references characters(id) on delete cascade,
  at timestamptz not null default now(),
  batch_id uuid,
  channel text not null check (channel in ('edit','play')),
  data jsonb not null
);

create table rules_packs (
  owner uuid not null default auth.uid(),
  pack_id text not null,
  version text not null,
  data jsonb not null,
  primary key (owner, pack_id, version)
);

alter table characters        enable row level security;
alter table character_changes enable row level security;
alter table rules_packs       enable row level security;
-- one owner_all policy per table: using (owner = auth.uid()) with check (owner = auth.uid())
```

Storing documents as `jsonb` keeps schema migrations in TypeScript alongside the Zod schema rather
than split across Postgres migrations.

Two corrections the implementation forced. `characters.id` is **text, not uuid**: ids are generated
on the client and are not all uuids (the bundled seed is `seed-vessa`, and `uid()` falls back to a
base-36 string where `crypto.randomUUID` is unavailable). And `rev` lives in a local `sync_meta`
store, **never on the character document** -- on the document `apply()` would diff it and journal a
history entry every time the app synced.

### The pause problem

Free Supabase projects pause after about a week without database activity, and resuming is manual
with a cold start. A fortnightly campaign will hit this. In the repo from day one:

- `.github/workflows/keepalive.yml` — cron, twice weekly, one trivial query against a `heartbeat`
  table.
- Graceful degradation to local-only, surfaced in the sync indicator.
- Manual JSON export as backstop. The free tier has no backups.

---

## 6. Character data model

```ts
type Character = {
  schemaVersion: number
  id: string
  name: string
  packs: { packId: string; version: string }[]

  level: number
  classes: { classId: string; level: number; subclassId?: string }[]
  raceId?: string
  backgroundId?: string

  proficiencyBonus: number   // stored, not derived — multiclass makes derivation wrong
  scores: Record<Ability, number>
  saveProficiencies: Ability[]
  skills: Record<SkillId, 0 | 1 | 2>
  maxHp: number
  ac: number
  speed: number

  spellcasting:
    | { kind: 'pact'; slots: number; castLevel: number }
    | { kind: 'slots'; perLevel: number[] }
    | { kind: 'none' }

  resources: ResourcePool[]   // hit dice, once-per-rest features, arcanum, ki, rages…
  spells:   Ref[]             // "srd-5.1:spell/fireball" + cached snapshot
  actions:  ActionEntry[]
  features: Ref[]
  items:    ItemEntry[]
  customTokens: Record<string, string>
  notes: string

  heroicInspiration: boolean
  defenses: { resistant: DamageType[]; immune: DamageType[]; vulnerable: DamageType[] }
  senses: { kind: 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight'; range: number }[]
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number }
  background: { name: string; feature: string }
  personality: { traits: string; ideals: string; bonds: string; flaws: string }
  characteristics: { alignment, gender, eyes, size, height, faith, hair, skin, age, weight: string }
  appearance: string
  portraitUrl: string
}
```

`defenses`/`senses`/`currency` are mechanically load-bearing: `mitigateDamage()` in `src/rules/derive.ts` halves/zeroes/doubles typed damage against `defenses` (untyped damage — the common quick-tap case — is never mitigated), and `passivePerception`/`passiveInvestigation`/`passiveInsight` are derived from existing skill bonuses, never stored. `background`/`personality`/`characteristics`/`appearance`/`portraitUrl` are pure flavor with no derived math. None of these have dedicated edit forms yet — they go through the JSON editor's full-document textarea, same as any field without a quick-edit widget.

**Never store derived values.** Spell save DC, spell attack, slot level, skill and save totals are
selectors computed from base state. The handoff README is emphatic and it is the most important
rule in the port. Proficiency bonus is the deliberate exception: it is stored because multiclass
makes level-derivation wrong, with the editor suggesting the by-level default.

**Spell slots.** Two shapes cover essentially all of 5e: a pact pool (N slots, one cast level,
short rest) and a standard table. Multiclass casters use the standard shape plus a pact
`ResourcePool`.

**Tokens.** The prototype's `%A% %S% %D% %DC% %T% %AA%` placeholders are Warlock-specific. Do not
build an expression evaluator. Ship fixed built-ins (`%ATK%`, `%DC%`, `%PROF%`, `%SLOT%`, `%LVL%`,
`%MOD:cha%`) plus a `customTokens` map of literal strings. Good enough, and it cannot break at the
table.

### Companions

Familiars, wild shape forms, steeds, summons and beast companions are creatures the player runs, so
they belong to the character document rather than to a pack index — a bestiary in a player's sheet is
metagaming, and a familiar's current hit points are state nobody else can track for you.

```ts
companions: CompanionEntry[]              // the stat block: ac, maxHp, speed, senses, actions
companionHp: Record<string, number>       // id -> current HP; absent means undamaged
```

The split matters. `diffDocuments` compares arrays as whole values on purpose, so HP stored inside
the entry would write two full copies of the array into the journal every time the familiar took a
hit. `resources[]` + `usage{}` already solves exactly this, and companions follow it. Their attacks
reuse `ActionEntry`, so they roll through the same path as everything else on the sheet.

### Schema migrations

You will be shipping breaking changes to yourself while a live character exists. Non-negotiable:
`schemaVersion` on every document, a migration chain in `src/rules/migrations.ts`, and an automatic
JSON export written before any migration runs.

---

## 7. Repo layout

```
src/
  rules/
    dice.ts         # rollD20, rollDamage, advantage resolution
    vitals.ts       # applyDamage, heal, death saves, concentration DC
    rest.ts         # short/long rest restoration
    derive.ts       # proficiency, spell DC, attack bonus, slot level
    tokens.ts
    schema.ts       # Zod: Character, RulesPack, Change
    migrations.ts
  packs/
    resolver.ts     # layering, override, cached snapshots
    validate.ts
    srd-5.1.json    # the only bundled pack
  store/
    apply.ts        # THE dispatch layer — every mutation goes here
    character.ts
    history.ts
    session.ts      # ephemeral: dice log, combat lanes, advantage mode
    sync.ts
  components/
  styles/
    tokens.css      # the palette; every colour in the app resolves here
    app.css         # semantic classes and layout
    grimoire.css    # theme layer, imported after app.css
```

`src/rules/` and `src/packs/` are framework-free and unit tested. A wrong `rollD20` is the kind of
bug that is embarrassing at the table and the cheapest thing in the app to test properly.

---

## 8. Responsive and touch

The prototype has no media queries — the three layouts are a manual toggle.

- **The masthead carries identity, the sheet carries vitals.** Compacting a header that held hit
  points, four stat tiles and six buttons only ever bought so much: it still had four vertical
  rhythms in one bar and 144px of fixed furniture. Splitting it the way D&D Beyond, Demiplane and
  Pathbuilder all do — a 65px identity bar, and a full-width `Vitals` strip at the top of the sheet
  body — is what actually fixed it. The strip scrolls with the sheet, so permanent chrome went from
  230px to 65px on the table tablet, and hit points finally have room for a legible damage control
  instead of an 11px select.
- **Sticky only where it pays.** Under `@media (max-height: 700px)` the header is `position: static`.
  A sticky header costs its full height on every screen forever; on a 600px-tall tablet that was a
  third of everything visible, too much to pay for keeping HP in the corner. Taller screens keep it.
- **Auto-select by viewport,** manual toggle retained as an override: under 900px stacked, otherwise
  tablet, and `columns` only above 1300px *and* on a fine pointer. That last clause is load-bearing —
  the Tab S6 Lite reports 1333 × 800 (2000 × 1200 at DPR 1.5) and used to land on the desktop layout.
  A touchscreen at arm's length is not a desk, whatever width it claims. The override lives in the
  Editor, not the header — it is set once, and in the header it was the widest thing in a row already
  fighting for space on a small tablet.
- **One number is the type scale.** Every font size in the app is `rem`, so the root `font-size` in
  `tokens.css` scales all of it: 16px on a mouse, 20px under `@media (pointer: coarse)`. That tablet
  puts ~149 CSS px in an inch against a laptop's ~108, so identical `px` are a third smaller in the
  hand; the bump is the correction, not a preference. Boxes, gaps and `--tap` stay `px` — they are
  laid out against the viewport, and scaling them here would fight the media queries.
- **Coarse-pointer pass.** Under `@media (pointer: coarse)`, raise interactive elements to a 44px
  minimum target and make resource pips `var(--tap)` square, wrapping to a second row past about
  six. Sizing them by width alone gave 28 wide by 44 tall, because the same block sets `min-height`
  on every `button`. Leave desktop density alone.
- **Sticky only where it fits.** A sticky box taller than the viewport pins in place and will not
  scroll until the page under it runs out — which is what the side rail did, since it grows with the
  dice log and one pool per class feature. On a fine pointer it is capped to the viewport with its
  own scroll; on a coarse one it is `static` and the page simply scrolls.
- **Dice panel in stacked layout.** *Still open.* The side rail sorts last, putting the most-used
  control at the bottom of a long scroll on a portrait tablet. Recommend a sticky bottom sheet,
  collapsed to the last roll's total. A deliberate deviation from the handoff.

## 9. Offline

`vite-plugin-pwa` with app-shell precache, installable to the tablet home screen. Self-host every
face via `@fontsource` — offline makes it mandatory, and a Google Fonts `<link>` would fall back to
system serif at a table with no wifi. Currently IM Fell English SC, EB Garamond and Cutive Mono.
Rules packs cache in IndexedDB, so a pack is available offline once imported.

---

## 10. Phasing

| Phase | Scope | Usable at the table? | Status |
|---|---|---|---|
| 0 | Repo scaffold, Pages deploy, tokens, self-hosted fonts | no | done |
| 1 | `apply()` dispatch layer, `src/rules/` ported and tested, Zod schemas, history journal | no | done |
| 2 | Full sheet UI on a fixture character, local persistence, responsive + touch pass | **yes**, one device | done |
| 3 | Pack resolver, packs, pack import/export UI, character switcher, blank-slate creation | yes | done -- `src/packs/`, resolver, validator, level engine, two real packs (`homebrew-pugilist`, `phb-2024`, kept out of git per Hard Rule 5) |
| 4 | Supabase auth, sync, conflict prompt, keepalive cron | **yes, both devices** | done -- `src/store/outbox.ts` (pure, tested) + `src/store/sync.ts`, DDL in `supabase/schema.sql`, setup in `supabase/README.md`. Switched on and exercised across two real devices on 2026-09-02, conflict included |
| 5 | History tab with per-field revert | yes | partial -- channel filter only, no field filter/jump-to-date/visual batch collapse yet |
| 6 | Class tables in packs → guided creation and level-up, sharing one choice-rendering layer | yes | done -- `CreateCharacter.tsx` + `LevelUp.tsx` share `ChoicePicker.tsx` and `src/packs/levelup.ts`; known gaps: AC/HP defaults, resource-pool auto-wiring (see `CLAUDE.md`) |
| 7 | Combat mode, lanes driven by tagged actions | yes | done -- `Combat.tsx` over `src/rules/combat.ts`; `requires` added to `ActionEntry`/`SpellEntry` |

The grimoire restyle (vellum, oxblood, letterpress; IM Fell / EB Garamond / Cutive Mono) is not a
phase — it is a palette and type swap that ports as `tokens.css` plus `grimoire.css`, because no
component holds a colour of its own. Keep it that way: the one colour literal left in the repo is
`theme-color` in `index.html`, which cannot take a `var()`.

Neither are the passes that landed between phases 6 and 7, all of them sheet work rather than new
architecture: combat RAW (crits, cover, damage at 0 HP, Massive Damage), companions on the sheet,
the masthead/vitals split, the conditions panel and cover rehoming, and the tablet legibility pass
in §8. They are recorded in `CLAUDE.md`'s current-state section, not here.

Phase 2 is the first genuinely useful build. Phase 4 is the one that makes laptop-and-tablet work.
Phases 5–7 are separable and can slip without hurting anything.

History is built in phase 1 but surfaced in phase 5. The journal must exist from the first
mutation, or it is missing exactly the period when you were breaking things most.

### Combat mode, in brief

The prototype's lane options are hand-authored for one character. Data-driven replacement, built:
each action and spell carries `lane: 'action' | 'bonus' | 'move' | 'reaction' | 'free'`, a
`requires` cost (`{ pool: 'pact', amount: 1 }`), and optional `favoredWhen: ['range', 'dim']` tags
that reorder options when a situation chip is active. `lanePlan()` in `src/rules/combat.ts` is the
whole decision and `Combat.tsx` only draws it: options you cannot pay for drop out — counted, not
silently — the favoured ones float up, and no character's tactics are hand-coded.

Features are options too, which the original sketch missed. A `FeatureEntry` reaches the lanes when
it carries a `pool` or a `lane`, so a Pugilist's Moxie kit — Brace Up, One-Two Punch, Stick and
Move — sits in the Bonus lane and empties out of it when the pool does, while Iron Chin stays off
the lanes where it belongs. A class whose whole kit lives in `features[]` is the common case, not
the exception.

Shapes that look like oversights and are not. A used lane **mutes its heading only** — it never
locks (Extra Attack is two swings out of one Action) and never dims its options (that made the row
you had just rolled look disabled), and there is no manual "mark used" control. An entry with **no
`lane` is an action**, or every character written before lanes existed would open combat mode to
five empty panels. **Move holds a distance rather than a flag**, since it is the one part of a turn
that is a quantity. And **an attack asks "did it hit?" before offering damage**, because the DM
calls hits — skipping the question only on a natural 20 or a natural 1, where the die already
answered.

---

## 11. Content and licensing

- Bundle SRD 5.1 under CC-BY-4.0 with the attribution notice committed.
- Everything else is user-uploaded at runtime into the user's own Supabase row. Nothing non-SRD is
  committed to the public repo, and pack export is local-file only, never a share link.
- Keep the UI visually distinct from commercial character-sheet products, as the handoff insists.

---

## 12. Decisions (formerly open questions)

1. **Edition:** one at a time for now. The layering model already handles 2014 and 2024
   simultaneously, so nothing needs ripping out — but simplifying the resolver for the
   single-edition case isn't a priority either. Toggling between editions is a nice-to-have,
   revisit later.
2. **Sharing:** packs stay strictly personal — no sharing with other players, no public-read RLS
   policy needed for phase 4. Someday idea, not scoped: an integration to pull rules content
   directly from officially owned digital books (e.g. a D&D Beyond library) instead of hand
   transcribing PDFs into a pack. Not planned work yet, just worth remembering the itch exists.
3. **`play` history retention:** keep it per session rather than "current plus two," bounded by
   storage rather than a fixed count. When it grows too large, prune with a forced local export
   first (never silently discard) — the export is the safety valve, not a nice-to-have. Exact size
   threshold TBD when phase 5 is built.
4. **Guided creation:** worth it, now that real class/spell/item data exists in `phb-2024` to drive
   it. Next concrete step is testing the `CreateCharacter.tsx` flow end-to-end against that pack.
5. **DM read access:** no. Personal-use tool, single owner. Phase 4's RLS design (`owner =
   auth.uid()` on every table) already matches this — nothing to change there.
