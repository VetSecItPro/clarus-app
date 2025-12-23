# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Vajra is a content truth-checking and curation application built with Next.js 15 and Supabase. Users can save content (YouTube videos, articles, X/Twitter posts) for processing, get AI-generated summaries, rate content with a signal scoring system, and discover community-rated content.

The application features subscription-based access via Stripe, with auth handled through Supabase Auth.

## Development Commands

### Package Manager
This project uses `pnpm` as the package manager (evidenced by `pnpm-lock.yaml`).

### Core Development Commands
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

### Running the Application
The app runs on `http://localhost:3000` by default. Ensure all environment variables are configured before starting.

## Environment Configuration

Required environment variables (see `.env`):
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **AI/LLM**: `OPENROUTER_API_KEY` (for content summarization and chat)
- **Content Processing**: `SUPADATA_API_KEY` (YouTube metadata/transcripts), `FIRECRAWL_API_KEY` (article scraping)

## Architecture Overview

### High-Level Architecture

**Three-Layer Architecture:**
1. **Presentation Layer** (`app/`, `components/`) - Next.js App Router with React Server Components and Client Components
2. **API Layer** (`app/api/`) - Next.js API routes handling business logic
3. **Data Layer** - Supabase (PostgreSQL) with Row Level Security (RLS)

**Data Flow Pattern:**
```
User Action → Client Component → API Route → Supabase/External APIs → Database
                                    ↓
                          OpenRouter (AI Summaries)
                          Supadata (YouTube)
                          Firecrawl (Articles)
```

### Core Application Flow

**Content Processing Pipeline:**
1. User pastes URL from clipboard or inputs manually
2. Client creates placeholder entry in `content` table
3. API route `/api/process-content` orchestrates:
   - **YouTube**: Fetches metadata (Supadata), fetches transcript (Supadata)
   - **Articles/X Posts**: Scrapes content (Firecrawl, with URL transformation for X posts)
   - **All types**: Generates AI summary via OpenRouter using prompt from `active_summarizer_prompt` table
4. Summary stored in `summaries` table, linked to content
5. User rates content (signal_score 1-5), stored in `content_ratings` table
6. Rated content appears in user's "Brain" and community "Feed"

### Database Schema (Key Tables)

- **users**: User accounts with subscription status (`active`, `trialing`, `grandfathered`, `canceled`, `none`)
- **content**: Main content table with URL, type (`youtube`|`article`|`pdf`|`x_post`), metadata, `full_text`, and `user_id`
- **summaries**: AI-generated summaries with `mid_length_summary`, linked to content
- **content_ratings**: User ratings (signal_score 1-5) for content
- **active_summarizer_prompt**: System/user prompts and model config for summarization
- **active_chat_prompt**: System prompt and model config for chat feature
- **chat_threads** & **chat_messages**: Chat functionality (per-content discussions)

### Authentication & Authorization

**Pattern**: Higher-Order Component (HOC) wrapper
- `components/with-auth.tsx` wraps all protected pages
- Checks Supabase session on component mount
- Verifies subscription status (`active`, `trialing`, or `grandfathered` required)
- Redirects to `/login` if unauthenticated, `/pricing` if no valid subscription
- Public paths: `/login`, `/signup`, `/forgot-password`, `/update-password`, `/pricing`

### Key Component Patterns

**Modal Pattern**: Used for settings and add-content workflows
- `add-url-modal.tsx` - Manual URL input fallback
- `edit-ai-prompts-modal.tsx` - Admin-style prompt editing for summarizer/chat models
- `glassmorphic-settings-button.tsx` - Main settings modal with user profile, AI config, subscription management

**List/Grid Pattern**: Content display with filtering
- `content-grid.tsx` - Main content display component
- `brain-list.tsx` & `brain-list-item.tsx` - Rated content display
- `filter-sort-bar.tsx` - Reusable filtering UI

**Chat Pattern**: Content-specific AI chat
- `chat-panel.tsx` - Streaming chat interface using Vercel AI SDK
- API route `/api/chat` uses `streamText` with content's `full_text` as context

### External API Integration

**Content Processing APIs** (`app/api/process-content/route.ts`):
- **Supadata.ai**: YouTube video metadata and transcripts
  - Endpoint: `https://api.supadata.ai/v1/youtube/video` (metadata)
  - Endpoint: `https://api.supadata.ai/v1/youtube/transcript` (transcript)
  - Retry logic: 3 attempts with 1s delay
- **Firecrawl**: Web scraping for articles
  - Endpoint: `https://api.firecrawl.dev/v0/scrape`
  - Retry logic: 5 attempts with 2s delay
  - X/Twitter URL transformation: `x.com` → `fixupx.com`, `twitter.com` → `fxtwitter.com`
- **OpenRouter**: AI summarization and chat
  - Endpoint: `https://openrouter.ai/api/v1/chat/completions`
  - JSON response parsing with markdown code block extraction fallback
  - Default model: `anthropic/claude-3.5-sonnet`

**Error Handling**: All APIs use retry logic with exponential backoff. Errors stored as `PROCESSING_FAILED::{TYPE}::{message}` in `full_text` field.

### Utility Functions (`lib/utils.ts`)

- `cn()`: Tailwind class merging (clsx + tailwind-merge)
- `getYouTubeVideoId()`: Extracts video ID from YouTube URLs (handles `youtu.be`, `/watch?v=`, `/shorts/`)
- `isXUrl()`: Detects X/Twitter URLs
- `isPdfUrl()`: Detects PDF URLs
- `getDomainFromUrl()`: Extracts domain from URL
- `formatDuration()`: Formats seconds to `HH:MM:SS` or `MM:SS`

### Supabase Client Pattern

**Singleton Pattern** (`lib/supabase.ts`):
- `getSupabaseClient()`: Returns singleton browser client
- `supabase`: Direct export for backward compatibility
- Typed with generated types from `types/database.types.ts`

**Server-side**: API routes create fresh client with service role key via `createClient()`

## Important Implementation Notes

### TypeScript Configuration
- Path alias: `@/*` maps to project root
- Strict mode enabled
- Build errors ignored in `next.config.mjs` (ESLint and TypeScript) - be cautious when making changes

### Database Migrations
SQL migration scripts are in `scripts/` directory, numbered sequentially (`001-`, `002-`, etc.). These define:
- RLS policies
- Postgres functions (e.g., `get_brain_tags()`, `get_library_tags()`, `get_feed_tags()`)
- Schema changes

Apply migrations directly to Supabase via SQL editor or CLI.

### Content Type Detection
Content type is determined from URL during clipboard processing:
- YouTube: `getYouTubeVideoId()` returns non-null
- X Post: `isXUrl()` returns true
- Default: `article`

### AI Prompt Management
Prompts are stored in database tables (`active_summarizer_prompt`, `active_chat_prompt`) with single row (id=1). This allows runtime prompt modification without code changes. Edit via settings modal in UI.

### Subscription Gate
All main features require active subscription. Check `withAuth.tsx` for subscription status enforcement logic. Free users redirected to `/pricing`.

### Styling
- **Framework**: Tailwind CSS 4.x with custom dark theme
- **UI Library**: Radix UI primitives + shadcn/ui patterns
- **Theme**: Dark mode enforced (`className="dark"` on html element)
- **Colors**: Brand blue `#1d9bf0`, glassmorphic elements with `bg-white/[0.06]`

## Testing

No test framework is currently configured in this project. When adding tests, ensure you configure test environment variables separately and use a test Supabase project.

## Deployment

This project is deployed on Vercel and synced with v0.dev. Changes pushed from v0.dev automatically deploy via Vercel integration.

**Deployment URL**: https://vercel.com/minhyeong112s-projects/v0-vajra-pt1

## Key Files Reference

- `app/page.tsx` - Home page with clipboard URL processing
- `app/item/[id]/page.tsx` - Individual content detail view with chat
- `app/library/page.tsx` - User's saved content (unrated)
- `app/feed/page.tsx` - Community-rated content discovery
- `app/api/process-content/route.ts` - Content processing orchestration
- `app/api/chat/route.ts` - Streaming chat API
- `components/with-auth.tsx` - Authentication HOC
- `lib/supabase.ts` - Supabase client configuration
- `types/database.types.ts` - Generated Supabase types
