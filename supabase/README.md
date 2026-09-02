# Turning sync on

Until these steps are done the app is local-only: no account, no network, and every
character lives in IndexedDB on one device. That is a supported state — the sync
indicator says "This device only" and nothing is broken.

The anon key is safe in a public build. It grants nothing on its own: every table
has row-level security scoped to `auth.uid()`, so a signed-in user reads and writes
only their own rows.

## 1. Create the project

Supabase dashboard → new project. Free tier is fine. From Settings → API Keys take
the **publishable** key (`sb_publishable_...`), not the legacy `anon` one, which is
on Supabase's deprecation path. Never take `service_role` or `secret` — both bypass
row-level security, and this key is compiled into a bundle GitHub Pages serves to
anyone. Note the project URL separately: unlike the old anon JWT, the publishable
key does not encode it.

## 2. Create the tables

SQL Editor → New query → paste `supabase/schema.sql` → Run. It is safe to re-run.

## 3. Turn on GitHub sign-in

- GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App, direct
  link <https://github.com/settings/applications/new>. Not **GitHub Apps**, which is
  a different product with webhooks, permissions and installation targets, and is
  the easy wrong turn. The field GitHub now calls **Redirect URI** (it used to be
  Authorization callback URL) takes
  `https://YOUR-PROJECT.supabase.co/auth/v1/callback` — the Supabase project, not
  this site. Leave wildcard matching and device flow off.
- Supabase → Authentication → Providers → GitHub → paste the client id and secret.
  That client secret is a real secret, unlike the publishable key: it belongs here
  and nowhere else, never in the repo or a GitHub Actions secret.
- Supabase → Authentication → URL Configuration. **Set Site URL** to
  `https://tiagoazeved0.github.io/character-sheet/`. It defaults to
  `http://localhost:3000`, and Supabase falls back to it whenever a redirect is not
  allowlisted, so a GitHub login that succeeds and then dead-ends on an unreachable
  port is always this setting. Then add both redirect URLs:
  `https://tiagoazeved0.github.io/character-sheet/**` and
  `http://localhost:5173/character-sheet/**`. Keep the `**` — `signIn()` passes
  `window.location.href`, so a bare path stops matching the moment the URL carries a
  query or a hash. localhost is treated leniently and will appear to work without
  any of this, which is how the gap stays hidden until a second device tries.

## 4. Give the app the keys

Local: copy `.env.example` to `.env.local` and fill it in.

Deployed: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository
secrets, and pass them to the build step in `.github/workflows/deploy.yml`.
They are compiled into the bundle, so a rebuild is needed after any change.

## 5. Keep the project awake

Add the same two values as repository secrets named `SUPABASE_URL` and
`SUPABASE_ANON_KEY`. `.github/workflows/keepalive.yml` pings the `heartbeat` table
twice a week; free projects pause after about seven days of inactivity, and a
fortnightly campaign would hit that every time.

## 6. Close the door, in that order

Sign in once on **every** device first, then Authentication → Sign In / Providers →
turn new signups off. The publishable key is public by design, so without this
anyone who views source can create an account on the project. Row-level security
means they would see only their own empty rows, so the exposure is quota rather than
data — but there is no reason to leave it open. Do it in the wrong order and the
next device cannot complete its first sign-in: the OAuth flow fails with "Signups
not allowed for this instance", which reads like a broken app.

## What sync does and does not do

- Writes land in IndexedDB first, always. The push is debounced ~1.5s and is
  allowed to fail; the queue is durable, so closing the tab mid-push loses nothing.
- Characters use optimistic concurrency on `rev`. If both devices edited the same
  character, you get a modal and pick a side. **Nothing is ever merged**, because a
  merged sheet is one neither device had.
- The change journal and rules packs are append-only and immutable, so they just push.
- Dice log, advantage mode, cover and combat state never sync. They are per-encounter.
- The free tier has no backups. Export to JSON before anything you would hate to redo.
