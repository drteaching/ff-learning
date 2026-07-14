-- Idempotent quiz seeding: stable key from questions.json `id`
alter table public.quiz_questions
  add column if not exists source_id integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quiz_questions_course_source_id_key'
  ) then
    alter table public.quiz_questions
      add constraint quiz_questions_course_source_id_key
      unique (course_id, source_id);
  end if;
end $$;

comment on column public.quiz_questions.source_id is
  'Stable id from content/questions.json; used for upsert seeding';
