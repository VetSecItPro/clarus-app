# Clarus

AI-powered content analysis for clarity and understanding.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | Supabase / Postgres (`clarus` schema) |
| Auth | Supabase Auth (Email + Google OAuth) |
| Payments | Polar |
| AI | OpenRouter (Gemini 2.5 Flash) |
| Scraping | Firecrawl (articles), Supadata (YouTube) |
| Transcription | AssemblyAI (podcasts, speaker diarization) |
| Search | Tavily (web search for AI context) |
| Email | Resend |
| Hosting | Vercel |
| Error Monitoring | Sentry |

## Quick Start

```bash
git clone https://github.com/VetSecItPro/clarus-app.git
cd clarus-app
cp .env.example .env.local
# Fill in your environment variables
pnpm install
pnpm dev
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. See `.env.example` for all required variables, organized by service (Supabase, OpenRouter, Firecrawl, Polar, Resend, Sentry, etc.).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm typecheck` | Run TypeScript type-checking |
| `pnpm lint` | Run ESLint |

## Project Structure

```
app/            Routes, layouts, API routes
components/     Shared React components
lib/            Utilities, hooks, data access
public/         Static assets
scripts/        Database migration SQL files
supabase/       Supabase configuration and migrations
```

## Database

All Clarus tables live in the `clarus` schema, isolated from other projects sharing the same Supabase instance. The database `search_path` is configured so queries resolve to `clarus.*` automatically without explicit schema prefixes in application code.

### Migration Scripts

Run these in order for initial setup:

1. `scripts/100-create-clarus-schema.sql` -- Creates the `clarus` schema and sets `search_path`
2. `scripts/000-full-schema.sql` -- Creates all tables in the `clarus` schema
3. `scripts/023-add-fulltext-search.sql` -- Full-text search indexes
4. Additional numbered migration scripts as needed

Ongoing migrations are managed in `supabase/migrations/`.

## License

All Rights Reserved.
