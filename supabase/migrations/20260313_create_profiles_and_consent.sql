-- M1: profiles & consent_records tables with RLS
-- Run this in Supabase SQL Editor or apply via supabase db push

-- ═══════════════════════════════════════════════════════════════
-- 1. PROFILES
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  region        text not null default '',        -- country name e.g. 'Singapore'
  city          text not null default '',
  email         text,
  wearable_owned boolean not null default false,  -- toggle only, no integration in MVP
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Users can read only their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Users can insert their own profile (on sign-up)
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- Users can update only their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════
-- 2. CONSENT_RECORDS  (append-only log per PDPA requirement)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.consent_records (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  scope         text not null,  -- e.g. 'gut_tracking', 'behaviour_tracking'
  granted       boolean not null,
  recorded_at   timestamptz not null default now()
);

-- Enable RLS
alter table public.consent_records enable row level security;

-- Users can read only their own consent records
create policy "Users can read own consent"
  on public.consent_records for select
  using (auth.uid() = user_id);

-- Users can insert their own consent records (append-only)
create policy "Users can insert own consent"
  on public.consent_records for insert
  with check (auth.uid() = user_id);

-- No UPDATE or DELETE policies — consent log is immutable per PDPA.


-- ═══════════════════════════════════════════════════════════════
-- 3. Helper: auto-create a profile row on user sign-up
-- ═══════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- Trigger: fires after a new row in auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
