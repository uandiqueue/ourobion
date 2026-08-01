-- Keep the database boundary aligned with the registry-backed quick-count cap.
alter table public.daily_gut_rows
  drop constraint daily_gut_rows_outside_meals_check,
  add constraint daily_gut_rows_outside_meals_check
    check (outside_meals between 0 and 10);
