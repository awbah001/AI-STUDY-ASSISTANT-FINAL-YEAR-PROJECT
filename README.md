# AI Study Assistant

An intelligent study companion built as a final year project. It helps students learn more effectively by combining document management, AI-powered chat, flashcards, quizzes, and progress tracking — all in one platform.

## Features

- **Document Library** — Upload and manage PDF/DOCX study materials
- **AI Chat** — Ask questions about your documents using RAG (Retrieval-Augmented Generation)
- **Flashcards** — Auto-generated and manual flashcards for active recall
- **Quizzes** — AI-generated quizzes based on uploaded content
- **Progress Tracking** — Visual dashboard to monitor your learning progress
- **Admin Panel** — Manage users and content (admin role)
- **Authentication** — Secure local auth with JWT sessions
- **Dark / Light Theme** — Switchable UI theme

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend | Node.js, Express, tRPC |
| Database | SQLite via Drizzle ORM |
| AI / LLM | Google Gemini API |
| Embeddings | `@xenova/transformers` (local) |
| Vector Store | FAISS (flat index, stored as JSON) |
| File Parsing | `pdf-parse`, `officeparser` |
| Auth | JWT (jose), cookie-based sessions |
| Build | Vite, esbuild |

## Project Structure

```
├── client/          # React frontend
│   └── src/
│       ├── pages/   # Route-level page components
│       ├── components/  # Shared UI components
│       └── lib/     # tRPC client, auth helpers, utils
├── server/          # Express + tRPC backend
│   ├── rag/         # RAG pipeline (chunking, embeddings, vector search)
│   └── _core/       # Auth, LLM, storage, routing infrastructure
├── shared/          # Types and constants shared between client and server
├── drizzle/         # Database schema and migrations
└── data/            # SQLite database, uploaded files, vector stores
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone https://github.com/awbah001/AI-STUDY-ASSISTANT-FINAL-YEAR-PROJECT.git
cd AI-STUDY-ASSISTANT-FINAL-YEAR-PROJECT

# Install dependencies
pnpm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key
SESSION_SECRET=your_session_secret
```

### Database Setup

```bash
pnpm db:push
```

### Run in Development

```bash
pnpm dev
```

The app will be available at `http://localhost:5000`.

### Build for Production

```bash
pnpm build
pnpm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build client and server for production |
| `pnpm start` | Run the production build |
| `pnpm test` | Run test suite |
| `pnpm db:push` | Generate and apply database migrations |
| `pnpm check` | TypeScript type checking |

## License

MIT
