-- U6b batch 1: five optional wellbeing metrics on the authoritative daily row.
-- metric-columns: appetite_score, anxiety_score, brain_clarity_score, focus_score, social_interaction_quality_score
--
-- These T2 values are nullable. Existing rows retain NULL and this migration deliberately does
-- not change DQS, policies, grants, triggers, defaults, or any derived projection input.

alter table public.daily_gut_rows
  add column appetite_score smallint,
  add column anxiety_score smallint,
  add column brain_clarity_score smallint,
  add column focus_score smallint,
  add column social_interaction_quality_score smallint,
  add constraint daily_gut_rows_appetite_score_range check (appetite_score between 1 and 5),
  add constraint daily_gut_rows_anxiety_score_range check (anxiety_score between 1 and 5),
  add constraint daily_gut_rows_brain_clarity_score_range check (brain_clarity_score between 1 and 5),
  add constraint daily_gut_rows_focus_score_range check (focus_score between 1 and 5),
  add constraint daily_gut_rows_social_interaction_quality_score_range check (social_interaction_quality_score between 1 and 5);

comment on column public.daily_gut_rows.appetite_score is
  'Optional self-reported appetite score (ordinal 1..5); NULL means not logged.';
comment on column public.daily_gut_rows.anxiety_score is
  'Optional self-reported feeling-anxious score (ordinal 1..5); NULL means not logged.';
comment on column public.daily_gut_rows.brain_clarity_score is
  'Optional self-reported mental-clarity score (ordinal 1..5); NULL means not logged.';
comment on column public.daily_gut_rows.focus_score is
  'Optional self-reported focus score (ordinal 1..5); NULL means not logged.';
comment on column public.daily_gut_rows.social_interaction_quality_score is
  'Optional self-reported social-interaction quality score (ordinal 1..5); NULL means not logged.';
