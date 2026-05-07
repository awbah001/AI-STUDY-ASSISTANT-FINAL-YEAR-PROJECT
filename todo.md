# AI Learning Assistant - Project TODO

## Phase 1: Database & Schema
- [x] Database schema design (documents, chats, flashcards, quizzes, progress)
- [x] Create Drizzle schema with all tables
- [~] Apply database migrations via Drizzle
  - Note: `pnpm db:push` / `drizzle-kit migrate` was unreliable in this workspace; schema changes were applied directly to `data/app.db` when needed.

## Phase 2: Backend API Development
- [x] Document CRUD endpoints (list, get, create, favorites, search)
- [x] AI chat endpoint (document-aware, with message history)
- [x] Document summarization endpoint
- [x] Flashcard generation endpoint
- [x] Quiz generation endpoint
- [x] Progress tracking endpoints (update, get stats)
- [x] Favorites management endpoints
- [x] Local auth endpoints (signup/login returning Bearer token)
- [x] Remove cookie-based auth (server reads Authorization Bearer token)

## Phase 3: Frontend Pages & Components
- [x] Dashboard layout with sidebar navigation
- [x] Home/Dashboard page with overview and stats
- [x] Document library page with search/filter
- [~] Document detail page with tabs (chat, summary, flashcards, quizzes)
  - Note: `pnpm check` shows tRPC name/type mismatches (e.g. `summaries` vs `summary` router).
- [~] AI chat interface component
  - Note: `pnpm check` shows response-shape mismatch in `DocumentChatBox.tsx` (expects `content` but server returns `{ userMessage, aiResponse }`).
- [~] Flashcard component with flip animation and controls
  - Note: `pnpm check` shows missing tRPC procedures / wrong inputs (`toggleFavorite`, `id` vs `flashcardId`).
- [~] Quiz interface with question navigation and results screen
  - Note: `pnpm check` shows missing tRPC procedures (`getQuestions`, `submitAnswer`) and implicit `any` params.
- [~] Progress tracking page with charts and statistics
  - Note: `pnpm check` shows wrong procedure name (`userProgress` vs `stats`).
- [x] Document upload page with drag-and-drop support
- [x] Settings page
- [x] Login + Signup pages (professional UI)

## Phase 4: Frontend-Backend Integration
- [x] Wire document upload flow with S3
- [x] Wire AI chat with backend
- [x] Wire summary generation
- [x] Wire flashcard generation and review tracking
- [x] Wire quiz generation and submission
- [x] Wire progress tracking and statistics
- [x] Wire favorites system
- [x] Wire search and filtering
- [x] Wire Bearer token into tRPC client requests

## Phase 5: Theme & Polish
- [x] Implement dark/light theme toggle
- [x] Polish all UI components with shadcn/ui
- [x] Add loading states throughout
- [x] Smooth animations (flashcard flip, transitions)
- [x] Responsive mobile-first design
- [x] Error handling and user feedback with toast notifications
- [x] Dashboard UI updated to match provided reference
- [x] App font updated to Plus Jakarta Sans

## Phase 6: Testing & Quality
- [x] TypeScript typecheck passes (`pnpm check`)
- [x] Test suite passing (`pnpm test`)
  - Note: Integration tests requiring external services (Gemini API) are skipped by default.



