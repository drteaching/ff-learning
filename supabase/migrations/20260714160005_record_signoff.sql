-- Atomic immutable sign-off + audit_log row (accreditation trail)

create or replace function public.record_signoff(
  p_enrolment_id uuid,
  p_epa_id uuid,
  p_level integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_signoff_id uuid;
  v_course_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;

  if p_level is null or p_level < 1 or p_level > 4 then
    return jsonb_build_object('ok', false, 'error', 'Sign-off level must be 1–4.');
  end if;

  select role into v_role from public.users where id = v_uid;
  if v_role is null or v_role not in ('supervisor', 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Only supervisors or admins can record sign-offs.');
  end if;

  if not public.supervises_enrolment(p_enrolment_id) then
    return jsonb_build_object('ok', false, 'error', 'You are not assigned to this learner.');
  end if;

  select e.course_id into v_course_id
  from public.enrolments e
  where e.id = p_enrolment_id;

  if v_course_id is null then
    return jsonb_build_object('ok', false, 'error', 'Enrolment not found.');
  end if;

  if not exists (
    select 1 from public.epa_definitions d
    where d.id = p_epa_id and d.course_id = v_course_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'EPA does not belong to this course.');
  end if;

  insert into public.signoffs (
    enrolment_id, epa_id, supervisor_user_id, level, note
  ) values (
    p_enrolment_id, p_epa_id, v_uid, p_level, nullif(trim(p_note), '')
  )
  returning id into v_signoff_id;

  insert into public.audit_log (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    v_uid,
    'signoff.create',
    'signoff',
    v_signoff_id,
    jsonb_build_object(
      'enrolment_id', p_enrolment_id,
      'epa_id', p_epa_id,
      'level', p_level,
      'note_present', p_note is not null and length(trim(p_note)) > 0
    )
  );

  return jsonb_build_object(
    'ok', true,
    'signoff_id', v_signoff_id,
    'signed_at', now()
  );
end;
$$;

revoke all on function public.record_signoff(uuid, uuid, integer, text) from public;
grant execute on function public.record_signoff(uuid, uuid, integer, text) to authenticated;
