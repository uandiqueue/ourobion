-- Backfill legacy auth users whose profile trigger did not create a row.
-- Existing profile rows are deliberately untouched.
insert into public.profiles (user_id, email)
select users.id, users.email
from auth.users as users
where not exists (
  select 1
  from public.profiles as profiles
  where profiles.user_id = users.id
)
on conflict (user_id) do nothing;
