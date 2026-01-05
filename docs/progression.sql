-- Worlds + progress tables for Evalarena progression.

create table if not exists worlds (
  id text primary key,
  title text not null,
  description text,
  order_index integer not null default 0,
  required_count integer not null default 2
);

alter table challenges
  add column if not exists world_id text references worlds (id),
  add column if not exists world_order integer,
  add column if not exists primer_text text;

create table if not exists profiles (
  id uuid primary key,
  display_name text not null,
  created_at timestamp with time zone default now()
);

create table if not exists progress (
  profile_id uuid not null references profiles (id),
  challenge_id text not null references challenges (id),
  solved boolean not null default false,
  completed boolean not null default false,
  dev_ready boolean not null default false,
  updated_at timestamp with time zone default now(),
  primary key (profile_id, challenge_id)
);

-- Optional: allow anon read/write for MVP (no auth).
alter table profiles enable row level security;
alter table progress enable row level security;

create policy "profiles: public read"
  on profiles for select
  using (true);

create policy "profiles: public write"
  on profiles for insert
  with check (true);

create policy "profiles: public update"
  on profiles for update
  using (true);

create policy "progress: public read"
  on progress for select
  using (true);

create policy "progress: public write"
  on progress for insert
  with check (true);

create policy "progress: public update"
  on progress for update
  using (true);
