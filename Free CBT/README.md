# Free CBT

A high-performance Computer-Based Testing platform for university students —
practice quizzes, full exam simulations, topic-level analytics, and an
admin-managed monetization layer, built to comfortably serve ~8,000
concurrent students during exam-period spikes.

---

## 1. Tech Stack & Why It Handles 8,000 Concurrent Users Cheaply

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + React + TypeScript** | Server Components mean the dashboard/quiz shell renders on the server and ships minimal JS. Static pages (landing, course lists) are edge-cached; only the live quiz view is a client component. |
| Styling | **Tailwind CSS** | Zero runtime cost, tiny production CSS, fast to iterate. |
| Hosting | **Vercel (frontend) + Supabase (backend)** | Vercel's edge network absorbs read-heavy traffic (course lists, dashboards, ad flyers) via CDN caching — most of your 8,000 users are *reading*, not writing, at any instant. You pay for compute only on cache misses. |
| Database | **Supabase Postgres (managed) + PgBouncer connection pooling** | Postgres handles relational integrity (questions ↔ topics ↔ courses ↔ attempts) properly. Supabase gives you pooled connections out of the box (transaction mode), which is the #1 thing that kills Postgres under concurrency — without pooling, 8,000 clients opening direct connections will exhaust `max_connections` in seconds. With PgBouncer, thousands of logical clients share a small pool (e.g. 60–100) of real DB connections. |
| Auth | **Supabase Auth (JWT-based)** | Handles email/password + student ID as a custom claim, issues short-lived JWTs verified at the edge — no DB round-trip per request to check "is this user logged in." |
| File uploads (bulk questions, ad flyers) | **Supabase Storage** | S3-compatible, CDN-fronted, no server disk to manage. |
| Realtime/cache layer | **Upstash Redis (serverless)** | Caches "active ads," "leaderboards," and "question pool for course X" so exam-day traffic mostly hits Redis, not Postgres. Read-locks / lock contention on `questions` during peak exam start times is the single biggest risk at 8,000 concurrent users — Redis removes that hot path from the DB entirely. |
| Background jobs | **Supabase Edge Functions / Vercel Cron** | Bulk-upload validation, leaderboard recomputation, semester-reset cleanup run off the request path. |

### Why this avoids "lag or database read locks" specifically
1. **No read locks on `questions` during exams**: exam question sets are
   generated once per course per semester (or cached per course+level) into
   Redis as a pre-shuffled pool; each student's individual randomized paper
   is derived client-seeded from that cached pool, not a fresh `SELECT ...
   ORDER BY random()` per student (that query is the classic Postgres killer
   at scale — it does a full table scan + sort per request).
2. **Connection pooling** (PgBouncer, transaction mode) means 8,000
   concurrent students never map to 8,000 Postgres connections.
3. **Read replicas are optional, not required**, because most of the read
   volume (course lists, dashboards, ads) is served from Next.js's ISR cache
   or Redis, not the primary DB.
4. **Writes are the only thing that must hit Postgres directly** (submitting
   an answer, finishing an attempt) and those are small, indexed,
   single-row writes — cheap even under load.
5. **Cost**: Vercel Pro + Supabase Pro + Upstash free/starter tier
   comfortably covers this traffic pattern (bursty, exam-week peaks, not
   sustained) for a fraction of what a hand-rolled Kubernetes cluster would
   cost — appropriate for a Nigerian-university-scale project.

### Alternative considered
`Node.js + Express + Prisma` on a VPS was considered but rejected as the
default: you'd be manually reimplementing connection pooling, CDN caching,
and edge auth that Next.js + Supabase + Vercel give you for free. It remains
a fine choice if you outgrow the serverless model later — the Prisma schema
in `/database/schema.sql` is written in plain SQL so it's portable either
way.

---

## 2. Project Structure

```
free-cbt/
├── database/
│   ├── schema.sql          # full Postgres schema (see section 3)
│   └── seed.sql            # sample courses/topics/questions for local dev
├── app/
│   ├── (auth)/login/        register/
│   ├── dashboard/           # smart recommendations + "what course this semester" modal
│   ├── quiz/[courseId]/practice/
│   ├── quiz/[courseId]/exam/
│   ├── admin/                # ad manager, bulk upload, semester reset
│   └── api/
│       ├── questions/bulk-upload/route.ts
│       ├── ads/active/route.ts
│       ├── quiz/submit/route.ts
│       └── admin/reset-semester/route.ts
├── components/
│   ├── QuizEngine.tsx        # timer, flagging, randomization, offline sync
│   ├── Calculator.tsx        # standard/scientific toggle
│   ├── AdWatermark.tsx       # background flyer during quiz
│   └── AdResultBanner.tsx    # post-result promo card
├── lib/supabase/{client,server}.ts
└── public/logo.svg
```

---

## 3. Database Schema

See `database/schema.sql`. Key design decisions:
- `questions.topic_id` + `questions.course_id` are both stored (denormalized)
  so exam-mode "balanced distribution across topics" is a single indexed
  query, not a join-heavy one.
- `quiz_attempts` stores the **generated question set + student's answers as
  JSONB** (`attempt_questions`, `attempt_answers`) rather than a normalized
  join table — this is deliberate: it avoids N-row inserts per attempt
  (8,000 students × 50 questions = 400,000 row-writes at exam start, which
  is exactly the write-storm you want to avoid) and keeps the write to a
  single row per submission event.
- `user_course_enrollment` is the "what are you offering this semester"
  table, wiped by the admin's semester-reset action (soft reset: sets
  `is_active = false` rather than deleting, so historical analytics
  survive).
- `advertisements` has `placement` (`watermark` | `result_banner` |
  `dashboard`) and `is_active` + date range, so the ad engine query is a
  single indexed `WHERE is_active AND now() BETWEEN start_at AND end_at`.

---

## 4. Bulk Upload & Ad Engine

Implemented in:
- `app/api/questions/bulk-upload/route.ts` — parses CSV/XLSX (via
  `papaparse` / `xlsx`), validates every row (missing fields, invalid
  correct-answer letter, duplicate question hash) **before** touching the
  database, returns a structured error report, and only commits on a
  second "confirm" call once the admin has seen the validation report.
- `app/api/ads/active/route.ts` — fetches active ads per placement, cached
  in Redis for 60s so ad-serving never becomes a DB bottleneck even though
  every single quiz session calls it.

---

## 5. Step-by-Step MVP Roadmap

**Phase 0 — Foundations (Week 1)**
1. Create Supabase project, run `database/schema.sql`, enable Row Level
   Security (RLS) policies (students can only read/write their own
   attempts; admin role bypasses via a `is_admin` claim).
2. Scaffold Next.js app, wire Supabase Auth (email/password + student ID as
   a profile field, not a separate login method, to keep auth simple).
3. Build registration form → `profiles` table (name, department, level,
   matric number).

**Phase 1 — Content pipeline (Week 2)**
4. Build the admin bulk-upload UI + API (this unblocks everything else —
   you need question data before quiz mode is testable).
5. Seed 2–3 real courses (MTS 101, PHY 101) with 100+ questions each to
   test the exam-generation logic at realistic scale.

**Phase 2 — Quiz engine (Week 3–4)**
6. Practice mode: topic picker → `QuizEngine` in untimed mode.
7. Exam mode: balanced-distribution question puller (cached in Redis per
   course), countdown timer, auto-submit, randomized question/option order
   (seeded per-attempt so a refresh doesn't reshuffle).
8. Submission → scoring → topic breakdown, written in a single
   `quiz_attempts` row.

**Phase 3 — Dashboard intelligence (Week 5)**
9. "What course are you offering this semester" modal on first login of a
   semester (driven by `user_course_enrollment` being empty/reset).
10. Recommendation logic: weakest-topic and lowest-score courses surfaced
    first, using a simple SQL aggregate (no ML needed at this stage).

**Phase 4 — Monetization + polish (Week 6)**
11. Ad manager admin UI (upload flyer, set target link/placement/dates,
    toggle active).
12. Watermark + result-screen ad integration.
13. Leaderboards, "time per question" analytics, offline local-storage
    answer backup, calculator, dark mode.

**Phase 5 — Load-test & harden (Week 7)**
14. Simulate 8,000 concurrent exam-start requests (k6/Artillery) against
    the Redis-cached question-pull path; confirm no Postgres connection
    exhaustion; tune PgBouncer pool size and Vercel function concurrency.
15. Add DB indexes flagged by `EXPLAIN ANALYZE` on the slow paths found
    during the load test.

---

## 6. Admin Semester Reset

`app/api/admin/reset-semester/route.ts` sets every row in
`user_course_enrollment` to `is_active = false` (never deletes). On next
login, the dashboard sees "no active enrollment for current semester" and
shows the "What are you offering this semester?" course-picker modal again
— exactly the behavior requested.
