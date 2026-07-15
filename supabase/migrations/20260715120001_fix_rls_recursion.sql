-- Fix "infinite recursion detected in policy for relation ..." on the live DB.
--
-- Root cause: several RLS policies (most importantly the SELECT policy on
-- public.users) evaluate their USING clause by sub-querying a *protected* table
-- inline. On public.users the role lookup done on every page
-- (components/site-chrome.tsx -> select role from users) forces Postgres to
-- evaluate the users SELECT policy, which in turn reads users again -> loop.
--
-- Fix (per Supabase's recommended pattern): every cross-/self-table check a
-- policy needs is moved into a SECURITY DEFINER helper. A SECURITY DEFINER
-- function runs as its owner (the table owner / postgres), so the reads it does
-- are NOT subject to RLS and cannot recurse. Policies then only ever reference
-- auth.uid() and these helpers -- never a protected table inline.
--
-- Idempotent: safe to run repeatedly and safe to paste into the Supabase SQL
-- editor to reconcile a live DB whose policies predate this change.

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (RLS-safe reads)
-- ---------------------------------------------------------------------------

-- Current user supervises the given learner (identified by the learner's users.id).
create or replace function public.supervises_learner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.supervisor_assignments sa
    join public.enrolments e on e.id = sa.learner_enrolment_id
    where sa.supervisor_user_id = auth.uid()
      and e.user_id = p_user_id
  );
$$;

-- Current user and target user are linked as supervisor<->learner in EITHER
-- direction (so a learner can see their supervisor's row and vice versa).
create or replace function public.shares_supervision_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.supervises_learner(p_user_id)              -- I supervise them
    or exists (                                       -- they supervise me
      select 1
      from public.supervisor_assignments sa
      join public.enrolments e on e.id = sa.learner_enrolment_id
      where sa.supervisor_user_id = p_user_id
        and e.user_id = auth.uid()
    );
$$;

-- Current user supervises at least one learner enrolled in the given course.
create or replace function public.supervises_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.supervisor_assignments sa
    join public.enrolments e on e.id = sa.learner_enrolment_id
    where sa.supervisor_user_id = auth.uid()
      and e.course_id = p_course_id
  );
$$;

-- Course id for a module / EPA definition (read without triggering their RLS).
create or replace function public.module_course_id(p_module_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select course_id from public.modules where id = p_module_id;
$$;

create or replace function public.epa_course_id(p_epa_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select course_id from public.epa_definitions where id = p_epa_id;
$$;

-- Current user is enrolled in / supervises the given cohort.
create or replace function public.in_cohort(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.enrolments e
    where e.cohort_id = p_cohort_id and e.user_id = auth.uid()
  );
$$;

create or replace function public.supervises_cohort(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.supervisor_assignments sa
    where sa.cohort_id = p_cohort_id and sa.supervisor_user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- users  (THE recursion fix: policy body now references no protected table)
-- ---------------------------------------------------------------------------
drop policy if exists users_select_self_or_related on public.users;
create policy users_select_self_or_related on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.shares_supervision_with(id)
  );

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_user_role()   -- SECURITY DEFINER, no inline users read
  );

-- ---------------------------------------------------------------------------
-- professional_profiles
-- ---------------------------------------------------------------------------
drop policy if exists professional_profiles_select on public.professional_profiles;
create policy professional_profiles_select on public.professional_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.supervises_learner(user_id)
  );

-- ---------------------------------------------------------------------------
-- modules / lessons
-- ---------------------------------------------------------------------------
drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules
  for select to authenticated
  using (
    public.is_enrolled_in_course(course_id)
    or public.administers_course(course_id)
    or public.supervises_course(course_id)
  );

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select to authenticated
  using (
    public.is_enrolled_in_course(public.module_course_id(module_id))
    or public.administers_course(public.module_course_id(module_id))
    or public.supervises_course(public.module_course_id(module_id))
  );

drop policy if exists lessons_admin_write on public.lessons;
create policy lessons_admin_write on public.lessons
  for all to authenticated
  using (public.administers_course(public.module_course_id(module_id)))
  with check (public.administers_course(public.module_course_id(module_id)));

-- ---------------------------------------------------------------------------
-- epa_definitions / epa_targets
-- ---------------------------------------------------------------------------
drop policy if exists epa_definitions_select on public.epa_definitions;
create policy epa_definitions_select on public.epa_definitions
  for select to authenticated
  using (
    public.is_enrolled_in_course(course_id)
    or public.administers_course(course_id)
    or public.supervises_course(course_id)
  );

drop policy if exists epa_targets_select on public.epa_targets;
create policy epa_targets_select on public.epa_targets
  for select to authenticated
  using (
    public.is_enrolled_in_course(public.epa_course_id(epa_id))
    or public.administers_course(public.epa_course_id(epa_id))
    or public.supervises_course(public.epa_course_id(epa_id))
  );

drop policy if exists epa_targets_admin_write on public.epa_targets;
create policy epa_targets_admin_write on public.epa_targets
  for all to authenticated
  using (public.administers_course(public.epa_course_id(epa_id)))
  with check (public.administers_course(public.epa_course_id(epa_id)));

-- ---------------------------------------------------------------------------
-- cohorts
-- ---------------------------------------------------------------------------
drop policy if exists cohorts_select on public.cohorts;
create policy cohorts_select on public.cohorts
  for select to authenticated
  using (
    public.administers_course(course_id)
    or public.in_cohort(id)
    or public.supervises_cohort(id)
  );
