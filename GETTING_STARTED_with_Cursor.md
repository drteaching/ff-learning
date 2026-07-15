# Getting the Platform Live with Cursor — Step-by-Step

*From zero to a hosted, running site, then building it out phase by phase.*
*Stack: Next.js + Supabase (Australian region) + Vercel. Companion to the two spec docs.*

---

## The shape of what you're doing

Three stages. Stage 1 gets a **real, hosted, working site up today** (with working sign-up/login but no course content yet). Stages 2–3 use Cursor's AI agent to build the platform out from the spec, one phase at a time, deploying as you go.

The working loop, once set up, is always the same: **prompt Cursor → review its changes → test locally → commit → it auto-deploys.**

You do not need to be a developer for this. You need to follow steps carefully, read what Cursor proposes before accepting it, and test after each change.

---

## Stage 1 — Get a live site running (about an hour)

### 1.1 Accounts and tools (one-time)

Create these first (all have free tiers that cover the whole MVP):

- **Node.js** — install the current LTS from nodejs.org. Check it worked: open a terminal and run `node -v` (you want v20 or newer).
- **GitHub** account — github.com. This stores your code and connects to hosting.
- **Supabase** account — supabase.com. Your database, authentication and file storage.
- **Vercel** account — vercel.com. Sign up *with your GitHub account* — this makes deployment one-click.
- **Cursor** — you have it open. Sign in.

### 1.2 Create your Supabase project — **choose the Sydney region**

1. Go to **database.new** (or the Supabase dashboard → New project).
2. Name it (e.g. `ff-learning`), set a strong database password (save it), and — **critically — set Region to `Sydney (ap-southeast-2)`.**
3. **This cannot be changed later.** Australian region is a hard requirement for hosting health-professional data onshore, so get it right now.
4. Wait for it to provision (~2 minutes).
5. Go to **Project Settings → API** and copy two things: the **Project URL** and the **anon / publishable key**. Keep them handy.

### 1.3 Scaffold the app from the Supabase starter

In a terminal, in a folder where you keep projects:

```bash
npx create-next-app@latest ff-learning -e with-supabase
cd ff-learning
```

This creates a Next.js app already wired with Supabase auth, TypeScript, Tailwind CSS and cookie-based sign-in — so login works out of the box.

### 1.4 Open in Cursor and add your keys

1. In Cursor: **File → Open Folder →** select the `ff-learning` folder.
2. Create a file named **`.env.local`** in the project root with your two Supabase values:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
```

(Use the **publishable** key from Supabase → Project Settings → API — it may start with `sb_publishable_…`, or use the legacy JWT anon key. Never commit this file; it's already git-ignored.)

### 1.5 Run it locally

In Cursor's terminal (**Terminal → New Terminal**):

```bash
npm run dev
```

Open **http://localhost:3000**. You should see the starter app. Click through to sign up — create a test account. **You now have a working authenticated app running locally.**

### 1.6 Put it on GitHub and deploy to Vercel (get it *hosted*)

1. **Push to GitHub.** In Cursor's left sidebar, open the **Source Control** panel → *Publish to GitHub* → create a **private** repo. (Or use `git init`, commit, and push — Cursor can do this for you if you ask its agent.)
2. **Deploy on Vercel.** Go to vercel.com → **Add New → Project → Import** your `ff-learning` repo.
3. In the import screen, **add the same environment variables** as `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `ANON_KEY` — the app expects this name)
   - Optional for admin seed scripts only: `SUPABASE_SERVICE_ROLE_KEY` (keep secret; never prefix with `NEXT_PUBLIC_`)
   *Tip: install the official **Supabase integration** from the Vercel marketplace and it can sync keys — then rename/copy so the publishable value is under `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.*
4. After **any** env change on Vercel, trigger a **Redeploy** (Deployments → … → Redeploy). `NEXT_PUBLIC_*` values are baked in at build time.
5. In Supabase → Authentication → URL Configuration, set **Site URL** to your Vercel production URL and add Redirect URLs: `http://localhost:3000/**` and `https://YOUR-APP.vercel.app/**`.
6. Set the **Functions region to Sydney (`syd1`)** in Project Settings → Functions, so compute stays onshore too.
7. Click **Deploy.** In ~2 minutes you have a live URL.

**Stage 1 done:** a hosted, running site with working sign-up and login, database in Sydney. Nothing course-specific yet — that's Stage 2.

---

## Stage 2 — Build the platform with Cursor's agent

Now you use Cursor's **Agent** (open it with `Cmd/Ctrl + I`, or the Agent icon) to build features from the spec. The agent can write files and run commands; **always read its proposed changes before accepting.**

### 2.1 Give Cursor the brief

1. Create a **`docs`** folder in the project and copy in **`PLATFORM_BUILD_SPEC.md`** and **`PLATFORM_BUILD_v1.1_phase0.md`**.
2. Create a **`content`** folder and copy in the six module HTML files and **`question_bank_quizzes.html`**.
3. Copy the brand-token block (the `:root {…}` from the skeleton) into **`docs/brand-tokens.css`** so the app can match Flinders colours.
4. Set a project rule so every prompt has context. Create **`.cursor/rules/project.md`** (or use Cursor Settings → Rules) with:

> This is a Next.js (App Router, TypeScript) + Supabase learning platform called "Clinical Rotation in Reproductive Medicine". Follow docs/PLATFORM_BUILD_SPEC.md and docs/PLATFORM_BUILD_v1.1_phase0.md. Use @supabase/ssr for auth, Tailwind for styling, and the tokens in docs/brand-tokens.css. Keep all secrets in environment variables, never in code. Enforce row-level security on every table. Do not store patient-identifiable data anywhere.

### 2.2 The prompts, one phase at a time

Feed these to the Agent **one at a time**. After each: review the diff, accept, run `npm run dev`, test, then commit (which auto-deploys via Vercel). Do not run them all at once.

**Prompt A — database schema + role-specific EPA seed**
> Read @docs/PLATFORM_BUILD_v1.1_phase0.md sections 2 and 3. Create Supabase SQL migration files under /supabase/migrations implementing the full schema in section 3, with row-level-security policies: learners see only their own rows, supervisors see only assigned learners, admins see their own courses. Then add a seed migration inserting: the course "Clinical Rotation in Reproductive Medicine"; the three audience tracks (student, new_doctor, nurse); the eight EPA definitions with their level descriptors; and the 24 epa_targets rows from the role-specific target matrix in section 2. Tell me exactly how to run these migrations against my Supabase project.

**Prompt B — migrate the content**
> The /content folder has the six module HTML files and question_bank_quizzes.html. Write a seed script that inserts six modules with their lessons (use the HTML bodies, keep the inline SVGs), and inserts the 90 quiz questions by extracting them from the questions array inside question_bank_quizzes.html into quiz_questions rows. Preserve ordering.

**Prompt C — learner experience**
> Build the learner UI styled with docs/brand-tokens.css: a course catalogue landing page (show "Clinical Rotation in Reproductive Medicine"; future courses as "coming soon"), a course overview page, a module reader that renders lesson body_html, and the quiz UI with scoring and rationales. Gate all content behind auth and enrolment.

**Prompt D — enrolment codes (your "discount code")**
> Implement code-based self-enrolment: an admin can create enrolment_codes for a course (each optionally pre-assigning an audience track); a signed-in learner enters a code to enrol and is assigned that track. This is the access gate for now; payments come later.

**Prompt E — the logbook (the core; do this carefully)**
> Implement the EPA logbook per @docs/PLATFORM_BUILD_SPEC.md section 6, using each learner's audience-track targets. Learners create logbook_entries against EPAs and see a progress dashboard comparing their reached level to their track's target. Supervisors assigned via supervisor_assignments can view a learner's entries and record an immutable signoff — append-only, corrections are new rows, capturing the supervisor's identity and a server timestamp. Add a per-learner PDF export of entries, sign-offs and completion against targets, and write to audit_log on every sign-off.

**Prompt F — admin & cohorts**
> Build an admin area: create cohorts, assign supervisors to learners, approve professional access, manage enrolment codes, and export a cohort's logbooks. Restrict to the admin role.

### 2.3 Seed yourself as supervisor/admin

Once auth and the schema exist, ask the agent:
> Make my account (A/Prof Tobias Angstmann, [your email]) an admin and a supervisor, and enrol me so I can test end to end.

---

## Stage 3 — Run your first cohort

- Create an enrolment code for the first intake; give students the code (this is your "discount code").
- Assign yourself as their supervisor.
- They work through modules and quizzes, log EPA encounters; you sign off.
- Export the signed logbooks for your accreditation file.

Add the GAMSAT / USMLE / O&G courses later as new rows in the same platform — the architecture already supports them. Payments become a later phase when those paid courses go live.

---

## Guardrails (read once)

- **Commit often.** After every working change, commit. Each commit auto-deploys and gives you a point to roll back to. If Cursor breaks something, you can revert.
- **Review before accepting.** Read what the agent proposes. If you don't understand a change, ask it "explain what this does and why" before accepting.
- **Never commit secrets.** Keys live in `.env.local` (local) and Vercel's environment variables (hosted) — never in code. If a key is ever committed, rotate it in Supabase.
- **No patient-identifiable data on the platform, ever.** Case content stays de-identified. This is a teaching platform, not a clinical record.
- **Australian data residency.** Supabase in Sydney, Vercel functions in Sydney. Confirm before any real cohort data goes in.
- **Test after every phase.** Run locally, click the new feature, check it does what you asked, then deploy.

---

## Money

The free tiers of Supabase, Vercel and GitHub comfortably cover building and a first small cohort. You'll only pay once usage grows or you add paid courses — and by then the platform is earning.

---

## If you get stuck

- Paste the exact error into Cursor's Agent and ask it to fix it — that's the fastest path for most issues.
- For Supabase auth specifically, the official guide (supabase.com/docs → Auth → Server-Side → Next.js) matches this setup.
- Bring me the error or the behaviour and I'll help you reason through it, or refine the prompt that produced it.

---

## Your immediate next three actions

1. Install Node, and create the Supabase project **in the Sydney region** (§1.1–1.2).
2. Run the two scaffold commands and add your keys (§1.3–1.4), then `npm run dev` to see it locally (§1.5).
3. Push to GitHub and deploy on Vercel for your first live URL (§1.6).

Do those three and you have a hosted, running site. Then come back and we'll run the Stage 2 prompts one at a time.
