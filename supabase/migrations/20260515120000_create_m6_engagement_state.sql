-- M6: Engagement State
-- Caches computed engagement metrics per user, updated on every log save.

create table engagement_state (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  current_streak_days int not null default 0,
  longest_streak_days int not null default 0,
  dqs_7day_avg        double precision,
  total_logs          int not null default 0,
  active_title        text,
  unlocked_titles     text[] not null default '{}',
  updated_at          timestamptz not null default now()
);

alter table engagement_state enable row level security;

create policy "users manage own engagement_state"
  on engagement_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
