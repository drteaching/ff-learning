# Platform Build — Decisions Resolved, Role-Specific EPAs, Schema & Phase 0

*Companion to PLATFORM_BUILD_SPEC.md. Version 1.1 — build-ready.*

---

## 1. Resolved decisions and what they change

| Decision | Answer | Effect on the build |
|---|---|---|
| Existing site | Old Moodle, **being replaced — greenfield** | No integration layer. The new platform *is* the teaching site. §9 of the spec (integration) collapses into a Moodle **cutover** checklist. |
| Payments | **Deferred** (future: GAMSAT, USMLE prep, O&G prep) | No Stripe in MVP. Schema is payment-*ready* (enrolment + code entities exist) but payment-*free*. |
| Access at launch | **Enrolment / discount code** for students | Code-based self-enrolment is the MVP access gate — the professional-access gate and the "student discount code" are one feature. Becomes a paid coupon later. |
| EPA targets | **Role-specific** (student / new-start doctor / nurse) | Audience tracks are first-class; each EPA carries a target level per track (matrix below). |
| Course name | **Clinical Rotation in Reproductive Medicine** | Applied throughout. |

**Net effect: simpler.** Greenfield removes the hardest unknown. The build is now a clean, multi-course platform whose first course is fully specified and whose content already exists.

### Moodle cutover checklist (do before decommissioning)
- Export any existing course content worth keeping (there may be none if greenfield content-wise).
- Export the user list if you want to pre-populate or invite existing learners.
- Note any existing enrolment keys/codes you want to reuse as familiar patterns.
- Confirm no records need retaining for compliance before shutdown.

---

## 2. Role-specific EPA target matrix

The eight EPAs are the shared spine. Each carries a **target entrustment level per audience track** — the level a learner in that track should reach by the end of the rotation. Scale: **1 Observed · 2 Assisted · 3 Supervised · 4 Independent.**

| # | EPA | Medical student | New-start doctor | Nurse |
|---|---|:---:|:---:|:---:|
| 1 | Reproductive &amp; fertility history-taking | 3 Supervised | 4 Independent | 3 Supervised |
| 2 | Interpreting the fertility workup | 3 Supervised | 3 Supervised | 2 Assisted |
| 3 | Explaining a management / treatment plan | 3 Supervised | 3 Supervised | 3 Supervised |
| 4 | Follicular-tracking ultrasound | 2 Assisted | 2 Assisted | 1 Observed |
| 5 | Understanding oocyte retrieval &amp; embryo transfer | 1 Observed | 2 Assisted | 2 Assisted |
| 6 | Contributing to the multidisciplinary team | 2 Assisted | 3 Supervised | 2 Assisted |
| 7 | Communicating prognosis &amp; difficult news | 2 Assisted | 3 Supervised | 2 Assisted |
| 8 | Recognising &amp; responding to psychosocial distress | 2 Assisted | 3 Supervised | 3 Supervised |

### The reasoning behind the differences (this is the defensible part)

Targets are set to **scope of practice**, not seniority alone — which is what makes them honest to an accreditor:

- **New-start doctor** sits highest on the clinical-reasoning and communication EPAs (1, 6, 7, 8) — a qualified doctor is expected toward independence in history-taking and to lead MDT contributions and prognosis conversations under supervision. But they are *new to the subspecialty*, so interpreting the fertility-specific workup (2) stays supervised, and ultrasound (4) and procedures (5) remain skill-limited.
- **Nurse** targets reflect genuine nursing scope, not a "lesser" version. Nurses are front-line for **psychosocial distress (8 → Supervised)** and strong on **history-taking (1)** and **explaining/reinforcing plans (3)** — core nursing work. They sit lower on **interpreting the workup (2)** and **prognosis delivery (7)**, which are medical-scope activities nurses support rather than lead, and lowest on **ultrasound (4)**, which is not typically nursing scope.
- **Medical student** targets are the conservative baseline calibrated for a six-week exposure — the profile you already validated in the logbook.

### Extensibility (later, not now)
This matrix tailors *targets* on the shared eight EPAs. A future iteration can add **role-specific EPA variants** — e.g. a nursing-scope "cycle-monitoring coordination" or "patient education" EPA — without disturbing the spine. The schema (below) supports this via per-course EPAs and per-track targets. Ship the target matrix first; differentiate the activities later.

---

## 3. Starter data schema

Postgres. Auth is handled by the managed provider; `users` holds the profile. Payment-ready, payment-free. Access enforced with row-level security.

**Identity & access**
- `users` — id, email, display_name, role (`learner` | `supervisor` | `admin`), created_at
- `professional_profiles` — user_id, profession (`student` | `doctor` | `nurse`), ahpra_or_student_id, verified (bool), verified_by, verified_at

**Catalogue & content**
- `courses` — id, slug, title, description, published, created_at
- `audience_tracks` — id, course_id, key (`student` | `new_doctor` | `nurse`), label
- `modules` — id, course_id, ordinal, title, summary
- `lessons` — id, module_id, ordinal, title, body_html
- `quiz_questions` — id, course_id, module_id (nullable), stem, options (jsonb), correct_index, rationale, audience_tags (text[])

**Enrolment & access codes** *(the discount-code primitive)*
- `enrolment_codes` — id, course_id, code, track_id (nullable → pre-assigns track), max_uses, uses, expires_at, is_active *(future: discount_type, amount for paid courses)*
- `enrolments` — id, user_id, course_id, track_id, cohort_id (nullable), status, progress, enrolment_code_id (nullable), started_at, completed_at *(future: price_paid, payment_id)*
- `cohorts` — id, course_id, name, start_date, end_date
- `supervisor_assignments` — supervisor_user_id, learner_enrolment_id, cohort_id

**The logbook (bespoke core)**
- `epa_definitions` — id, course_id, number, title, definition, level_descriptors (jsonb)
- `epa_targets` — id, epa_id, track_id, target_level (1–4)  ← *role-specific targets live here*
- `logbook_entries` — id, enrolment_id, epa_id, entry_date, setting, description, self_level, created_at *(append-only)*
- `signoffs` — id, enrolment_id, epa_id, supervisor_user_id, level, note, signed_at *(immutable — corrections are new rows)*
- `reflections` — id, enrolment_id, kind (`weekly` | `capstone`), week_no (nullable), body, submitted_at

**Admin & compliance**
- `media_register` — the figure-credits register, imported from the spreadsheet
- `audit_log` — actor_user_id, action, target_type, target_id, metadata (jsonb), created_at *(logs access to learner records and every sign-off)*

Row-level security: learners → own rows only; supervisors → assigned learners only; admins → their courses. Enforced at the database, not just the UI.

---

## 4. Seed data (already exists — migration, not authoring)

- **6 modules** → `modules` + `lessons` (import HTML bodies; SVGs port as-is)
- **90 questions** → `quiz_questions` (transform the existing structured array)
- **8 EPAs** → `epa_definitions`; **the matrix above** → `epa_targets` (8 EPAs × 3 tracks = 24 target rows)
- **3 audience tracks** → `audience_tracks`
- **figure register** → `media_register`
- **one enrolment code** per cohort for the first student intake

---

## 5. Phase 0 — foundation (ready for Claude Code)

Greenfield start. Each task is small and verifiable.

1. **Init repo** — Next.js (App Router, TypeScript), Tailwind. Load the Flinders brand tokens (from the skeleton's `:root` block) as the design system so the platform is on-brand from commit one.
2. **Connect backend** — managed Postgres + auth, **Australian region confirmed**; environment config; migrations tooling.
3. **Auth** — email/password and magic-link sign-up and login; create a `users` profile row on sign-up; default role `learner`.
4. **Base schema** — migrate the identity, catalogue, enrolment, and EPA-definition/target tables from §3; scaffold row-level security.
5. **App shell** — public **course catalogue** landing (shows "Clinical Rotation in Reproductive Medicine"; future courses as "coming soon"), auth pages, an empty learner dashboard, an admin stub.
6. **Deploy** — to hosting with AU data residency confirmed; basic CI.

**Phase 0 acceptance:** a person can sign up, log in, see the course catalogue and an empty dashboard, live at a URL, on-brand, with data stored in an Australian region.

Then Phase 1 (migrate the six modules + reader), Phase 2 (quiz engine + 90 questions), Phase 3 (the logbook with role-specific targets and immutable sign-off), Phase 4 (cohorts, enrolment codes, admin, reflections). Payments become a later phase when the GAMSAT/USMLE/O&G courses arrive.

---

## 6. What I'd do next

Fastest path to something real: I generate the **initial migration SQL** (all tables in §3) and the **seed script for the EPA definitions + the 24 target rows** — the two artefacts that are pure domain content and unblock Phases 0–3. From there, Claude Code can scaffold the Next.js app against that schema.

Say the word and I'll produce the schema SQL and the EPA/target seed as the first concrete build files.
