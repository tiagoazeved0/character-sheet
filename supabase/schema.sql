-- Phase 4 schema. Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: every statement is guarded.
--
-- Documents are stored as jsonb on purpose. Schema migrations then live in
-- TypeScript next to the Zod schema (src/rules/migrations.ts) instead of being
-- split across Postgres migrations that would have to be kept in lockstep.

-- id is text, not uuid: character ids are generated on the client and are not all
-- uuids (the bundled seed is 'seed-vessa', and uid() falls back to a base-36
-- string where crypto.randomUUID is unavailable).
create table if not exists characters (
  id         text primary key,
  owner      uuid not null references auth.users(id) default auth.uid(),
  rev        integer not null default 1,
  updated_at timestamptz not null default now(),
  data       jsonb not null
);

create table if not exists character_changes (
  id           text primary key,
  owner        uuid not null default auth.uid(),
  character_id text not null references characters(id) on delete cascade,
  at           timestamptz not null default now(),
  batch_id     text,
  channel      text not null check (channel in ('edit','play')),
  data         jsonb not null
);

create table if not exists rules_packs (
  owner   uuid not null default auth.uid(),
  pack_id text not null,
  version text not null,
  data    jsonb not null,
  primary key (owner, pack_id, version)
);

-- The keepalive workflow pings this twice a week. Free projects pause after about
-- seven days without database activity, and a fortnightly campaign would hit that.
create table if not exists heartbeat (id integer primary key, beat_at timestamptz not null default now());
insert into heartbeat (id) values (1) on conflict (id) do nothing;

create index if not exists character_changes_by_character on character_changes (character_id, at desc);

alter table characters        enable row level security;
alter table character_changes enable row level security;
alter table rules_packs       enable row level security;
alter table heartbeat         enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'characters' and policyname = 'owner_all') then
    create policy owner_all on characters
      for all using (owner = auth.uid()) with check (owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'character_changes' and policyname = 'owner_all') then
    create policy owner_all on character_changes
      for all using (owner = auth.uid()) with check (owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'rules_packs' and policyname = 'owner_all') then
    create policy owner_all on rules_packs
      for all using (owner = auth.uid()) with check (owner = auth.uid());
  end if;
  -- The keepalive ping is unauthenticated, so it only ever needs to read one row.
  if not exists (select 1 from pg_policies where tablename = 'heartbeat' and policyname = 'anon_read') then
    create policy anon_read on heartbeat for select using (true);
  end if;
end $$;
