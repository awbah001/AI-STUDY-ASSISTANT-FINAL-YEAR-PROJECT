# Course-Specific AI Learning Assistant

Final-year project: an AI study platform with a **web portal** and a **mobile app**, both for students, lecturers and admins.

| Who | Where | What they do |
|-----|--------|----------------|
| **Lecturers & admins** | Web app in `client/` (`http://localhost:3000`) or Expo app in `mobile/` | Courses, students, assessments, moderation (the mobile app covers the day-to-day subset) |
| **Students** | Web app in `client/` or Expo app in `mobile/` | Documents, RAG chat, flashcards, quizzes, planner |

Do **not** treat Capacitor (`android/`, `ios/`, `pnpm cap:*`) as the student product. Those shells wrap the shared web UI. The dedicated student mobile product remains Expo.

## Features

- Document upload (PDF/DOCX/PPTX) and local RAG (chunk → embed → retrieve)
- AI chat, summaries, flashcards (SM-2), quizzes
- Lecturer courses, enrollments, assignments, announcements
- Admin users, content, operations, communications, audit
- Local email/password auth with **Bearer JWT**, plus **Google Sign-In** (all roles on web, students on mobile)

## Tech stack

| Layer | Technology |
|-------|-----------|
| Web | React 19, TypeScript, Tailwind CSS v4, tRPC |
| Student app | Expo / React Native (`mobile/`) |
| API | Node.js, Express, tRPC |
| Database | SQLite via Drizzle ORM |
| LLM | Groq (cloud). Required: `GROQ_API_KEY` |
| Embeddings | `@xenova/transformers` (local) |
| Vector store | Flat index JSON under `data/vectorstores/` |

**Backend detail:** [BACKEND.md](BACKEND.md) — HTTP routes, tRPC map, auth roles, learning agent, RAG, database, voice, and environment.

## Project structure

```
├── client/          # Web portal (students + lecturers + admins)
├── mobile/          # Student Expo app
├── server/          # Express + tRPC API (see BACKEND.md)
├── shared/          # Types and constants
├── drizzle/         # Schema and SQL migrations
├── data/            # SQLite DB, uploads, vector stores
├── android/, ios/   # Optional Capacitor wrap of the shared web UI
├── BACKEND.md       # Full backend architecture
```

## Getting started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A `JWT_SECRET` of at least 16 characters (required; the server will not start without it)

### Installation

```bash
pnpm install
cp .env.example .env   # then edit secrets
```

### Environment

See `.env.example`. Important variables:

- `JWT_SECRET` — signs session tokens (`Authorization: Bearer …`)
- `PORT` — API + web, default **3000**
- `GROQ_API_KEY` / `GROQ_MODEL` — required for AI chat, flashcards, quizzes, summaries
- `APP_URL` + `RESEND_API_KEY` — optional password-reset email
- `VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_ID` — Google Sign-In (same Web client ID)

Student app: `mobile/.env` with `EXPO_PUBLIC_API_URL` (Android emulator: `http://10.0.2.2:3000`) and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

### Database

```bash
pnpm db:migrate
```

(`pnpm db:push` still runs generate + migrate; prefer `db:generate` then `db:migrate`.)

### Run

```bash
pnpm dev
```

Web/API: **http://localhost:3000**

Student app (second terminal):

```bash
cd mobile
npx expo start
```

Everyone signs in at `/login` (or in the mobile app). There is no self-registration: an admin creates student and lecturer accounts from Admin → Users (web or mobile) and shares the sign-in details. Google sign-in only works for emails that already have an account.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | API + web (Vite) |
| `pnpm build` / `pnpm start` | Production |
| `pnpm test` | Server unit tests |
| `pnpm check` | TypeScript |
| `pnpm db:generate` | Generate Drizzle SQL |
| `pnpm db:migrate` | Apply migrations |
| `pnpm cap:*` | Capacitor sync of the shared web UI (not the student app) |

## License

MIT

### Student web workspace

Students sign in at `/login` with the same account used in Expo; the account is created by an admin. The student landing page is `/student/dashboard`. New accounts complete academic, course and learning-preference onboarding. The responsive navigation includes courses, library, AI tutor, flashcards, quizzes, study planner, progress and notifications. Course and document deep links use `/course/:id` and `/document/:id`. Student screens use the same tRPC procedures and database as mobile; staff APIs retain their role checks.


## Privacy and request protection

Local `/uploads/` files now check authentication and document, enrollment, assignment,
or submission permissions before serving bytes. Published avatars and course artwork
remain public only when their paths belong to the publishing account. Generated decks
inherit document access; narrated videos remain private to their student.

Web links and mobile file-opening actions request opaque, file-specific access tickets
valid for five minutes. Session JWTs are never included in these URLs. File requests
check current account and resource permissions again. Browser previews use a short-lived,
HttpOnly cookie scoped to `/uploads`; signing out clears it.

The admin API rate-limit setting now takes effect. Independent protections apply to
login (10 attempts per account per 15 minutes), password-reset requests (5 per account
per 15 minutes), uploads (20 per client address per minute), and transcription (10 per
client address per minute). Auth endpoints also limit attempts per address. Unauthorized
upload/audio requests are rejected before their bodies are buffered, and uploaded bytes
are checked against the configured upload size.

Counters and file tickets are process-local: this configuration targets a single API
process. Multiple replicas require shared counter/ticket storage or sticky routing.
When deploying behind a known reverse proxy, set `TRUST_PROXY_HOPS` to its exact hop
count so client-address limits use the correct address; the default trusts no proxy.

## Regression checks

Use the declared pnpm package manager:

```bash
pnpm check
pnpm check:mobile
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The server suite creates separate empty fixture databases under ignored `tmp/`; it does
not copy student data or open `data/app.db`. Browser tests cover the student journey
(login, course material, sourced chat, flashcard review), slow responses, denied material,
and connection recovery at desktop, phone and tablet sizes. They use synthetic API
fixtures; real HTTP authorization is covered by server tests. They do not call a live AI
provider. Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Chrome instead of the
Playwright browser download.

Native mobile smoke coverage lives in `mobile/.maestro/student-study.yaml`. Install
Maestro and an Expo development build on a connected Android device/emulator, point it
at an isolated test backend, then run `maestro test` with runtime values for
`STUDENT_EMAIL`, `STUDENT_PASSWORD`, `COURSE_TITLE`, and `MATERIAL_TITLE`.
The dedicated student account needs completed onboarding, an enrolled course, a processed
material and existing flashcards. The flow sends one AI question and marks one flashcard
reviewed; use test data. Run from `mobile/`, or use `pnpm test:journey` there once Maestro
is configured. Native execution requires a device and is separate from browser coverage.
