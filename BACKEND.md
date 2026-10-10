# Course-Specific AI Learning Assistant backend

This document describes the **Node.js API** in `server/`: how it starts, who can call what, how data is stored, and how the learning agent, RAG, planner, and voice features work.

The same process serves:

1. The **tRPC API** used by the staff website (`client/`) and the student Expo app (`mobile/`)
2. A few **plain HTTP** routes (health, file upload, speech-to-text)
3. In development, the **Vite** staff web app on the same port

Students do not talk to a separate backend. Both clients call this server.

---

## 1. Role in the product

| Client | Who | How they call the API |
|--------|-----|------------------------|
| `client/` (React) | Lecturers and admins | tRPC over HTTP, `Authorization: Bearer <JWT>` |
| `mobile/` (Expo) | Students (`role = user`) | Same tRPC URL (`EXPO_PUBLIC_API_URL` + `/api/trpc`) |

The Course-Specific AI Learning Assistant is designed to run with **SQLite** on disk, **Groq** for chat generation, and `@xenova/transformers` for local embeddings. LM Studio is not required.

---

## 2. How to run it

From the repo root (after `pnpm install` and a `.env` based on `.env.example`):

```bash
pnpm dev
```

That runs `tsx watch server/_core/index.ts` with `NODE_ENV=development`. Default port is **3000**. If 3000 is busy, the server walks up to the next free port and logs it.

Set `GROQ_API_KEY` (and optionally `GROQ_MODEL`) in `.env`. Internet access is required for AI generation.

Useful scripts:

| Script | Purpose |
|--------|---------|
| `pnpm dev` | API + Vite staff UI |
| `pnpm test` | Vitest (agent, calendar, LLM helpers, …) |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle SQL migrations |
| `pnpm start` | Production: `node dist/index.js` after `pnpm build` |

---

## 3. Process and HTTP surface

Entry: [`server/_core/index.ts`](server/_core/index.ts).

```
Mobile / web
    │  Bearer JWT
    ▼
Express (CORS *, JSON up to 50mb)
    ├── GET  /health
    ├── POST /api/storage/put     authenticated raw file body
    ├── GET  /uploads/...         static files under data/uploads
    ├── POST /api/voice/transcribe  JSON { audioBase64, mimeType }
    ├── /api/trpc/*               tRPC (superjson)
    └── Vite or static client/    staff website
```

The server listens on `0.0.0.0` so phones on the LAN can reach it. CORS allows any origin and the `ngrok-skip-browser-warning` header for tunnels.

`JWT_SECRET` must be at least 16 characters or the process **refuses to start**.

---

## 4. Authentication and roles

### JWT

[`server/_core/sdk.ts`](server/_core/sdk.ts) signs and verifies sessions with `jose`. Login / signup / Google return `{ token, user }`. Clients send:

```http
Authorization: Bearer <token>
```

tRPC context ([`server/_core/context.ts`](server/_core/context.ts)) calls `sdk.authenticateRequest`. Missing/invalid tokens yield `ctx.user = null` for public procedures, and **UNAUTHORIZED** for protected ones.

Banned users (`users.isBanned`) cannot authenticate.

### Procedure guards

Defined in [`server/_core/trpc.ts`](server/_core/trpc.ts):

| Procedure | Who |
|-----------|-----|
| `publicProcedure` | Anyone (login, signup, health-style auth) |
| `protectedProcedure` | Any signed-in user |
| `studentProcedure` | `role === "user"` only |
| `lecturerProcedure` | `role === "lecturer"` |
| `adminProcedure` | `role === "admin"` |

Student study APIs (planner, submissions, general Ask AI history, notifications) use `studentProcedure` so staff cannot call them even if they know the procedure name.

### How accounts are created

| Method | Router | Role |
|--------|--------|------|
| Admin creates account | `admin.createUser` (`role: "user" \| "lecturer"`, needs `users.create`) | student or lecturer |
| Google ID token | `auth.google` | sign-in only for an existing account; unknown emails are refused (web/mobile client id checked) |
| Password reset | `auth.forgotPassword` / `auth.resetPassword` | token in DB; email via Resend if configured, else a **server console** URL |

There is no public self-registration: only an admin can create student and lecturer accounts (web Admin → Users or the mobile admin Users tab).

Passwords are stored as scrypt hashes (`server/_core/localAuth.ts`). Google verification is in `server/_core/googleAuth.ts`.

---

## 5. tRPC API map

All procedures live on `appRouter` in [`server/routers.ts`](server/routers.ts), plus [`server/lecturerRouter.ts`](server/lecturerRouter.ts). Clients import the same `AppRouter` type.

### `auth`

`me`, `signup`, `login`, `google`, `logout`, `savePushToken` (student Expo token), `updateProfile`, `changePassword`, `forgotPassword`, `resetPassword`.

### `documents`

List / search / get / favourite / create / `createOwn` (student upload) / delete. Text extraction and RAG indexing run after upload (see §8). Access is checked with `canAccessDocument` (owner, public, or enrolled course material).

### `chat`

- `history({ documentId })` — document thread
- `send({ documentId, message })` — **main AI entry**

`documentId === 0` is **Ask AI** (no document). History goes to `generalChatMessages`. Otherwise the message is stored on `chatMessages`.

Flow inside `chat.send`:

1. Slash commands on a **real document** (`/summary`, `/flashcards`, `/quiz`) still go through `documentAiService` (old path).
2. Everything else (including Ask AI) goes through **`runLearningAgent`**.

### `summary` / `flashcards` / `quizzes`

Generate and persist AI study objects for a document. Flashcards use SM-2 (`server/sm2.ts`: due cards, ratings). Quizzes: generate, fetch, `submitQuiz`.

### `progress` / `studySessions`

Per-document and aggregate stats, streaks, study time. Sessions: start / end / recent.

### `planner` (students)

| Procedure | What it does |
|-----------|----------------|
| `today` | Daily goals + tasks; also fires due calendar reminders |
| `calendar` | Events in a date range |
| `createEvent` / `deleteEvent` | Manual calendar items |
| `generatePlan` | Builds a structured revision timetable from a natural-language request |
| `updateGoal` | Daily minutes / flashcards / quizzes targets |

Planner **and** the agent calendar intent both use [`server/calendar.ts`](server/calendar.ts): parse exam date, build day-by-day phases, optional Groq refine, save `calendarEvents`, format a Day 1…n reply.

### `assignments` (students)

`submit`, `mySubmission`, `mySubmissionsForCourse`.

### `studentCourses`

Enroll by course code, list courses, materials, announcements, quizzes, assignments.

### `lecturer`

Dashboard stats; list/update assigned courses (create/delete are admin-only); students (enroll/remove/progress); materials (upload + generate quiz/flashcards/summary); assignments (create, grade, templates, missing work); announcements; analytics; course quizzes.

### `admin`

Users (list, ban, role, password reset, delete), **create courses and assign lecturers**, academic metrics, operations (including retry failed document processing), communications (announcements), **append-only audit logs**, system performance. Course materials stay with the lecturer. Admin actions that change people or allocations write `adminAuditLogs`.

### `generalChat`

`history` / `clear` for Ask AI.

### `notifications`

In-app inbox: list, unread count, mark read.

### `system`

Internal / platform helpers (`server/_core/systemRouter.ts`).

---

## 6. Learning agent

Folder: [`server/agent/`](server/agent/).

The assistant uses a **bounded Groq tool-calling agent**. Groq chooses tools; TypeScript still **executes** them and enforces course/document authorization.

```
chat.send
    ▼
classifyLearningIntent(message)     (logging / session label)
    ▼
runAgenticToolLoop                 server/agent/agentLoop.ts
    │  Groq + tools (max 4 rounds / 4 tool calls)
    ▼
executeAgentTool                   server/agent/tools.ts
    │  (JWT access checks + RAG + DB)
    ▼
canned UI message  or  Groq final answer
    ▼
log agentSessions + agentToolRuns
```

### Intents

`qa`, `study_session`, `quiz`, `flashcards`, `summary`, `progress`, `assignment`, `calendar`, `general`.

Intent is still classified for session logging and canned replies (quiz/flashcards/summary/timetable). Tool selection is done by Groq.

Quiz / flashcards / summary **require a document id**. Ask AI (`documentId = 0`) will tell the student to open a document for those actions.

### Tools (whitelist exposed to Groq)

| Tool | Purpose |
|------|---------|
| `searchCourseMaterial` | RAG across enrolled/owned course files |
| `getMaterialContext` | RAG on one document |
| `generateSummary` | Persist summary |
| `generateQuizDraft` | Persist quiz |
| `generateFlashcards` | Persist cards |
| `getLearningProgress` | Stats for grounding |
| `createStudyPlan` | Suggested study actions |
| `recordStudyActivity` | Progress write |
| `getAssignmentContext` | Upcoming work / rubric |
| `listCalendarEvents` | Existing timetable |
| `createStudyTimetable` | Build + save exam/study plan from natural language |

Each tool checks document/course access (`server/agent/access.ts`). Students only see enrolled course materials.

### Calendar path

For `calendar` intent the orchestrator gathers progress/plan/list tools, then **always** builds drafts in `proposeCalendarDrafts` (structured days + optional 12s LLM refine) and `saveCalendarPlan`. The user-facing text is `formatStudyPlanReply` (sessions numbered by start time).

### Persistence

- `agentSessions` — last intent / provider / request id per user  
- `agentToolRuns` — tool name, success, duration, retrieval count  

Tests: `server/agent/*.test.ts`, `server/chat.agent.test.ts`, `server/calendar.test.ts`.

---

## 7. LLM layer

[`server/_core/llm.ts`](server/_core/llm.ts) `invokeLLM` routes through the **Groq-only AI service** ([`server/ai/service.ts`](server/ai/service.ts)):

- Sole provider: **Groq** (OpenAI-compatible API).
- Required env: `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-20b`).
- Shared RAG context is built in [`server/llmUtils.ts`](server/llmUtils.ts) / [`server/rag/`](server/rag/) **before** Groq is called.
- Optional: `GROQ_TIMEOUT_MS`, `AI_RATE_LIMIT_PER_MINUTE`.
- LM Studio is **not** required and is not used for chat generation.

```
Chat / RAG
    ↓
AiService (Groq)
    ↓
AI Response
```

The agent calls `generateAgentText` in [`server/agent/llmProvider.ts`](server/agent/llmProvider.ts). Quiz/flashcard JSON generation for documents goes through [`server/llmUtils.ts`](server/llmUtils.ts) and [`server/documentAiService.ts`](server/documentAiService.ts).

---

## 8. RAG (retrieval-augmented generation)

[`server/rag/`](server/rag/):

1. Extract text from PDF / DOCX / PPTX (`documentAiService`, `officeparser`, `pdf-parse`).
2. Chunk (`chunkText.ts`).
3. Embed with **Xenova/all-MiniLM-L6-v2** (384-d, local, LRU cache) — `embeddings.ts`.
4. Store a flat cosine index as JSON: `data/vectorstores/doc-<id>.json`.
5. Query: embed the question, over-fetch, Jaccard dedup, return top chunks with scores.

The agent refuses to invent course-specific answers when retrieval is empty (`INSUFFICIENT_COURSE_CONTEXT`).

---

## 9. Database

- Engine: **SQLite** via **libSQL** + **Drizzle ORM**
- File: `DATABASE_URL` (default `file:./data/app.db`)
- Schema: [`drizzle/schema.ts`](drizzle/schema.ts)
- SQL migrations: `drizzle/0009_*.sql` … `0015_calendar_events.sql` plus journal
- **Also** on connect, `server/db.ts` runs defensive SQL in `server/migrations/` (`addSm2Fields`, `addNewFeatureTables`, `addAdminOperations`) so older local DBs gain columns/tables without a manual migrate

### Main tables

| Table | Role |
|-------|------|
| `users` | Accounts, role, ban, avatar, Expo push token |
| `documents` | Files, extraction text, `courseId`, processing status |
| `chatMessages` | Per-document chat |
| `generalChatMessages` | Ask AI |
| `documentSummaries` | AI summaries |
| `flashcards` | Cards + SM-2 fields |
| `quizzes` / `quizQuestions` | Quizzes |
| `progressTracking` / `studySessions` / `learningGoals` | Study stats and daily goals |
| `courses` / `courseEnrollments` | Classes |
| `assignments` / `assignmentSubmissions` / `assessmentTemplates` | Coursework |
| `announcements` | Lecturer notices |
| `notifications` | In-app + data payload for push |
| `calendarEvents` | Exam/study timetable + reminder minutes |
| `agentSessions` / `agentToolRuns` | Agent audit |
| `adminAuditLogs` / `systemEvents` | Admin / ops |
| `passwordResetTokens` | Reset flow |

Query helpers: [`server/queries.ts`](server/queries.ts), [`server/lecturerQueries.ts`](server/lecturerQueries.ts), [`server/calendar.ts`](server/calendar.ts).

---

## 10. Files and voice

### Uploads

`POST /api/storage/put?key=...` writes bytes under `data/uploads/` after JWT auth and path sanitisation ([`server/_core/uploads.ts`](server/_core/uploads.ts)). Public URL is `/uploads/<key>`. Avatars, course files, and student documents all use this.

### Speech-to-text

`POST /api/voice/transcribe` ([`server/voice.ts`](server/voice.ts)):

1. If the payload is WAV, run **Xenova/whisper-tiny.en** locally (first use downloads the model).

Used by the Expo app when on-device speech recognition is not available.

Text-to-speech is **on the phone** (`expo-speech`), not this server.

### Calendar reminders

`dispatchDueCalendarReminders` (called from `planner.today` / `planner.calendar`) writes `notifications` and optional Expo push when an event’s `reminderMinutes` window is due. The **phone** also schedules local notifications from the same event list.

---

## 11. Folder map (`server/`)

```
server/
├── _core/           Express entry, env, JWT SDK, tRPC init, LLM, Google auth, uploads
├── agent/           Learning agent (agentic Groq loop, tools, tests)
├── rag/             Chunk, embed, flat vector index
├── migrations/      Runtime SQLite ALTER/CREATE for older DBs
├── routers.ts       Main tRPC router
├── lecturerRouter.ts
├── db.ts            Drizzle + libSQL
├── queries.ts / lecturerQueries.ts
├── calendar.ts      Study plans + calendar CRUD + reminder dispatch
├── documentAiService.ts
├── llmUtils.ts
├── sm2.ts
├── voice.ts
└── documentAccess.ts
```

Shared types/constants: `shared/`.

---

## 12. Request examples

Login (public):

```http
POST /api/trpc/auth.login
Content-Type: application/json

{"json":{"email":"student@example.com","password":"********"}}
```

Ask AI (student JWT):

```http
POST /api/trpc/chat.send
Authorization: Bearer <jwt>
Content-Type: application/json

{"json":{"documentId":0,"message":"Create a 5-day study plan for my GIS exam on 25 September at 9am"}}
```

tRPC uses **superjson**, so dates may be wrapped in `{ json, meta }` rather than raw ISO strings. The web and mobile clients already encode this; do not copy-paste raw `curl` unless you match that format.

---

## 13. Environment (backend-relevant)

See [`.env.example`](.env.example).

| Variable | Meaning |
|----------|---------|
| `JWT_SECRET` | Required. Signs Bearer tokens |
| `DATABASE_URL` | SQLite URL, default `file:./data/app.db` |
| `PORT` | Default 3000 |
| `GROQ_API_KEY` | Required for AI. Server-only Groq API key |
| `GROQ_MODEL` | Default `openai/gpt-oss-20b` |
| `GROQ_BASE_URL` | Default `https://api.groq.com/openai/v1` |
| `GROQ_TIMEOUT_MS` | Default `60000` |
| `AI_RATE_LIMIT_PER_MINUTE` | Default `30` per authenticated user |
| `APP_URL` | Password-reset links |
| `RESEND_API_KEY` / `PASSWORD_RESET_FROM` | Optional email |
| `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_IDS` | Google Sign-In |
| `BUILT_IN_FORGE_*` | Optional legacy Forge helpers (storage/maps); not used for chat |

---

## 14. Design limits (honest)

- One Node process: not scaled out; SQLite is local-file.
- The agent uses a **bounded Groq tool-calling loop** (max 4 rounds / 4 tool calls). Tool executors still enforce course/document authorization in TypeScript.
- RAG is a **flat JSON index**, not a hosted vector DB.
- Slash commands on documents bypass the new agent and use `documentAiService`.
- Speech-to-text quality depends on a first-time download of `whisper-tiny.en` for WAV uploads.
- Do not commit `data/app.db`, `data/uploads/`, or `.env`.

This backend is the whole server-side of the final-year system: **auth, courses, RAG study tools, a bounded learning agent, and a student planner**.
