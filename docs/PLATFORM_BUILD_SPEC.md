# Clinical Rotation in Reproductive Medicine — Platform Build Specification

*Build brief for Claude Code (or a developer). Version 1.0 — draft for review.*

---

## 1. Recommendation and scope

**Build a small, custom, multi-course learning platform** — not an off-the-shelf LMS, and not an extension bolted onto the existing teaching site's internals. Reuse a managed backend for the commodity parts (authentication, database, file storage) so no effort is wasted rebuilding them, and spend the custom engineering on the one genuinely bespoke component: the **EPA clinical logbook with authenticated supervisor sign-off**.

Rationale, stated plainly:

- **The logbook is the moat.** Module delivery and quizzes are commodity — any LMS does them. The entrustability logbook with supervisor sign-off, per-EPA progression, and an accreditation-grade audit trail is what distinguishes a *clinical rotation* from an online course, and it is exactly what off-the-shelf LMSs handle badly. Building custom is justified here and only here.
- **Multi-course from day one.** You want several offerings on your teaching site. The platform is built course-agnostic; the reproductive medicine rotation is the first tenant, not a hard-coded app.
- **Don't entangle with the existing site yet.** Integration approach depends entirely on what that site runs on (see §9). Build this as a standalone app that can later sit behind the existing site via subdomain and shared sign-on. Keep it reversible.

Course is renamed throughout to **Clinical Rotation in Reproductive Medicine**. Audience broadens from medical students to **medical students, new-start doctors, and nurses** — which has a real design consequence for the EPA framework (see §11).

---

## 2. Product overview

Three user types, one platform, many courses.

| Role | What they do |
|---|---|
| **Learner** (student / new-start doctor / nurse) | Self-signs up, gains verified professional access, works through module content and quizzes, records EPA logbook entries, submits reflections. |
| **Supervisor** (clinical educator) | Sees assigned learners, reviews logbook entries, records authenticated entrustment sign-offs, gives feedback. |
| **Administrator / educator** | Manages courses and content, creates cohorts, approves professional access, exports logbooks for accreditation, manages the figure-credits/media register. |

The reproductive medicine course contains: six teaching modules, a 90-question quiz bank, an eight-EPA logbook, weekly reflections, and a capstone. All of this content already exists as structured static assets and migrates in (see §7).

---

## 3. Recommended stack

Deliberately proven and boring — the right choice for a real clinical product with a long life.

- **Framework:** Next.js (React, App Router) — full-stack, one codebase for UI and API, Claude-Code-friendly, large ecosystem.
- **Backend / data / auth:** a managed Postgres-plus-auth platform (e.g. Supabase or an equivalent) providing Postgres, authentication, row-level security, and file storage in one. This removes the need to build auth and a database layer from scratch. **Confirm an Australian region is available and host there** (see §10).
- **Payments (if enrolment is monetised):** Stripe.
- **Hosting:** Vercel for the Next.js app, plus the managed backend; or a single integrated platform. Confirm data-residency for any component that stores learner or logbook data.
- **Email:** a transactional email provider for sign-up verification, sign-off notifications, and cohort communications.

Do not over-engineer. No microservices, no custom auth, no bespoke infrastructure. A single Next.js app against a managed Postgres backend is the correct scale for years.

*Vendor names above are current-generation defaults; confirm pricing, features, and Australian data residency before committing — these change.*

---

## 4. Architecture and data model

A single app, a relational schema. Core tables (names indicative):

- **users** — identity, role, professional-verification status, profile.
- **courses** — course-agnostic container (title, description, audience tracks, published state).
- **modules** / **lessons** — ordered content units within a course; lesson body stored as sanitised HTML (the existing modules port directly, SVGs included).
- **quiz_questions** — module, stem, options, correct index, rationale, audience tags. Seeded from the existing 90-question dataset.
- **quiz_attempts** — user, quiz, answers, score, timestamp.
- **enrolments** — user ↔ course, with cohort, start/end dates, progress, completion.
- **cohorts** — a rotation intake; links learners to supervisors and dates.
- **epa_definitions** — course's EPAs: number, title, definition, level descriptors, **target level per audience track** (see §11).
- **logbook_entries** — learner, EPA, date, setting, description, self-recorded level. *Append-only where possible.*
- **signoffs** — supervisor, learner, EPA, level confirmed, timestamp, immutable audit record.
- **reflections** — learner, week/capstone, text, submitted state.
- **media_register** — the figure-credits/licence register (admin), migrated from the existing spreadsheet.

Access is enforced at the database layer (row-level security): learners see only their own data; supervisors see only assigned learners; admins see their courses. This is not optional for a clinical platform.

---

## 5. Roles, access and professional verification

**Self sign-up with a verification gate.** Anyone can create an account; *professional access* (enrolment in a clinical course) requires verification appropriate to a health-professional audience. Options, in increasing rigour:

1. **Email-domain / invite** — cohort invited by an administrator (simplest; good for a controlled first intake).
2. **Manual approval** — learner self-signs up and requests access; an administrator approves after checking credentials (AHPRA registration number for doctors/nurses, or student enrolment). Recommended default — low build cost, appropriate assurance.
3. **Automated credential check** — integrate registration verification later if volume justifies it.

Start with (2): self sign-up, then admin approval of professional access. It is a small build and gives real assurance that a clinical course needs.

**Supervisors** are created/invited by an administrator (never self-serve) and assigned to cohorts. Sign-off authority is a role capability, audit-logged.

---

## 6. The EPA logbook — the bespoke core

This is where custom engineering earns its place. It must do what the static logbook could not: **authenticated, immutable supervisor sign-off**.

- **Learner side:** log an encounter against an EPA (date, setting, description, self-assessed level). See a live progress view — current level reached versus the target for their audience track.
- **Supervisor side:** view a learner's entries; record a sign-off at a given entrustment level. Each sign-off captures the supervisor's authenticated identity and a server timestamp, and is **immutable** (corrections are new records, not edits) — this is the accreditation-defensibility feature the typed-initials version lacked.
- **Progression dashboard:** per-EPA status across the cohort, for both the learner and the educator.
- **Accreditation export:** generate a per-learner logbook PDF (entries + sign-offs + completion against targets) and a cohort summary — the artefact you take to the university and RTAC.

Design the sign-off as an audit event from the start; retrofitting immutability later is painful. This component is the reason to build custom rather than buy.

---

## 7. Content migration

The content already exists as structured assets, so migration is seeding, not authoring.

- **Six modules** → import each module's HTML body as a lesson record. The inline SVG diagrams and the design system port directly. Sanitise on import; strip the standalone page chrome and keep the content blocks.
- **90-question quiz bank** → the questions already live as a structured data array; transform it into `quiz_questions` rows in one migration script. This is near-free.
- **EPA logbook** → seed `epa_definitions` from the existing eight-EPA structure, including the level descriptors and (now audience-aware) targets.
- **Figure-credits register** → import the spreadsheet into `media_register`.
- **Skeleton** → becomes the course landing/overview page.

Because everything is already structured and verified, migration is a set of seed scripts, not a rebuild.

---

## 8. Build phases (for Claude Code)

Each phase is independently shippable, with acceptance criteria. Build in order; validate each before the next.

**Phase 0 — Foundation.** Repo, Next.js app, managed backend connected, auth working, deploy pipeline live.
*Done when:* a user can sign up, log in, and see an empty dashboard, deployed to a URL.

**Phase 1 — Multi-course shell + content.** Course/module/lesson schema; admin can create a course and lessons; learners can read module content. Migrate the six modules.
*Done when:* an enrolled learner can read all six modules with diagrams intact.

**Phase 2 — Quiz engine.** Question schema, quiz UI, scoring, attempt history. Seed the 90 questions.
*Done when:* a learner can take a module quiz and a mixed exam, get scored, and see rationales; attempts are stored.

**Phase 3 — EPA logbook (the core).** Logbook entries, supervisor role, immutable sign-off, progression dashboard, accreditation export.
*Done when:* a learner logs entries, an assigned supervisor signs off at a level, the record is immutable and timestamped, and a per-learner PDF exports.

**Phase 4 — Cohorts, enrolment, professional access, admin.** Cohort creation, learner↔supervisor assignment, self-signup + admin approval, admin console, reflections.
*Done when:* an admin can run a real intake end to end: approve learners, assign supervisors, track a cohort.

**Phase 5 — Payments (if needed), polish, integration.** Enrolment tiers/payments; accessibility and print passes; integrate with the existing teaching site (§9).
*Done when:* the course can be discovered and enrolled in from your existing site, with the platform as the authenticated home.

Ship Phases 0–2 first to prove the platform cheaply; Phase 3 is where the real value is; Phases 4–5 make it operational.

---

## 9. Integrating with the existing teaching site

**This is the one decision I can't make without knowing what your current site runs on.** Three patterns, with a recommendation:

- **A · Subdomain + shared sign-on (recommended default).** The platform lives at, e.g., `learn.yoursite.com` or `rotations.yoursite.com`; your existing site links to it and (ideally) shares a single sign-on so users move seamlessly. Cleanest separation, lowest risk, no entanglement with the old codebase. Works regardless of what the existing site is built on.
- **B · Embed / deep-link.** The existing site keeps marketing and course catalogue; "enrol" hands off to the platform. Good if the existing site is a simple marketing/CMS site (e.g. WordPress).
- **C · Rebuild the teaching site as the platform.** Only if the existing site is thin and you want to consolidate everything onto the new stack. Higher scope; do not choose this by default.

Recommended: **A**, unless the existing site is already a capable app you want to extend. The determining fact is the existing site's stack — see the open decisions in §12.

---

## 10. Compliance, privacy and security

This is health-professional education that references clinical cases. Non-negotiables:

- **Australian data residency.** Host learner and logbook data in an Australian region; confirm every component (DB, storage, backups, email logs) complies. Comply with the Australian Privacy Principles.
- **No patient-identifiable information on the platform.** Case content is de-identified per the rotation's consent/de-identification protocol. The platform is not a clinical record and must not become one.
- **Audit logging** on sign-offs and access to learner records — required for accreditation defensibility.
- **Secure auth** (managed provider, MFA available for supervisors/admins), least-privilege access enforced at the database layer.
- **Accessibility** (WCAG AA) — this is educational content for health professionals and should meet the standard.

Flag these to whoever builds it; they shape the stack and hosting choices from the start, not after.

---

## 11. Rename and audience broadening

- **Rename** the course to **Clinical Rotation in Reproductive Medicine** across all content, metadata, and the landing page.
- **Broadening to nurses and new-start doctors is not cosmetic.** An entrustable professional activity is scope-of-practice specific: a nurse's entrustable activities in a fertility unit differ from a junior doctor's, which differ again from a medical student's. The EPA framework should become **audience-aware**:
  - Keep the eight EPAs as the shared spine where they apply across roles (history-taking, communication, recognising distress, understanding procedures).
  - Allow **role-specific target levels** — and, where needed, role-specific EPA variants (e.g. nursing-scope activities such as cycle-monitoring coordination or patient education, versus medical-scope activities such as formulating a management plan).
  - The data model already supports this: `epa_definitions` carry targets per audience track, and `courses` carry audience tracks.

Recommendation: launch with the existing eight EPAs and **role-tailored target levels** first (small change), and add genuinely role-specific EPA variants for nurses in a later iteration once the platform is proven. Don't hold up the build to design a perfect three-track framework on day one — ship, then differentiate.

---

## 12. Open decisions (needed before Phase 5, some before Phase 0)

These genuinely change the plan:

1. **What is the existing teaching site built on?** (WordPress / a custom app / an existing LMS?) Determines the integration pattern in §9.
2. **Is enrolment paid or free?** "Professional access" = a paid tier, or just verified free access? Determines whether Stripe is in scope and when.
3. **One audience track at launch, or role-tailored from day one?** Recommend launching with role-tailored *targets* only; full nurse-specific EPAs later.
4. **Who is the primary builder** — Claude Code driving the whole build, or Claude Code alongside a developer? Affects how prescriptive the phase specs need to be.
5. **Expected first-cohort size and timing?** Determines whether Phase 4's admin tooling can be minimal at first.

---

## 13. The honest reality

This is a real software product, not a one-off document. Budget for **ongoing maintenance** (dependency updates, hosting, support), not just the build. The upside: the multi-course architecture means every future course you add is nearly free once the platform exists, and the logbook is a genuine, defensible differentiator that compounds in value as it accumulates signed-off clinical evidence.

Sequence it so risk is front-loaded and cheap: Phases 0–2 prove the platform in days, not months, using content that already exists. Only commit the larger effort to Phase 3 (the logbook) once the shell is real. Reversible, iterative, evidence-led — the same discipline the rotation itself teaches.

---

*Next step: answer the five decisions in §12 — especially #1 (existing site stack) and #2 (paid vs free) — and this spec can drive a Phase 0 build immediately.*
