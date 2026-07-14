-- Bootstrap: promote an existing account to admin and seed a test enrolment code.
-- Replace YOUR_EMAIL before running in the Supabase SQL Editor.

-- 1) Ensure public.users row exists, set role = admin
insert into public.users (id, email, display_name, role)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'display_name', 'A/Prof Tobias Angstmann'),
  'admin'
from auth.users
where email = 'YOUR_EMAIL'
on conflict (id) do update
set
  role = 'admin',
  display_name = coalesce(excluded.display_name, public.users.display_name);

-- 2) Test code: ROTATION-2026 · medical student track · 50 uses · no expiry
insert into public.enrolment_codes (course_id, code, track_id, max_uses, uses, is_active)
select c.id, 'ROTATION-2026', t.id, 50, 0, true
from public.courses c
join public.audience_tracks t on t.course_id = c.id and t.key = 'student'
where c.slug = 'clinical-rotation-reproductive-medicine'
on conflict (course_id, code) do update
set
  track_id = excluded.track_id,
  max_uses = excluded.max_uses,
  is_active = true;
