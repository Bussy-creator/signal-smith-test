# Free CBT — Project Handoff / State Document

**Purpose of this file**: paste this into a new chat (or point Claude at it)
to resume work with full context. It captures what the app is, what's
built, what's pending, and every open issue as of this point.

---

## 1. What this is

A Computer-Based Testing (CBT) web app for Nigerian university students
(built with FUTA — Federal University of Technology, Akure — in mind, but
not hardcoded to it beyond the faculty/department list). Students practice
past questions and take timed exam simulations; admins upload courses and
questions and manage a lightweight ad-monetization layer.

**Target scale**: ~8,000 concurrent students during exam periods.
**Primary form factor**: mobile-first — most students will use this on
phones, not desktops.

---

## 2. Where the project lives

- **Actual project folder** (what the person builds/deploys from):
  `/home/sage/signal smith/Free CBT` — accessed via a `filesystem` MCP
  connector in Claude Desktop.
- Claude also maintains a **working sandbox copy** at `/home/claude/free-cbt`
  inside its bash tool during a session, used to build/test file contents
  before copying them into the real project folder via the filesystem
  connector's `write_file`/`edit_file` tools.
- **⚠️ Known operational issue**: the filesystem MCP connector to
  `/home/sage/signal smith/Free CBT` intermittently times out or becomes
  unavailable mid-session (observed multiple times). When this happens,
  changes exist correctly in the sandbox but have NOT been copied to the
  real folder yet. **Always verify sync status at the start of a new
  session** — ask the person to confirm recent files are present, or
  re-read key files from the real path to check they match what's
  described below.

---

## 3. Tech stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend/DB**: Supabase (Postgres + Auth + Storage), accessed via
  `@supabase/ssr` and `@supabase/supabase-js`
- **Caching**: Upstash Redis (`@upstash/redis`) — caches ad queries and the
  per-course question pool
- **Bulk upload parsing**: `papaparse` (CSV), `xlsx` (Excel)
- **Validation**: `zod`
- Hosting assumption: Vercel (frontend) + Supabase (backend) + Upstash
  (cache) — see `README.md` in the project for full rationale on why this
  stack handles 8,000 concurrent users without DB read-lock contention
  (short version: exam question pools are cached in Redis per-course, not
  queried fresh per student; PgBouncer connection pooling; most reads
  served from cache/CDN, not Postgres directly).

---

## 4. Full feature list (as of this document)

### Auth & profile
- Email/password registration and login (Supabase Auth)
- Registration collects: full name, Matric/Reg number, phone number,
  Faculty (searchable dropdown), Department (searchable dropdown, scoped
  to the chosen faculty), Level (100–600), email, password — **all
  fields compulsory**
- Faculty/department data lives in `lib/faculties.ts` — 10 FUTA faculties
  with their departments, hand-verified against FUTA's 2024/2025
  restructuring (the old single "School of Engineering" split into SESE +
  SIMME; School of Computing gained a Data Science department; School of
  Physical Sciences includes General Studies; School of Logistics gained
  Financial Technology + Procurement Technology departments)
- After registration, the student is signed out and redirected to
  `/login?registered=1` (shows a "account created" banner) rather than
  being dropped straight into the dashboard
- Login/registration show a loading spinner (`components/Spinner.tsx`)
  during submission and while redirecting

### Dashboard (`app/dashboard/`)
- Server component (`page.tsx`) fetches profile, active course
  enrollments, all courses **at the student's level** (not restricted by
  department — see §6 below for why), and past quiz attempts; passes to
  `DashboardClient.tsx` (client component)
- Shared `Navbar` (logo → home, Dashboard/Admin links, dark mode toggle,
  logout) — mobile-tightened, see §7
- Auto-rotating ad carousel (`DashboardAdCarousel.tsx`) for
  `dashboard`-placement ads, 5s rotation, dot navigation
- "Your courses this semester" section with a **"Manage courses"** button
  (always visible) that reopens the course-picker modal, pre-seeded with
  current selections, so students can add AND remove courses at any time
  — not just on first login
- "Courses to work on" / "Your strongest courses" — simple average-score
  aggregates from attempt history; empty-state messaging when no
  attempts exist yet

### Course enrollment (`components/SemesterCourseModal.tsx`)
- Shown when a student has zero active enrollments (new student, or after
  an admin semester-reset), or on-demand via "Manage courses"
- Has its own search filter (plain text input, filters the checkbox list)
- Shows a "Can't find your course? Message us at {phone}" line, phone
  number pulled live from the `app_settings` table (admin-editable)
- **Add/remove works correctly**: `initialSelectedIds` prop seeds the
  checklist; on save, courses newly checked are upserted `is_active:
  true`, and courses that WERE active but got unchecked are explicitly
  set `is_active: false` (this removal step was missing originally — a
  student could only ever add, never remove, until this was fixed)
- Continue/Save button is **never disabled** even with zero courses
  selected or zero courses available — an earlier version blocked this
  and looked like the app had frozen

### Quiz engine (`components/QuizEngine.tsx`)
Two modes, meaningfully different:

**Practice mode**:
- Student picks specific topics (or none = all topics) on
  `app/quiz/[courseId]/practice/page.tsx`, and picks the **number of
  questions** via an editable number input, clamped to however many
  questions actually exist across the selected topics (live count fetched
  from `/api/courses/[courseId]/topics`)
- No time limit
- **Instant per-question feedback**: as soon as the student picks an
  answer, it's checked immediately (via `/api/quiz/check-answer`) and the
  UI shows the correct option in green, the student's wrong pick in red
  if applicable, and the question's `explanation` text inline. The
  question is then locked (can't change the answer after seeing the
  correct one)
- Feedback state (`checked`) persists to localStorage alongside answers,
  so a refresh mid-practice doesn't lose the shown feedback

**Exam mode**:
- Fixed: **30 questions, 30-minute countdown**, balanced across every
  topic in the course, auto-submits at zero
- No per-question feedback during the exam (feedback would let students
  peek at answers mid-exam) — `/api/quiz/check-answer` explicitly refuses
  to run for `mode === 'exam'` attempts (403)
- Question and option order randomized per student per attempt

**Both modes**:
- Question flagging ("Mark for review")
- On-screen calculator (standard/scientific toggle,
  `components/Calculator.tsx`)
- Background watermark ad (`components/AdWatermark.tsx`) during the quiz
- Offline resilience: answers + practice-mode feedback saved to
  localStorage on every change; an offline banner shows if connectivity
  drops
- **Post-submission "mistakes and corrections" review**: `/api/quiz/submit`
  now returns a `mistakes` array (question text, the student's answer,
  the correct answer, and the explanation) for every question answered
  incorrectly. `ResultView.tsx` renders this below the topic-breakdown
  score summary, for both practice and exam mode. A perfect score shows
  a congratulatory message instead.

### Admin panel (`app/admin/`)
Gated two ways: `middleware.ts` checks `is_admin` before the page loads
(redirects non-admins to `/dashboard`), AND `page.tsx` re-checks
server-side before rendering `AdminClient.tsx` — defense in depth, not
redundant (protects against middleware misconfiguration).

Sections, in order:
1. **Course manager** — create/edit/delete courses. Department field uses
   the same searchable-dropdown component as registration. Existing
   courses list is editable inline and deletable (with a confirm step;
   deletion is blocked with a friendly error if students have already
   taken quizzes for that course, since `quiz_attempts.course_id` has no
   `ON DELETE CASCADE`)
2. **Bulk question upload** — CSV/XLSX, two-phase validate-then-commit,
   columns: `question_text, option_a, option_b, option_c, option_d,
   correct_answer, explanation, topic, course_code, level`
3. **Ad manager** — upload an actual image file (goes to Supabase Storage
   bucket `ad-flyers`, auto-created if missing) OR paste a URL; choose
   placement (`watermark` / `result_banner` / `dashboard`); toggle
   active/inactive; recommended-size hint shown inline per placement (see
   §8)
4. **Site settings** — currently just the support phone number shown to
   students who can't find their course; built as a generic key-value
   `app_settings` table so more admin-editable variables can be added
   later without a schema change
5. **Semester reset** — soft-resets every student's `user_course_enrollment`
   to `is_active: false` (never deletes; history/scores untouched) so
   they're re-prompted to pick courses next login. Two-step confirm.

### How to become an admin
No in-app UI for this yet — manually flip `is_admin` to `true` on your row
in the `profiles` table via Supabase's Table Editor. (Flagged as a future
"promote another admin by email" feature, not yet built.)

---

## 5. Database schema — current state

Full schema lives in `database/schema.sql` in the project. Key tables:
`profiles`, `courses`, `topics`, `user_course_enrollment`, `questions`,
`quiz_attempts`, `advertisements`, `bulk_upload_jobs`, `app_settings`.

**Design decisions worth knowing**:
- `quiz_attempts.attempt_questions` and `attempt_answers` are JSONB blobs,
  not normalized join tables — deliberate, to avoid a write-storm at
  exam-start (8,000 students × 30 questions would be 240,000 row-inserts
  otherwise). `attempt_questions` stores the full per-student generated
  question set including `correct_option` and `explanation` — needed
  server-side for grading and instant feedback.
- `questions` and `bulk_upload_jobs` have RLS enabled with **NO policies**
  for `anon`/`authenticated` — only the service-role key (used in API
  routes via `createAdminClient()`) can touch them. This is intentional:
  it's what stops a student from querying `questions` directly via the
  Supabase client library and reading every answer key in the bank.
- `courses`, `topics`, `advertisements`, `app_settings` have RLS enabled
  WITH a public `select using (true)` policy — readable by anyone logged
  in, writable only via service-role (admin API routes).
- `profiles`, `quiz_attempts`, `user_course_enrollment` have RLS scoped to
  `auth.uid()` (own-row only).

**⚠️ Known residual security caveat** (documented in code comments, not
yet fixed): because RLS lets a student `SELECT` their own `quiz_attempts`
row, a technically savvy student could query that table directly via the
Supabase client library and read `attempt_questions` (including
`correct_option` and `explanation`) for an in-progress attempt, ahead of
answering — bypassing the "no time to look ahead" intent of exam mode.
Proper fix: a Postgres VIEW or RPC that strips those fields for
student-facing reads, restricting direct table SELECT on `quiz_attempts`
to service-role only. **Not yet implemented** — worth doing before a real
launch.

### SQL that needs to be run against the live database (cumulative)

If starting fresh, just run the full `database/schema.sql`. If the
database already exists from before certain features were added, these
incremental migrations are needed (idempotent — safe to re-run):

```sql
-- Phone/faculty columns on profiles (if not already present)
alter table profiles add column if not exists phone text not null default '';
alter table profiles add column if not exists faculty text not null default '';

-- RLS hardening — courses/topics/advertisements/questions/bulk_upload_jobs
-- previously had NO RLS at all, meaning any authenticated client could
-- read/write them directly, including reading question answer keys.
alter table courses enable row level security;
alter table topics enable row level security;
alter table advertisements enable row level security;
alter table questions enable row level security;
alter table bulk_upload_jobs enable row level security;
alter table app_settings enable row level security;

drop policy if exists "read courses" on courses;
create policy "read courses" on courses for select using (true);
drop policy if exists "read topics" on topics;
create policy "read topics" on topics for select using (true);
drop policy if exists "read active ads" on advertisements;
create policy "read active ads" on advertisements for select using (true);
drop policy if exists "read settings" on app_settings;
create policy "read settings" on app_settings for select using (true);

-- profiles insert/update policies (registration was failing with
-- "new row violates row-level security policy" before this was added —
-- only a SELECT policy existed originally)
drop policy if exists "insert own profile" on profiles;
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- app_settings table + seed row (if not already present)
create table if not exists app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
insert into app_settings (key, value) values ('support_phone', '')
  on conflict (key) do nothing;
```

**Diagnostic if courses still don't show up for students after all this**:
run `select code, title, department, level from courses;` directly — if
real courses genuinely aren't in that result, the bug is in course
*creation* (check the admin course-creation flow), not in reading.

---

## 6. Deliberate product decisions (context for "why is it built this way")

- **Courses are NOT filtered by department**, only by **level**. Original
  design filtered by both department AND level, which caused a real bug:
  admin-uploaded courses (e.g. for Statistics) weren't showing up for
  students because of exact-string department mismatches, AND it doesn't
  make sense anyway since general/elective courses cut across
  departments and admins can only realistically upload what they have
  question banks for. Level IS enforced, though — a 100L student can't
  see/enroll in a 200-level course (`courses.level` column, set
  explicitly by the admin at course creation, is the source of truth —
  not string-parsing the course code).
- **Searchable dropdowns** (`components/SearchableSelect.tsx`): a native
  `<input>` + `<datalist>` combo that lets people type to filter a long
  list (faculties, departments) but only commits a value that exactly
  matches an option label — free text that doesn't match anything is
  rejected on blur. Used for Faculty/Department everywhere they appear
  (registration, admin course creation).
- **Mobile-first**: this is explicitly the primary form factor. Layouts
  use `flex-col` at the base breakpoint and expand at `sm:`, not the
  reverse. Global `overflow-x: hidden` on `html, body` guards against
  accidental horizontal scroll from unbroken long text (course titles,
  sponsor names) — several list rows were fixed to `truncate` +
  `min-w-0` for this reason (a classic flexbox pitfall: a flex child
  without `min-w-0` won't shrink for its sibling, forcing overflow).

---

## 7. Mobile-specific work already done

- `components/Navbar.tsx`: deliberately tiny at the base breakpoint
  (text-xs, tight padding) so logo + Dashboard + Admin + theme toggle +
  Log out all fit on a ~360px-wide screen without wrapping or overflow;
  expands at `sm:`
- `components/QuizEngine.tsx`: header row wraps safely
  (`flex-wrap`), calculator button collapses to an icon-only 🧮 below
  `sm:`, the mark-for-review + prev/next/submit row stacks vertically on
  mobile (`flex-col sm:flex-row`) with full-width buttons
- Admin course/ad list rows: `flex-col sm:flex-row` + `truncate` +
  `min-w-0` to prevent long names from pushing action buttons off-screen
- Auth pages: reduced top margin at the base breakpoint so the form isn't
  pushed below the fold on short phone viewports
- Landing page CTAs stack vertically on mobile, full-width

---

## 8. Ad flyer recommended sizes (also shown live in the admin panel)

| Placement | Size | Notes |
|---|---|---|
| Background watermark (during quiz) | 1000×1000px (1:1 square) | PNG/WEBP, transparent OK, shown at 6% opacity — keep under 300KB |
| Result screen banner | 1200×480px (2.5:1 landscape) | `object-cover`, center important content, edges may crop, <400KB |
| Dashboard carousel | 1200×600px (2:1 landscape) | Same crop behavior, <400KB |

---

## 9. Full file/route map

```
free-cbt/
├── README.md                                    # tech stack rationale, roadmap
├── database/schema.sql                          # full Postgres schema (source of truth)
├── database/seed.sql                            # optional sample data, not required
├── lib/
│   ├── faculties.ts                             # FUTA faculty/department data
│   ├── require-admin.ts                         # is_admin guard helper for API routes
│   └── supabase/{client,server}.ts              # browser + server(+admin) Supabase clients
├── middleware.ts                                # route protection incl. /admin is_admin check
├── components/
│   ├── Navbar.tsx
│   ├── Spinner.tsx
│   ├── SearchableSelect.tsx                     # type-to-search, list-only dropdown
│   ├── SemesterCourseModal.tsx                  # course picker, add/remove, search
│   ├── DashboardAdCarousel.tsx                  # auto-rotating dashboard ads
│   ├── QuizEngine.tsx                           # core quiz UI, both modes
│   ├── Calculator.tsx
│   ├── AdWatermark.tsx / AdResultBanner.tsx
│   └── ResultView.tsx                           # score + topic breakdown + mistakes review
├── app/
│   ├── page.tsx                                 # public landing page
│   ├── layout.tsx / globals.css
│   ├── (auth)/login/page.tsx
│   ├── (auth)/register/page.tsx
│   ├── dashboard/page.tsx (server) + DashboardClient.tsx (client)
│   ├── admin/page.tsx (server guard) + AdminClient.tsx (client UI)
│   ├── quiz/[courseId]/practice/page.tsx
│   ├── quiz/[courseId]/exam/page.tsx
│   └── api/
│       ├── quiz/start/route.ts                  # generates a randomized/balanced question set
│       ├── quiz/check-answer/route.ts           # practice-mode instant feedback (mode-gated)
│       ├── quiz/submit/route.ts                 # scores + builds mistakes review
│       ├── courses/[courseId]/topics/route.ts   # topic list + per-topic question counts
│       ├── ads/active/route.ts                  # Redis-cached active-ads-by-placement
│       ├── admin/courses/route.ts               # CRUD for courses
│       ├── admin/ads/route.ts                   # ad create (with Storage upload) + toggle
│       ├── admin/settings/route.ts              # generic key-value settings CRUD
│       ├── admin/reset-semester/route.ts
│       └── questions/bulk-upload/route.ts       # two-phase CSV/XLSX validate+commit
└── public/logo.svg, logo-mark.svg
```

---

## 10. Outstanding / not yet done (known gaps)

1. **RLS on `quiz_attempts`** still lets a student read their own
   `attempt_questions` (with answers) directly via the Supabase client,
   ahead of actually answering. Not exploited by the app's own UI, but a
   real gap for a determined student. Fix: Postgres view/RPC that strips
   `correct_option`/`explanation` for direct reads.

2. **No in-app way to promote a second admin** — manual Table Editor edit
   only.

3. **No course-creation validation against duplicate/near-duplicate
   course codes** beyond the DB's unique constraint on `code`.

4. Local dev `.env.local` / Upstash Redis / Supabase Storage bucket
   (`ad-flyers`, public) all need to exist for full functionality —
   these are infra setup steps, not code.

---

## 11. If picking this up in a new chat

Good opening moves:
1. Confirm the SQL migrations in §5 have actually been run.
2. Ask what they want to work on next, or pick up any items in §10.
