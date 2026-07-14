-- Atomic enrolment-code redeem + tighten RLS (codes not listable by learners)

-- Learners must not dump active codes; redeem goes through this RPC only.
drop policy if exists enrolment_codes_select on public.enrolment_codes;
create policy enrolment_codes_select on public.enrolment_codes
  for select to authenticated
  using (public.administers_course(course_id));

-- Direct self-enrol without a code is closed; redeem_enrolment_code is the gate.
drop policy if exists enrolments_insert_self on public.enrolments;

create policy enrolments_admin_insert on public.enrolments
  for insert to authenticated
  with check (public.administers_course(course_id));

create or replace function public.redeem_enrolment_code(
  p_course_id uuid,
  p_code text,
  p_track_key public.audience_track_key default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_row public.enrolment_codes%rowtype;
  v_track_id uuid;
  v_enrolment_id uuid;
  v_existing public.enrolments%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in to enrol.');
  end if;

  if not exists (select 1 from public.users where id = v_uid) then
    insert into public.users (id, email, display_name, role)
    select id, email, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)), 'learner'
    from auth.users
    where id = v_uid
    on conflict (id) do nothing;
  end if;

  v_code := upper(trim(p_code));
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'Enter an enrolment code.');
  end if;

  select * into v_row
  from public.enrolment_codes
  where course_id = p_course_id
    and upper(code) = v_code
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'That code is not valid for this course.');
  end if;

  if not v_row.is_active then
    return jsonb_build_object('ok', false, 'error', 'That code has been deactivated.');
  end if;

  if v_row.expires_at is not null and v_row.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'That code has expired.');
  end if;

  if v_row.max_uses is not null and v_row.uses >= v_row.max_uses then
    return jsonb_build_object('ok', false, 'error', 'That code has no uses remaining.');
  end if;

  if v_row.track_id is not null then
    v_track_id := v_row.track_id;
  else
    if p_track_key is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'This code needs an audience track. Choose student, new-start doctor, or nurse.'
      );
    end if;
    select id into v_track_id
    from public.audience_tracks
    where course_id = p_course_id and key = p_track_key;
    if v_track_id is null then
      return jsonb_build_object('ok', false, 'error', 'Unknown audience track.');
    end if;
  end if;

  select * into v_existing
  from public.enrolments
  where user_id = v_uid and course_id = p_course_id;

  if found and v_existing.status = 'active' then
    return jsonb_build_object('ok', false, 'error', 'You are already enrolled in this course.');
  end if;

  if found then
    update public.enrolments
    set
      status = 'active',
      track_id = v_track_id,
      enrolment_code_id = v_row.id,
      started_at = now(),
      completed_at = null
    where id = v_existing.id
    returning id into v_enrolment_id;
  else
    insert into public.enrolments (
      user_id, course_id, track_id, status, enrolment_code_id
    ) values (
      v_uid, p_course_id, v_track_id, 'active', v_row.id
    )
    returning id into v_enrolment_id;
  end if;

  update public.enrolment_codes
  set uses = uses + 1
  where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'enrolment_id', v_enrolment_id,
    'track_id', v_track_id
  );
end;
$$;

revoke all on function public.redeem_enrolment_code(uuid, text, public.audience_track_key) from public;
grant execute on function public.redeem_enrolment_code(uuid, text, public.audience_track_key) to authenticated;
