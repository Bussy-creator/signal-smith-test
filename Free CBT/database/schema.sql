-- =========================================================
-- FREE CBT — Postgres schema (Supabase-compatible)
-- =========================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- USERS / PROFILES
-- Supabase Auth owns auth.users (email, password hash, id).
-- This table extends it with app-specific profile data.
-- ---------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null,
  student_id      text unique,              -- Matric/Reg Number
  phone           text not null,
  faculty         text not null,
  department      text not null,
  level           smallint not null check (level in (100,200,300,400,500,600)),
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_profiles_department_level on profiles(department, level);

-- ---------------------------------------------------------
-- ACADEMIC STRUCTURE
-- ---------------------------------------------------------
create table courses (
  id              uuid primary key default uuid_generate_v4(),
  code            text unique not null,       -- e.g. 'MTS 101'
  title           text not null,
  department      text not null,
  level           smallint not null check (level in (100,200,300,400,500,600)),
  semester        smallint not null check (semester in (1,2)),
  created_at      timestamptz not null default now()
);
create index idx_courses_dept_level on courses(department, level);

create table topics (
  id              uuid primary key default uuid_generate_v4(),
  course_id       uuid not null references courses(id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now(),
  unique(course_id, name)
);

-- Which course(s) a student is offering THIS semester.
-- Wiped (soft-reset) by admin at the start of each new semester.
create table user_course_enrollment (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  course_id       uuid not null references courses(id) on delete cascade,
  is_active       boolean not null default true,
  enrolled_at     timestamptz not null default now(),
  unique(user_id, course_id)
);
create index idx_enrollment_active on user_course_enrollment(user_id, is_active);

-- ---------------------------------------------------------
-- QUESTION BANK
-- ---------------------------------------------------------
create table questions (
  id                uuid primary key default uuid_generate_v4(),
  course_id         uuid not null references courses(id) on delete cascade,
  topic_id          uuid not null references topics(id) on delete cascade,
  question_text     text not null,
  option_a          text not null,
  option_b          text not null,
  option_c          text not null,
  option_d          text not null,
  correct_option    char(1) not null check (correct_option in ('A','B','C','D')),
  explanation       text,
  content_hash      text not null,   -- sha256 of normalized question_text, dedup on bulk upload
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now()
);
-- Denormalized course_id speeds up "balanced pull across topics for course X"
create index idx_questions_course_topic on questions(course_id, topic_id);
create unique index idx_questions_dedup on questions(course_id, content_hash);

-- ---------------------------------------------------------
-- QUIZ ATTEMPTS
-- Deliberately denormalized (JSONB) — see README §3 for rationale:
-- avoids a write-storm of per-question rows at exam-start peak.
-- ---------------------------------------------------------
create table quiz_attempts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  course_id           uuid not null references courses(id),
  mode                text not null check (mode in ('practice','exam')),
  topic_ids           uuid[] default '{}',         -- populated for practice mode topic filter
  attempt_questions   jsonb not null,               -- [{question_id, options order, correct_option}]
  attempt_answers     jsonb not null default '{}',  -- {question_id: {answer, time_spent_seconds, flagged}}
  score               numeric(5,2),
  topic_breakdown     jsonb,                         -- {topic_id: {correct, total}}
  started_at          timestamptz not null default now(),
  submitted_at        timestamptz,
  time_limit_seconds  integer,
  auto_submitted      boolean not null default false
);
create index idx_attempts_user_course on quiz_attempts(user_id, course_id);
create index idx_attempts_leaderboard on quiz_attempts(course_id, score desc) where mode = 'exam';

-- ---------------------------------------------------------
-- ADVERTISEMENTS (monetization engine)
-- ---------------------------------------------------------
create table advertisements (
  id              uuid primary key default uuid_generate_v4(),
  sponsor_name    text not null,
  flyer_image_url text not null,
  target_link     text,
  placement       text not null check (placement in ('watermark','result_banner','dashboard')),
  is_active       boolean not null default true,
  start_at        timestamptz not null default now(),
  end_at          timestamptz,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create index idx_ads_active_placement on advertisements(placement, is_active, start_at, end_at);

-- ---------------------------------------------------------
-- BULK UPLOAD AUDIT LOG (traceability for admin imports)
-- ---------------------------------------------------------
create table bulk_upload_jobs (
  id              uuid primary key default uuid_generate_v4(),
  course_id       uuid references courses(id),
  uploaded_by     uuid references profiles(id),
  filename        text,
  rows_total      integer,
  rows_inserted   integer,
  rows_rejected   integer,
  error_report    jsonb,
  status          text not null default 'pending' check (status in ('pending','validated','committed','failed')),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY (sketch — enable + refine per table)
-- ---------------------------------------------------------
alter table profiles enable row level security;
alter table quiz_attempts enable row level security;
alter table user_course_enrollment enable row level security;

create policy "own profile" on profiles
  for select using (auth.uid() = id);
create policy "insert own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "update own profile" on profiles
  for update using (auth.uid() = id);
create policy "own attempts" on quiz_attempts
  for all using (auth.uid() = user_id);
create policy "own enrollment" on user_course_enrollment
  for all using (auth.uid() = user_id);

-- Admins bypass via service-role key on the server (bulk upload, ad manager,
-- course creation, semester reset) rather than client-side RLS bypass
-- policies.

-- ---------------------------------------------------------
-- RLS on course/content tables
--
-- Previously these four tables had RLS OFF entirely, meaning any request
-- carrying the anon/authenticated key could read AND write them directly
-- via the Supabase client library — including reading `correct_option`
-- straight out of `questions`, bypassing the app's quiz flow completely,
-- and writing arbitrary courses/ads without going through an admin check.
--
-- courses/topics/advertisements: readable by any logged-in student (not
-- sensitive), but only writable via the service-role key used in the
-- /api/admin/* routes — no INSERT/UPDATE/DELETE policy is defined for the
-- authenticated role, so those are denied by default.
--
-- questions/bulk_upload_jobs: NO policy at all, for any command, for the
-- anon/authenticated roles. Only the service-role key (which bypasses RLS)
-- can touch these — used in /api/quiz/start (question pool fetch),
-- /api/questions/bulk-upload, and /api/quiz/submit's grading logic.
-- ---------------------------------------------------------
alter table courses enable row level security;
alter table topics enable row level security;
alter table advertisements enable row level security;
alter table questions enable row level security;
alter table bulk_upload_jobs enable row level security;

create policy "read courses" on courses
  for select using (true);
create policy "read topics" on topics
  for select using (true);
create policy "read active ads" on advertisements
  for select using (true);
-- No policies on questions or bulk_upload_jobs for anon/authenticated —
-- this is intentional. Access is service-role only.

-- ---------------------------------------------------------
-- APP SETTINGS
-- Generic key/value store for admin-editable site variables (starting
-- with the "can't find your course? message us" support phone number).
-- Readable by anyone (students need to see the support number); writable
-- only via the service-role key in /api/admin/settings.
-- ---------------------------------------------------------
create table app_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);
alter table app_settings enable row level security;
create policy "read settings" on app_settings
  for select using (true);

insert into app_settings (key, value) values ('support_phone', '');
