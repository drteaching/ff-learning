# Cursor Prompt Pack — Building the Platform

*Paste these into Cursor's Agent (Cmd/Ctrl + I) one at a time, in order. After each: read what it proposes, accept, test, commit (auto-deploys). Don't run them all at once.*

Your live site already has working auth. These prompts add the schema, content, learner experience, enrolment, the logbook, and admin.

---

## Step 0 — Put the files in the repo (do this first, manually)

Cursor can only use files that are in your project. In Cursor's file explorer, create these folders and drop in the files from this project:

- `docs/` → `PLATFORM_BUILD_SPEC.md`, `PLATFORM_BUILD_v1.1_phase0.md`
- `docs/` → `brand-tokens.css`
- `content/` → the six module HTML files (`module1_content.html` … `module6_content.html`)
- `content/` → `questions.json`

Then set a project rule so every prompt has context. In Cursor: **Settings → Rules → Add rule** (or create `.cursor/rules/project.md`) and paste:

```
This is a Next.js (App Router, TypeScript) + Supabase learning platform: "Clinical Rotation in Reproductive Medicine". Audiences: medical students, new-start doctors, nurses.
Follow docs/PLATFORM_BUILD_SPEC.md and docs/PLATFORM_BUILD_v1.1_phase0.md.
Use @supabase/ssr for auth, Tailwind for styling, and the tokens in docs/brand-tokens.css.
Keep all secrets in environment variables, never in code. Enforce row-level security on every table. Never store patient-identifiable data.
Work in small, reviewable steps. After each change, tell me how to test it.
```

**One prerequisite for seeding data:** open `.env.local` and add your Supabase **service role** key (Supabase → Project Settings → API → `service_role` secret) as:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
This key bypasses security rules and must **only** ever be used server-side / in scripts — never in browser code, never committed. (It's already covered by `.gitignore`.)

---

## Prompt 1 — Database schema + role-specific EPA seed

```
Read docs/PLATFORM_BUILD_v1.1_phase0.md sections 2 and 3.

Create the database schema from section 3 as SQL migration files under supabase/migrations/, with row-level-security policies: learners see only their own rows; supervisors see only learners they're assigned to; admins see only their own courses.

Then create a seed that inserts:
- the course "Clinical Rotation in Reproductive Medicine"
- the three audience tracks: student, new_doctor, nurse
- the eight EPA definitions with their level descriptors
- the 24 epa_targets rows from the role-specific target matrix in section 2

Output the complete SQL in the chat as well, in the correct run order, so I can paste it straight into the Supabase SQL Editor. Explain nothing I don't need — just give me the SQL and the order to run it.
```

**To apply it:** open Supabase → **SQL Editor** → paste each block in the order given → **Run**. Then in **Table Editor**, confirm the tables and the seeded EPAs/targets exist.

**Done when:** the tables exist, and `epa_definitions` has 8 rows and `epa_targets` has 24.

---

## Prompt 2 — Migrate the content (modules + 90 questions)

```
The content/ folder has the six module HTML files and questions.json (90 quiz questions with fields: id, module, question, options, answer_index, rationale).

Write a seed script (TypeScript, run with the Supabase service role key from SUPABASE_SERVICE_ROLE_KEY) that:
1. Inserts six modules with their lessons — use each module HTML file's <body> content as the lesson body_html, keeping the inline SVGs, and preserve module order 1–6.
2. Inserts all 90 rows from questions.json into quiz_questions, mapping module → the matching module, and keeping options, correct answer, and rationale.

Give me the exact command to run the script, and make it safe to re-run (upsert, don't duplicate).
```

**Done when:** running the script populates 6 modules, their lessons, and 90 `quiz_questions` rows (check in the Supabase Table Editor).

---

## Prompt 3 — Learner experience (catalogue, reader, quizzes)

```
Build the learner-facing UI, styled with the tokens in docs/brand-tokens.css (import them and use the CSS variables; map them into Tailwind if helpful). Keep the deep-navy / gold Flinders look, serif display headings.

Pages:
- A course catalogue landing page showing "Clinical Rotation in Reproductive Medicine" as an enrollable course, with future courses (GAMSAT, USMLE prep, O&G prep) shown as "coming soon".
- A course overview page (modules list + what the rotation is).
- A module reader that renders each lesson's body_html safely (sanitise, keep SVGs).
- A quiz page per module and a mixed quiz, with single-best-answer selection, scoring, and the rationale shown after checking — reuse the logic pattern from content/question_bank_quizzes.html.

Gate all course content behind auth AND an active enrolment. Tell me how to test each page.
```

**Done when:** signed in and enrolled, you can read all six modules and take a scored quiz with rationales, on-brand.

---

## Prompt 4 — Enrolment codes (your access / discount code)

```
Implement code-based self-enrolment (the access gate for now; payments come later).

- An admin can create enrolment_codes for a course, each optionally pre-assigning an audience track (student / new_doctor / nurse), with optional max uses and expiry.
- A signed-in learner can enter a code to enrol in the course and is assigned that track.
- Invalid, expired, or used-up codes are rejected clearly.

Give me a way to create a code as admin and test redeeming it as a learner.
```

**Done when:** you can create a code, redeem it from a second test account, and that account is enrolled on the right track.

---

## Prompt 5 — Seed yourself as admin & supervisor

```
Make my account an admin AND a supervisor, and enrol me in the course so I can test end to end. My details: A/Prof Tobias Angstmann, email [YOUR-EMAIL]. Give me a small SQL snippet or script to run that sets this up for the account already registered under that email.
```

*(Replace [YOUR-EMAIL] with the email you signed up with.)*

**Done when:** your account can reach the admin area and act as a supervisor.

---

## Prompt 6 — The EPA logbook (the core — go carefully)

```
Implement the EPA logbook per docs/PLATFORM_BUILD_SPEC.md section 6, using each learner's audience-track targets from epa_targets.

Learner side:
- Create logbook_entries against any of the eight EPAs (date, setting, description, self-assessed level 1–4).
- A progress dashboard showing, per EPA, the highest level reached vs the learner's track target, with clear "target met / working toward" states.

Supervisor side:
- A supervisor assigned to a learner can view that learner's entries and record a signoff at a level, with an optional note.
- Sign-offs are IMMUTABLE and append-only: corrections are new rows, never edits. Each captures the supervisor's identity and a server-side timestamp.
- Write an audit_log row on every sign-off.

Export:
- A per-learner PDF: entries + sign-offs + completion against targets — the accreditation record.

Style with the brand tokens. Tell me how to test the full learner→supervisor→sign-off→export flow.
```

**Done when:** a learner logs entries, you (as supervisor) sign off immutably, the dashboard reflects it against role targets, and a PDF exports.

---

## Prompt 7 — Admin & cohorts

```
Build an admin area (admin role only):
- Create cohorts (name, start/end dates) and assign learners and supervisors to them.
- Approve professional access for learners who request it.
- Manage enrolment codes.
- Export a whole cohort's logbooks.
- Manage the media/figure-credits register (import content/figure register data if provided).

Keep it simple and functional over fancy.
```

**Done when:** you can run an intake end to end — approve learners, assign yourself as supervisor, track the cohort.

---

## After each prompt

1. **Read** the proposed changes before accepting.
2. **Test** locally (`npm run dev`) using the steps Cursor gives you.
3. **Commit** in the Source Control panel with a short message (e.g. "add schema", "add logbook"). This auto-deploys to Vercel.
4. If something breaks, paste the exact error back into the Agent and ask it to fix it — or bring it to me.

## Remember

- Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel's environment variables too if any seeding runs on the server (Project Settings → Environment Variables) — but it is a secret, never exposed to the browser.
- When you get real brand hex from Flinders, edit `docs/brand-tokens.css` once and the whole platform updates.
- No patient-identifiable data, ever. Australian region only (already set).
