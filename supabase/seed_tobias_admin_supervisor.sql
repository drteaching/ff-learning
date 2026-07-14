-- Promote A/Prof Tobias Angstmann to admin + supervisor, enrol in the rotation.
-- Run once in Supabase → SQL Editor (account must already exist in Auth).

do $$
declare
  v_user_id uuid;
  v_course_id uuid;
  v_track_id uuid;
  v_enrolment_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = 'tobyangstmann@gmail.com';

  if v_user_id is null then
    raise exception 'No auth user found for tobyangstmann@gmail.com — sign up first.';
  end if;

  insert into public.users (id, email, display_name, role)
  values (v_user_id, 'tobyangstmann@gmail.com', 'A/Prof Tobias Angstmann', 'admin')
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = 'A/Prof Tobias Angstmann',
    role = 'admin';

  -- Role column is a single enum; admin already covers admin console.
  -- Supervisor capability for sign-off: keep role as admin (sign-off RPC
  -- allows admin + supervisor). If you later split accounts, use 'supervisor'.

  select id into v_course_id
  from public.courses
  where slug = 'clinical-rotation-reproductive-medicine';

  if v_course_id is null then
    raise exception 'Course not found — run the schema + course seed migrations first.';
  end if;

  select id into v_track_id
  from public.audience_tracks
  where course_id = v_course_id and key = 'new_doctor';

  if v_track_id is null then
    raise exception 'Audience track new_doctor not found — run the EPA/track seed.';
  end if;

  insert into public.enrolments (user_id, course_id, track_id, status)
  values (v_user_id, v_course_id, v_track_id, 'active')
  on conflict (user_id, course_id) do update
  set
    status = 'active',
    track_id = excluded.track_id
  returning id into v_enrolment_id;

  -- Self-assign as supervisor of your own enrolment (handy for end-to-end sign-off tests).
  insert into public.supervisor_assignments (supervisor_user_id, learner_enrolment_id)
  values (v_user_id, v_enrolment_id)
  on conflict do nothing;

  raise notice 'Done: % is admin, enrolled (new_doctor), and self-assigned as supervisor.',
    'tobyangstmann@gmail.com';
end $$;
