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
