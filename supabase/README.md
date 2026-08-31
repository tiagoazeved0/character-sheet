# Turning sync on

Until these steps are done the app is local-only: no account, no network, and every
character lives in IndexedDB on one device. That is a supported state — the sync
indicator says "This device only" and nothing is broken.

The anon key is safe in a public build. It grants nothing on its own: every table
has row-level security scoped to `auth.uid()`, so a signed-in user reads and writes
only their own rows.

## 1. Create the project

Supabase dashboard → new project. Free tier is fine. Note the project URL and the
**anon** public key from Settings → API.

## 2. Create the tables

SQL Editor → New query → paste `supabase/schema.sql` → Run. It is safe to re-run.

## 3. Turn on GitHub sign-in

- GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
  Authorization callback URL: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
- Supabase → Authentication → Providers → GitHub → paste the client id and secret.
- Supabase → Authentication → URL Configuration → add both redirect URLs:
  `https://tiagoazeved0.github.io/character-sheet/` and `http://localhost:5173/character-sheet/`

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

## What sync does and does not do

- Writes land in IndexedDB first, always. The push is debounced ~1.5s and is
  allowed to fail; the queue is durable, so closing the tab mid-push loses nothing.
- Characters use optimistic concurrency on `rev`. If both devices edited the same
  character, you get a modal and pick a side. **Nothing is ever merged**, because a
  merged sheet is one neither device had.
- The change journal and rules packs are append-only and immutable, so they just push.
- Dice log, advantage mode, cover and combat state never sync. They are per-encounter.
- The free tier has no backups. Export to JSON before anything you would hate to redo.
