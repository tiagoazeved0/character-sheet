# Character Sheet

A 5e digital character sheet for personal use: multiple characters, every modifier rollable,
conditions that change the maths, and a full change history. Local-first, installable, hosted on
GitHub Pages.

Built from the `design_handoff_character_sheet` bundle. See `PLAN.md` for the architecture and
the phase plan.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # rules engine unit tests
npm run build    # type-check + production build
```

## Deploying

1. Push to a GitHub repo.
2. **Set `base` in `vite.config.ts` to `'/<your-repo-name>/'`.** Assets 404 otherwise.
3. Settings → Pages → Source: **GitHub Actions**.
4. Push to `main`. The workflow type-checks, runs the tests and deploys.

The repo must be public for Pages on the free plan. That is fine here: character data lives in
your browser, not in the repo.

## The one rule

**Every change to a character goes through `apply()` in `src/store/apply.ts`.** That function
computes the diff, writes the history journal and marks the record for sync. Mutate a character
document anywhere else and it silently vanishes from history and, later, from sync. There are no
exceptions to this, including in the editor.

## Layout

```
src/rules/     pure, framework-free, unit tested
  dice.ts      rollD20 and rollDamage, with an injectable die roller
  vitals.ts    damage, healing, temp HP, death saves, concentration DC
  rest.ts      short and long rest restoration
  derive.ts    every computed value -- none of these are ever stored
  tokens.ts    %DC%, %ATK%, %SLOT% and friends
  schema.ts    Zod validation
  migrations.ts
src/store/
  apply.ts     the dispatch layer: diff, coalesce, retention, revert
  character.ts characters, active selection, history
  session.ts   ephemeral: dice log, advantage, combat lanes
  actions.ts   every roll and state change the UI can trigger
  db.ts        IndexedDB
src/data/      bundled conditions, the seed character, blank/duplicate factories
src/components/
```

### Derived values are never stored

Spell save DC, spell attack, skill totals, slot levels: all selectors in `derive.ts`. Storing them
is what makes a sheet go stale mid-campaign. The one deliberate exception is `proficiencyBonus`,
which is stored because deriving it from level is wrong the moment you multiclass; the editor
suggests the by-level default.

### History

Two channels. `edit` covers sheet changes and is kept forever -- this is what answers "what was my
max HP before I broke it". `play` covers session churn and is pruned. Repeated pokes at the same
field within ten seconds collapse into one entry, and multi-field operations like a long rest share
a batch so they revert together. Reverting is itself a logged mutation.

### Responsive

The handoff has no media queries; layout is a manual toggle. Here the viewport picks a default
(stacked / tablet / columns) and the toggle becomes an override, with `Auto` to hand control back.
Touch targets grow to 44px under `@media (pointer: coarse)` without changing desktop density.

## Where this stands

Done: rules engine with tests, dispatch layer, history, IndexedDB persistence, the full sheet,
multiple characters, JSON editor with validation, export/import, PWA shell, Pages deploy.

Next, per `PLAN.md`: rules packs with version pinning (phase 3), Supabase auth and sync (phase 4),
the history tab's remaining filters (phase 5), class tables for guided creation and level-up
(phase 6), combat mode (phase 7).

Character creation is currently blank-slate plus duplicate. Guided creation needs class progression
tables, which is what a rules pack will carry.

## Content

Bundled rules text is paraphrased placeholder. Before this repo goes public with more content,
replace it with SRD 5.1 under CC-BY-4.0 and commit the attribution. Non-SRD material is never
committed -- it is uploaded at runtime once the pack loader lands.
