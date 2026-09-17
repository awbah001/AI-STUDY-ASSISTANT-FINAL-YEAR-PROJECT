# Cognify (AI Learning Assistant)

Final-year project: an AI study platform with a **staff web portal** and a **student mobile app**.

| Who | Where | What they do |
|-----|--------|----------------|
| **Lecturers & admins** | Web app in `client/` (`http://localhost:3000`) | Courses, students, assessments, moderation |
| **Students** | Expo app in `mobile/` | Documents, RAG chat, flashcards, quizzes, planner |

Do **not** treat Capacitor (`android/`, `ios/`, `pnpm cap:*`) as the student product. Those shells wrap the **staff web UI**. Students use Expo.

## Features

- Document upload (PDF/DOCX/PPTX) and local RAG (chunk → embed → retrieve)
- AI chat, summaries, flashcards (SM-2), quizzes
- Lecturer courses, enrollments, assignments, announcements
- Admin users, content, operations, communications, audit
- Local email/password auth with **Bearer JWT**, plus **Google Sign-In** (staff on web, students on mobile)

## Tech stack

| Layer | Technology |
|-------|-----------|
| Web | React 19, TypeScript, Tailwind CSS v4, tRPC |
| Student app | Expo / React Native (`mobile/`) |
| API | Node.js, Express, tRPC |
| Database | SQLite via Drizzle ORM |
| LLM | Google Gemini and/or local LM Studio (`USE_LOCAL_LLM`) |
| Embeddings | `@xenova/transformers` (local) |
| Vector store | Flat index JSON under `data/vectorstores/` |

## Project structure

```
├── client/          # Staff web portal (lecturers + admins)
├── mobile/          # Student Expo app
├── server/          # Express + tRPC API
├── shared/          # Types and constants
├── drizzle/         # Schema and SQL migrations
├── data/            # SQLite DB, uploads, vector stores
├── android/, ios/   # Optional Capacitor wrap of the staff web UI
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
- `GEMINI_API_KEY` — used when local LLM is off or unavailable
- `USE_LOCAL_LLM` / `LM_STUDIO_*` — local model via LM Studio
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

Staff sign in at `/login`. Students sign up only in the Expo app. Lecturer self-signup remains at `/lecturer/signup` for the project (prefer creating lecturers from Admin → Users in production).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | API + staff web (Vite) |
| `pnpm build` / `pnpm start` | Production |
| `pnpm test` | Server unit tests |
| `pnpm check` | TypeScript |
| `pnpm db:generate` | Generate Drizzle SQL |
| `pnpm db:migrate` | Apply migrations |
| `pnpm cap:*` | Capacitor sync of the **staff** web UI (not the student app) |

## License

MIT
