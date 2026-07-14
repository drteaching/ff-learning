-- Phase 0 schema: identity, catalogue, enrolment, EPA logbook, compliance
-- RLS: learners → own rows; supervisors → assigned learners; admins → own courses

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('learner', 'supervisor', 'admin');
create type public.profession as enum ('student', 'doctor', 'nurse');
create type public.audience_track_key as enum ('student', 'new_doctor', 'nurse');
create type public.enrolment_status as enum ('active', 'completed', 'withdrawn');
create type public.reflection_kind as enum ('weekly', 'capstone');

-- ---------------------------------------------------------------------------
-- Identity & access
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  role public.user_role not null default 'learner',
  created_at timestamptz not null default now()
);

create table public.professional_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  profession public.profession not null,
  ahpra_or_student_id text,
  verified boolean not null default false,
  verified_by uuid references public.users (id),
  verified_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Catalogue & content
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  published boolean not null default false,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

create table public.audience_tracks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  key public.audience_track_key not null,
  label text not null,
  unique (course_id, key)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  ordinal integer not null,
  title text not null,
  summary text,
  unique (course_id, ordinal)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  ordinal integer not null,
  title text not null,
  body_html text not null default '',
  unique (module_id, ordinal)
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  stem text not null,
  options jsonb not null,
  correct_index integer not null,
  rationale text,
  audience_tags text[] not null default '{}',
  constraint quiz_questions_correct_index_check check (correct_index >= 0)
);

-- ---------------------------------------------------------------------------
-- Enrolment & access codes
-- ---------------------------------------------------------------------------
create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  start_date date,
  end_date date
);

create table public.enrolment_codes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  code text not null,
  track_id uuid references public.audience_tracks (id) on delete set null,
  max_uses integer,
  uses integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  unique (course_id, code),
  constraint enrolment_codes_uses_nonneg check (uses >= 0),
  constraint enrolment_codes_max_uses_pos check (max_uses is null or max_uses > 0)
);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  track_id uuid not null references public.audience_tracks (id),
  cohort_id uuid references public.cohorts (id) on delete set null,
  status public.enrolment_status not null default 'active',
  progress numeric(5,2) not null default 0,
  enrolment_code_id uuid references public.enrolment_codes (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, course_id)
);

create table public.supervisor_assignments (
  supervisor_user_id uuid not null references public.users (id) on delete cascade,
  learner_enrolment_id uuid not null references public.enrolments (id) on delete cascade,
  cohort_id uuid references public.cohorts (id) on delete set null,
  primary key (supervisor_user_id, learner_enrolment_id)
);

-- ---------------------------------------------------------------------------
-- EPA logbook
-- ---------------------------------------------------------------------------
create table public.epa_definitions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  number integer not null,
  title text not null,
  definition text not null,
  level_descriptors jsonb not null,
  unique (course_id, number),
  constraint epa_definitions_number_check check (number between 1 and 99)
);

create table public.epa_targets (
  id uuid primary key default gen_random_uuid(),
  epa_id uuid not null references public.epa_definitions (id) on delete cascade,
  track_id uuid not null references public.audience_tracks (id) on delete cascade,
  target_level integer not null,
  unique (epa_id, track_id),
  constraint epa_targets_level_check check (target_level between 1 and 4)
);

create table public.logbook_entries (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.enrolments (id) on delete cascade,
  epa_id uuid not null references public.epa_definitions (id) on delete restrict,
  entry_date date not null,
  setting text not null,
  description text not null,
  self_level integer not null,
  created_at timestamptz not null default now(),
  constraint logbook_entries_self_level_check check (self_level between 1 and 4)
);

create table public.signoffs (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.enrolments (id) on delete cascade,
  epa_id uuid not null references public.epa_definitions (id) on delete restrict,
  supervisor_user_id uuid not null references public.users (id) on delete restrict,
  level integer not null,
  note text,
  signed_at timestamptz not null default now(),
  constraint signoffs_level_check check (level between 1 and 4)
);

create table public.reflections (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.enrolments (id) on delete cascade,
  kind public.reflection_kind not null,
  week_no integer,
  body text not null,
  submitted_at timestamptz,
  constraint reflections_week_check check (
    (kind = 'weekly' and week_no is not null and week_no between 1 and 52)
    or (kind = 'capstone' and week_no is null)
  )
);

-- ---------------------------------------------------------------------------
-- Admin & compliance
-- ---------------------------------------------------------------------------
create table public.media_register (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  asset_key text not null,
  title text,
  credit text,
  licence text,
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique (course_id, asset_key)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Immutability: sign-offs and logbook entries are append-only
-- ---------------------------------------------------------------------------
create or replace function public.deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% rows are immutable (append-only)', tg_table_name;
end;
$$;

create trigger logbook_entries_no_update
  before update on public.logbook_entries
  for each row execute function public.deny_mutation();

create trigger logbook_entries_no_delete
  before delete on public.logbook_entries
  for each row execute function public.deny_mutation();

create trigger signoffs_no_update
  before update on public.signoffs
  for each row execute function public.deny_mutation();

create trigger signoffs_no_delete
  before delete on public.signoffs
  for each row execute function public.deny_mutation();

create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function public.deny_mutation();

create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.deny_mutation();

-- ---------------------------------------------------------------------------
-- Auth → profile row on sign-up (default role: learner)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'learner'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.administers_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.courses c on c.id = p_course_id
    where u.id = auth.uid()
      and u.role = 'admin'
      and (c.created_by is null or c.created_by = auth.uid())
  );
$$;

create or replace function public.is_enrolled_in_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrolments e
    where e.user_id = auth.uid()
      and e.course_id = p_course_id
      and e.status = 'active'
  );
$$;

create or replace function public.owns_enrolment(p_enrolment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrolments e
    where e.id = p_enrolment_id
      and e.user_id = auth.uid()
  );
$$;

create or replace function public.supervises_enrolment(p_enrolment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.supervisor_assignments sa
    where sa.learner_enrolment_id = p_enrolment_id
      and sa.supervisor_user_id = auth.uid()
  );
$$;

create or replace function public.enrolment_course_id(p_enrolment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select course_id from public.enrolments where id = p_enrolment_id;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.courses enable row level security;
alter table public.audience_tracks enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.cohorts enable row level security;
alter table public.enrolment_codes enable row level security;
alter table public.enrolments enable row level security;
alter table public.supervisor_assignments enable row level security;
alter table public.epa_definitions enable row level security;
alter table public.epa_targets enable row level security;
alter table public.logbook_entries enable row level security;
alter table public.signoffs enable row level security;
alter table public.reflections enable row level security;
alter table public.media_register enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy users_select_self_or_related on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.supervisor_assignments sa
      join public.enrolments e on e.id = sa.learner_enrolment_id
      where sa.supervisor_user_id = auth.uid()
        and e.user_id = users.id
    )
    or exists (
      select 1
      from public.supervisor_assignments sa
      where sa.learner_enrolment_id in (
        select id from public.enrolments where user_id = auth.uid()
      )
      and sa.supervisor_user_id = users.id
    )
  );

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.users where id = auth.uid())
  );

create policy users_admin_all on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- professional_profiles
-- ---------------------------------------------------------------------------
create policy professional_profiles_select on public.professional_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.supervisor_assignments sa
      join public.enrolments e on e.id = sa.learner_enrolment_id
      where sa.supervisor_user_id = auth.uid()
        and e.user_id = professional_profiles.user_id
    )
  );

create policy professional_profiles_insert_self on public.professional_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy professional_profiles_update_self on public.professional_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and verified = (select verified from public.professional_profiles where user_id = auth.uid())
  );

create policy professional_profiles_admin_all on public.professional_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create policy courses_select_published_or_admin on public.courses
  for select to anon, authenticated
  using (
    published = true
    or (auth.uid() is not null and public.administers_course(id))
  );

create policy courses_admin_insert on public.courses
  for insert to authenticated
  with check (public.is_admin() and (created_by is null or created_by = auth.uid()));

create policy courses_admin_update on public.courses
  for update to authenticated
  using (public.administers_course(id))
  with check (public.administers_course(id));

create policy courses_admin_delete on public.courses
  for delete to authenticated
  using (public.administers_course(id));

-- ---------------------------------------------------------------------------
-- audience_tracks
-- ---------------------------------------------------------------------------
create policy audience_tracks_select on public.audience_tracks
  for select to anon, authenticated
  using (
    exists (select 1 from public.courses c where c.id = course_id and c.published = true)
    or public.administers_course(course_id)
  );

create policy audience_tracks_admin_write on public.audience_tracks
  for all to authenticated
  using (public.administers_course(course_id))
  with check (public.administers_course(course_id));

-- ---------------------------------------------------------------------------
-- modules / lessons / quiz_questions (content gated by enrolment)
-- ---------------------------------------------------------------------------
create policy modules_select on public.modules
  for select to authenticated
  using (
    public.is_enrolled_in_course(course_id)
    or public.administers_course(course_id)
    or exists (
      select 1
      from public.supervisor_assignments sa
      join public.enrolments e on e.id = sa.learner_enrolment_id
      where sa.supervisor_user_id = auth.uid()
        and e.course_id = modules.course_id
    )
  );

create policy modules_admin_write on public.modules
  for all to authenticated
  using (public.administers_course(course_id))
  with check (public.administers_course(course_id));

create policy lessons_select on public.lessons
  for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      where m.id = module_id
        and (
          public.is_enrolled_in_course(m.course_id)
          or public.administers_course(m.course_id)
          or exists (
            select 1
            from public.supervisor_assignments sa
            join public.enrolments e on e.id = sa.learner_enrolment_id
            where sa.supervisor_user_id = auth.uid()
              and e.course_id = m.course_id
          )
        )
    )
  );

create policy lessons_admin_write on public.lessons
  for all to authenticated
  using (
    exists (
      select 1 from public.modules m
      where m.id = module_id and public.administers_course(m.course_id)
    )
  )
  with check (
    exists (
      select 1 from public.modules m
      where m.id = module_id and public.administers_course(m.course_id)
    )
  );

create policy quiz_questions_select on public.quiz_questions
  for select to authenticated
  using (
    public.is_enrolled_in_course(course_id)
    or public.administers_course(course_id)
  );

create policy quiz_questions_admin_write on public.quiz_questions
  for all to authenticated
  using (public.administers_course(course_id))
  with check (public.administers_course(course_id));

-- ---------------------------------------------------------------------------
-- cohorts
-- ---------------------------------------------------------------------------
create policy cohorts_select on public.cohorts
  for select to authenticated
  using (
    public.administers_course(course_id)
    or exists (
      select 1 from public.enrolments e
      where e.cohort_id = cohorts.id and e.user_id = auth.uid()
    )
    or exists (
      select 1 from public.supervisor_assignments sa
      where sa.cohort_id = cohorts.id and sa.supervisor_user_id = auth.uid()
    )
  );

create policy cohorts_admin_write on public.cohorts
  for all to authenticated
  using (public.administers_course(course_id))
  with check (public.administers_course(course_id));

-- ---------------------------------------------------------------------------
-- enrolment_codes (admins manage; learners may lookup active codes for redeem)
-- ---------------------------------------------------------------------------
create policy enrolment_codes_select on public.enrolment_codes
  for select to authenticated
  using (
    public.administers_course(course_id)
    or (is_active = true and (expires_at is null or expires_at > now()))
  );

create policy enrolment_codes_admin_write on public.enrolment_codes
  for all to authenticated
  using (public.administers_course(course_id))
  with check (public.administers_course(course_id));

-- ---------------------------------------------------------------------------
-- enrolments
-- ---------------------------------------------------------------------------
create policy enrolments_select on public.enrolments
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.supervises_enrolment(id)
    or public.administers_course(course_id)
  );

create policy enrolments_insert_self on public.enrolments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.current_user_role() = 'learner'
  );

create policy enrolments_update_self_or_admin on public.enrolments
  for update to authenticated
  using (
    user_id = auth.uid()
    or public.administers_course(course_id)
  )
  with check (
    user_id = auth.uid()
    or public.administers_course(course_id)
  );

create policy enrolments_admin_delete on public.enrolments
  for delete to authenticated
  using (public.administers_course(course_id));

-- ---------------------------------------------------------------------------
-- supervisor_assignments
-- ---------------------------------------------------------------------------
create policy supervisor_assignments_select on public.supervisor_assignments
  for select to authenticated
  using (
    supervisor_user_id = auth.uid()
    or public.owns_enrolment(learner_enrolment_id)
    or public.administers_course(public.enrolment_course_id(learner_enrolment_id))
  );

create policy supervisor_assignments_admin_write on public.supervisor_assignments
  for all to authenticated
  using (public.administers_course(public.enrolment_course_id(learner_enrolment_id)))
  with check (public.administers_course(public.enrolment_course_id(learner_enrolment_id)));

-- ---------------------------------------------------------------------------
-- epa_definitions / epa_targets
-- ---------------------------------------------------------------------------
create policy epa_definitions_select on public.epa_definitions
  for select to authenticated
  using (
    public.is_enrolled_in_course(course_id)
    or public.administers_course(course_id)
    or exists (
      select 1
      from public.supervisor_assignments sa
      join public.enrolments e on e.id = sa.learner_enrolment_id
      where sa.supervisor_user_id = auth.uid()
        and e.course_id = epa_definitions.course_id
    )
  );

create policy epa_definitions_admin_write on public.epa_definitions
  for all to authenticated
  using (public.administers_course(course_id))
  with check (public.administers_course(course_id));

create policy epa_targets_select on public.epa_targets
  for select to authenticated
  using (
    exists (
      select 1 from public.epa_definitions d
      where d.id = epa_id
        and (
          public.is_enrolled_in_course(d.course_id)
          or public.administers_course(d.course_id)
          or exists (
            select 1
            from public.supervisor_assignments sa
            join public.enrolments e on e.id = sa.learner_enrolment_id
            where sa.supervisor_user_id = auth.uid()
              and e.course_id = d.course_id
          )
        )
    )
  );

create policy epa_targets_admin_write on public.epa_targets
  for all to authenticated
  using (
    exists (
      select 1 from public.epa_definitions d
      where d.id = epa_id and public.administers_course(d.course_id)
    )
  )
  with check (
    exists (
      select 1 from public.epa_definitions d
      where d.id = epa_id and public.administers_course(d.course_id)
    )
  );

-- ---------------------------------------------------------------------------
-- logbook_entries
-- ---------------------------------------------------------------------------
create policy logbook_entries_select on public.logbook_entries
  for select to authenticated
  using (
    public.owns_enrolment(enrolment_id)
    or public.supervises_enrolment(enrolment_id)
    or public.administers_course(public.enrolment_course_id(enrolment_id))
  );

create policy logbook_entries_insert_own on public.logbook_entries
  for insert to authenticated
  with check (public.owns_enrolment(enrolment_id));

-- ---------------------------------------------------------------------------
-- signoffs (immutable; supervisors insert for assigned learners)
-- ---------------------------------------------------------------------------
create policy signoffs_select on public.signoffs
  for select to authenticated
  using (
    public.owns_enrolment(enrolment_id)
    or public.supervises_enrolment(enrolment_id)
    or supervisor_user_id = auth.uid()
    or public.administers_course(public.enrolment_course_id(enrolment_id))
  );

create policy signoffs_insert_supervisor on public.signoffs
  for insert to authenticated
  with check (
    supervisor_user_id = auth.uid()
    and public.supervises_enrolment(enrolment_id)
    and public.current_user_role() in ('supervisor', 'admin')
  );

-- ---------------------------------------------------------------------------
-- reflections
-- ---------------------------------------------------------------------------
create policy reflections_select on public.reflections
  for select to authenticated
  using (
    public.owns_enrolment(enrolment_id)
    or public.supervises_enrolment(enrolment_id)
    or public.administers_course(public.enrolment_course_id(enrolment_id))
  );

create policy reflections_insert_own on public.reflections
  for insert to authenticated
  with check (public.owns_enrolment(enrolment_id));

create policy reflections_update_own on public.reflections
  for update to authenticated
  using (public.owns_enrolment(enrolment_id))
  with check (public.owns_enrolment(enrolment_id));

create policy reflections_admin_delete on public.reflections
  for delete to authenticated
  using (public.administers_course(public.enrolment_course_id(enrolment_id)));

-- ---------------------------------------------------------------------------
-- media_register
-- ---------------------------------------------------------------------------
create policy media_register_select on public.media_register
  for select to authenticated
  using (
    public.is_enrolled_in_course(course_id)
    or public.administers_course(course_id)
  );

create policy media_register_admin_write on public.media_register
  for all to authenticated
  using (public.administers_course(course_id))
  with check (public.administers_course(course_id));

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (
    actor_user_id = auth.uid()
    or public.is_admin()
  );

create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (actor_user_id = auth.uid());
