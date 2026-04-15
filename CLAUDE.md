# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run Vitest unit tests
npm run setup        # Install deps + generate Prisma client + run migrations
npm run db:reset     # Reset SQLite database
```

To run a single test file: `npx vitest run src/lib/__tests__/file-system.test.ts`

## Architecture

UIGen is an AI-powered React component generator. Users chat to describe components; the app calls Claude, which uses tool calls to create/edit files in an in-memory virtual file system, then the result is transpiled and shown live in a sandboxed iframe.

### Request lifecycle

1. User submits a message in `ChatContext` (`lib/contexts/chat-context.tsx`) via the Vercel AI SDK `useChat` hook
2. `POST /api/chat` (`app/api/chat/route.ts`) forwards messages + current file system snapshot to Claude
3. Claude responds with streaming text + tool calls (`str_replace_editor`, `file_manager` — defined in `lib/tools/`)
4. `FileSystemContext` (`lib/contexts/file-system-context.tsx`) intercepts tool call results and mutates the `VirtualFileSystem`
5. `PreviewFrame` (`components/preview/PreviewFrame.tsx`) watches the file system, transpiles JSX via Babel standalone (`lib/transform/jsx-transformer.ts`), and injects output into an iframe's `srcdoc`

### VirtualFileSystem (`lib/file-system.ts`)

All files live in memory — no disk I/O. The class exposes `createFile`, `updateFile`, `deleteFile`, `rename`, `getAllFiles`, plus the text-editor primitives (`view`, `str_replace`, `insert`) that mirror the AI tool API. Projects serialize the file tree to JSON for SQLite persistence.

### AI provider (`lib/provider.ts`)

Automatically selects the real Claude model if `ANTHROPIC_API_KEY` is set; otherwise falls back to `MockLanguageModel` (static example output, caps tool steps at 4). The real path uses prompt caching (`ephemeral`) on the system prompt. `maxTokens` is 10,000 and `maxSteps` is 40.

### Authentication

JWT stored in an HttpOnly cookie (7-day expiry). `lib/auth.ts` is server-only. Server actions (`actions/index.ts`) handle sign-up / sign-in / sign-out. Anonymous users can work without logging in; their work is tracked in browser storage (`lib/anon-work-tracker.ts`) and merged into a real project on account creation.

### Database

Prisma + SQLite (`prisma/dev.db`). Two models: `User` (email + bcrypt password) and `Project` (stores serialized `messages` and `data`/file system as JSON strings). The Prisma client is generated to `src/generated/`.

## Key environment variables

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | Optional — omit to use mock provider |
| `JWT_SECRET` | Defaults to `"development-secret-key"` in dev |

## Path alias

`@/*` resolves to `./src/*` (configured in `tsconfig.json`).

## Testing

Tests use Vitest + jsdom + React Testing Library. Test files live in `__tests__/` subdirectories next to the code they cover. Config is in `vitest.config.mts`.
