-- Seed: Clinical Rotation in Reproductive Medicine + 3 tracks + 8 EPAs + 24 targets
-- Idempotent on course slug.

insert into public.courses (slug, title, description, published, created_by)
values (
  'clinical-rotation-reproductive-medicine',
  'Clinical Rotation in Reproductive Medicine',
  'Six-week clinical immersion in reproductive medicine: modules, quizzes, and an EPA-based logbook with authenticated supervisor sign-off. For medical students, new-start doctors, and nurses.',
  true,
  null
)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  published = excluded.published;

-- Audience tracks
insert into public.audience_tracks (course_id, key, label)
select c.id, v.key, v.label
from public.courses c
cross join (
  values
    ('student'::public.audience_track_key, 'Medical student'),
    ('new_doctor'::public.audience_track_key, 'New-start doctor'),
    ('nurse'::public.audience_track_key, 'Nurse')
) as v(key, label)
where c.slug = 'clinical-rotation-reproductive-medicine'
on conflict (course_id, key) do update
set label = excluded.label;

-- Eight EPA definitions (level descriptors from the rotation logbook)
with course as (
  select id from public.courses where slug = 'clinical-rotation-reproductive-medicine'
),
epas(number, title, definition, level_descriptors) as (
  values
  (
    1,
    'Reproductive & fertility history-taking',
    'Take a structured reproductive and fertility history from one or both partners — covering menstrual, obstetric, sexual, medical, surgical, lifestyle and family domains.',
    '[
      {"level":1,"name":"Observed","description":"Observed a clinician take a full reproductive history."},
      {"level":2,"name":"Assisted","description":"Took parts of the history with direct prompting."},
      {"level":3,"name":"Supervised","description":"Took a complete, structured history with a supervisor available."},
      {"level":4,"name":"Independent","description":"Took a complete history independently, appropriately tailored."}
    ]'::jsonb
  ),
  (
    2,
    'Interpreting the fertility workup',
    'Interpret a basic fertility workup (ovulation, ovarian reserve, tubal patency, semen analysis) and synthesise a differential.',
    '[
      {"level":1,"name":"Observed","description":"Observed results being interpreted."},
      {"level":2,"name":"Assisted","description":"Interpreted individual results with guidance."},
      {"level":3,"name":"Supervised","description":"Synthesised a full workup into a differential, supervised."},
      {"level":4,"name":"Independent","description":"Interpreted and synthesised independently."}
    ]'::jsonb
  ),
  (
    3,
    'Explaining a management / treatment plan',
    'Explain a proposed investigation or treatment plan (e.g. IUI, IVF, ICSI, or a complex-case strategy) to a patient in clear, accurate terms.',
    '[
      {"level":1,"name":"Observed","description":"Observed a clinician explain a plan."},
      {"level":2,"name":"Assisted","description":"Explained parts of a plan with support."},
      {"level":3,"name":"Supervised","description":"Explained a complete plan to a patient, supervised."},
      {"level":4,"name":"Independent","description":"Explained independently, checking understanding."}
    ]'::jsonb
  ),
  (
    4,
    'Follicular-tracking ultrasound',
    'Identify normal pelvic structures and track follicles on transvaginal ultrasound; handle the probe under supervision.',
    '[
      {"level":1,"name":"Observed","description":"Observed follicle-tracking scans."},
      {"level":2,"name":"Assisted","description":"Handled the probe / identified structures under direct supervision."},
      {"level":3,"name":"Supervised","description":"Performed a tracking scan with a supervisor available (stretch goal)."},
      {"level":4,"name":"Independent","description":"Not expected within this rotation."}
    ]'::jsonb
  ),
  (
    5,
    'Understanding oocyte retrieval & embryo transfer',
    'Describe the OPU and embryo-transfer procedures and the laboratory workflow, having observed them; counsel a patient on what to expect.',
    '[
      {"level":1,"name":"Observed","description":"Observed OPU and/or embryo transfer and the laboratory."},
      {"level":2,"name":"Assisted","description":"Participated in the procedural setting under supervision."},
      {"level":3,"name":"Supervised","description":"Not typically expected within this rotation."},
      {"level":4,"name":"Independent","description":"Not expected within this rotation."}
    ]'::jsonb
  ),
  (
    6,
    'Contributing to the multidisciplinary team',
    'Prepare and present a case to the multidisciplinary team and contribute to the discussion.',
    '[
      {"level":1,"name":"Observed","description":"Observed an MDT meeting."},
      {"level":2,"name":"Assisted","description":"Prepared and presented a case with support."},
      {"level":3,"name":"Supervised","description":"Presented and contributed to the management discussion, supervised."},
      {"level":4,"name":"Independent","description":"Not expected within this rotation."}
    ]'::jsonb
  ),
  (
    7,
    'Communicating prognosis & difficult news',
    'Communicate prognosis or unwelcome news (e.g. a failed cycle, a low chance of success) using a structured approach (SPIKES), with empathy.',
    '[
      {"level":1,"name":"Observed","description":"Observed a difficult-news conversation."},
      {"level":2,"name":"Assisted","description":"Participated in or led part of such a conversation, supervised."},
      {"level":3,"name":"Supervised","description":"Led a prognosis conversation with a supervisor present."},
      {"level":4,"name":"Independent","description":"Not expected within this rotation."}
    ]'::jsonb
  ),
  (
    8,
    'Recognising & responding to psychosocial distress',
    'Recognise signs of psychosocial distress (grief, anxiety, reproductive coercion) and respond appropriately, including knowing the referral pathways.',
    '[
      {"level":1,"name":"Observed","description":"Observed recognition of and response to distress."},
      {"level":2,"name":"Assisted","description":"Identified distress and responded appropriately, with support."},
      {"level":3,"name":"Supervised","description":"Recognised and managed distress including referral, supervised."},
      {"level":4,"name":"Independent","description":"Not expected within this rotation."}
    ]'::jsonb
  )
)
insert into public.epa_definitions (course_id, number, title, definition, level_descriptors)
select course.id, epas.number, epas.title, epas.definition, epas.level_descriptors
from course
cross join epas
on conflict (course_id, number) do update
set
  title = excluded.title,
  definition = excluded.definition,
  level_descriptors = excluded.level_descriptors;

-- 24 role-specific targets (section 2 matrix): student / new_doctor / nurse
with course as (
  select id from public.courses where slug = 'clinical-rotation-reproductive-medicine'
),
tracks as (
  select at.key, at.id as track_id
  from public.audience_tracks at
  join course c on c.id = at.course_id
),
epas as (
  select d.number, d.id as epa_id
  from public.epa_definitions d
  join course c on c.id = d.course_id
),
matrix(epa_number, track_key, target_level) as (
  values
    (1, 'student'::public.audience_track_key, 3),
    (1, 'new_doctor'::public.audience_track_key, 4),
    (1, 'nurse'::public.audience_track_key, 3),
    (2, 'student'::public.audience_track_key, 3),
    (2, 'new_doctor'::public.audience_track_key, 3),
    (2, 'nurse'::public.audience_track_key, 2),
    (3, 'student'::public.audience_track_key, 3),
    (3, 'new_doctor'::public.audience_track_key, 3),
    (3, 'nurse'::public.audience_track_key, 3),
    (4, 'student'::public.audience_track_key, 2),
    (4, 'new_doctor'::public.audience_track_key, 2),
    (4, 'nurse'::public.audience_track_key, 1),
    (5, 'student'::public.audience_track_key, 1),
    (5, 'new_doctor'::public.audience_track_key, 2),
    (5, 'nurse'::public.audience_track_key, 2),
    (6, 'student'::public.audience_track_key, 2),
    (6, 'new_doctor'::public.audience_track_key, 3),
    (6, 'nurse'::public.audience_track_key, 2),
    (7, 'student'::public.audience_track_key, 2),
    (7, 'new_doctor'::public.audience_track_key, 3),
    (7, 'nurse'::public.audience_track_key, 2),
    (8, 'student'::public.audience_track_key, 2),
    (8, 'new_doctor'::public.audience_track_key, 3),
    (8, 'nurse'::public.audience_track_key, 3)
)
insert into public.epa_targets (epa_id, track_id, target_level)
select e.epa_id, t.track_id, m.target_level
from matrix m
join epas e on e.number = m.epa_number
join tracks t on t.key = m.track_key
on conflict (epa_id, track_id) do update
set target_level = excluded.target_level;
