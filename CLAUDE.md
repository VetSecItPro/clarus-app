# Clarus

AI-powered content analysis for clarity and understanding.

---

## CRITICAL: Supabase Database Isolation Rules

> **THIS IS MANDATORY. VIOLATING THESE RULES WILL BREAK OTHER PROJECTS.**

### Supabase Project Info
- **Project ID**: `srqmutgamvktxqmylied`
- **Project URL**: `https://srqmutgamvktxqmylied.supabase.co`
- **MCP**: Configured in `.mcp.json`

### Isolation Rules

**This Supabase project is SHARED with other applications.** Clarus is reusing an existing Supabase instance to avoid additional costs.

| Rule | Description |
|------|-------------|
| **DO NOT TOUCH** | Any tables that already exist and are NOT listed in the Clarus schema below |
| **DO NOT LINK** | Never create foreign keys to tables outside the Clarus schema |
| **DO NOT QUERY** | Never SELECT, INSERT, UPDATE, or DELETE from non-Clarus tables |
| **DO NOT DROP** | Never drop or alter tables that aren't part of Clarus |

### Clarus Schema Tables

All Clarus tables live in the **`clarus` schema** (not the `public` schema):

```sql
clarus.users
clarus.content
clarus.content_ratings
clarus.chat_threads
clarus.chat_messages
clarus.summaries
clarus.hidden_content
clarus.domains
clarus.api_usage
clarus.processing_metrics
clarus.active_chat_prompt
clarus.active_summarizer_prompt
clarus.analysis_prompts
```

**Code doesn't need prefixes** - the search_path is configured so `SELECT * FROM users` automatically resolves to `clarus.users`.

### What To Do If You See Other Tables

If you connect to this Supabase project and see tables like `users`, `content`, `sm_content`, `aws_course_memory`, or any other tables:
1. **IGNORE THEM COMPLETELY**
2. They belong to other projects
3. Do not reference them in any code, queries, or migrations
4. Pretend they don't exist

---

## Links & Resources

| Resource | URL | Status |
|----------|-----|--------|
| **Production** | https://clarusapp.io | Pending DNS setup |
| **GitHub Repo** | https://github.com/VetSecItPro/clarus-app | ✅ Active |
| **Vercel Project** | TBD - needs new project | ❌ Needs setup |
| **Supabase Project** | https://supabase.com/dashboard/project/srqmutgamvktxqmylied | ✅ Shared instance |

---

## Services to Configure

### 1. Domain (Hostinger)
- **Domain**: clarusapp.io
- **Status**: ✅ Purchased
- **Action**: Configure DNS to point to Vercel after project setup

### 2. GitHub
- **Repo**: https://github.com/VetSecItPro/clarus-app
- **Status**: ✅ Complete
- **Env vars needed**: None (public repo)

### 3. Vercel (Hosting)
- **Dashboard**: https://vercel.com/dashboard
- **Status**: ❌ Needs new project
- **Actions**:
  1. Create new project linked to VetSecItPro/clarus-app
  2. Add custom domain clarusapp.io
  3. Configure environment variables (see below)
- **Env var**: None for Vercel itself

### 4. Supabase (Database + Auth)
- **Dashboard**: https://supabase.com/dashboard/project/srqmutgamvktxqmylied
- **Project ID**: `srqmutgamvktxqmylied`
- **Status**: ✅ Using shared instance
- **⚠️ CRITICAL**: This is a SHARED Supabase project. See "Database Isolation Rules" at the top of this file.
- **Actions**:
  1. ~~Create new Supabase project~~ (REUSING EXISTING - tables must use `clarus_` prefix)
  2. Run `scripts/000-full-schema.sql` to create Clarus tables (with `clarus_` prefix)
  3. Run `scripts/000b-insert-prompts.sql` to seed AI prompts
  4. Run `scripts/023-add-fulltext-search.sql` for search
  5. Enable Google OAuth in Auth settings
  6. Configure email templates
- **Env vars needed**:
  - `NEXT_PUBLIC_SUPABASE_URL` - `https://srqmutgamvktxqmylied.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (from Supabase dashboard)
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (from Supabase dashboard)

### 5. OpenRouter (AI/LLM)
- **Dashboard**: https://openrouter.ai/settings/keys
- **Status**: ❌ Needs API key
- **Actions**:
  1. Create OpenRouter account
  2. Add credits ($20-50 to start)
  3. Generate API key
- **Env var**: `OPENROUTER_API_KEY`

### 6. Polar (Payments)
- **Dashboard**: https://polar.sh/dashboard
- **Status**: ❌ Needs account (NOT ACTIVE YET)
- **Actions**:
  1. Create Polar account
  2. Create organization
  3. Create product "Clarus Pro" with monthly ($4) and annual ($29) variants
  4. Set up webhook endpoint: `https://clarusapp.io/api/polar/webhook`
  5. Get access token from Settings → Developers
- **Env vars needed**:
  - `POLAR_ACCESS_TOKEN` - Access token
  - `POLAR_WEBHOOK_SECRET` - Webhook signing secret
  - `POLAR_ORGANIZATION_ID` - Organization ID
  - `POLAR_PRODUCT_MONTHLY` - Monthly product ID
  - `POLAR_PRODUCT_ANNUAL` - Annual product ID

### 7. Firecrawl (Web Scraping)
- **Dashboard**: https://www.firecrawl.dev/app
- **Status**: ❌ Needs API key
- **Actions**:
  1. Create Firecrawl account
  2. Get API key (free tier: 500 credits)
- **Env var**: `FIRECRAWL_API_KEY`

### 8. Supadata (YouTube Transcripts)
- **Dashboard**: https://supadata.ai/dashboard
- **Status**: ❌ Needs API key
- **Actions**:
  1. Create Supadata account
  2. Get API key
- **Env var**: `SUPADATA_API_KEY`

### 9. Tavily (Web Search for AI)
- **Dashboard**: https://tavily.com/dashboard
- **Status**: ❌ Needs API key
- **Actions**:
  1. Create Tavily account
  2. Get API key (free tier: 1000 searches/month)
- **Env var**: `TAVILY_API_KEY`

### 10. Resend (Transactional Email)
- **Dashboard**: https://resend.com/emails
- **Status**: ❌ Needs API key
- **Actions**:
  1. Create Resend account
  2. Verify domain clarusapp.io
  3. Get API key
- **Env var**: `RESEND_API_KEY`

---

## All Environment Variables

```env
# Supabase (SHARED INSTANCE - only use clarus_ prefixed tables!)
NEXT_PUBLIC_SUPABASE_URL=https://srqmutgamvktxqmylied.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenRouter (AI)
OPENROUTER_API_KEY=sk-or-...

# Polar (Payments) - NOT ACTIVE YET
POLAR_ACCESS_TOKEN=polar_at_...
POLAR_WEBHOOK_SECRET=...
POLAR_ORGANIZATION_ID=...
POLAR_PRODUCT_MONTHLY=prod_...
POLAR_PRODUCT_ANNUAL=prod_...

# Firecrawl (Web Scraping)
FIRECRAWL_API_KEY=fc-...

# Supadata (YouTube Transcripts)
SUPADATA_API_KEY=...

# Tavily (Web Search)
TAVILY_API_KEY=tvly-...

# Resend (Email)
RESEND_API_KEY=re_...
```

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase/Postgres
- **Auth**: Supabase Auth (Email + Google OAuth)
- **Payments**: Polar (not active yet)
- **AI**: OpenRouter (Claude Sonnet 4, Haiku)
- **Scraping**: Firecrawl (articles), Supadata (YouTube)
- **Search**: Tavily (web search for AI context)
- **Email**: Resend
- **Hosting**: Vercel

---

## Quick Commands

### Run Locally
```bash
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm install && pnpm dev
```

### Shell Commands (Claude Code)
```bash
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm typecheck
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm lint
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm build
```

---

## Database Tables

**⚠️ All Clarus tables live in the `clarus` SCHEMA (not `public`) to avoid conflicts with other projects sharing this Supabase instance.**

```
users                    -- clarus.users (user profiles)
content                  -- clarus.content (analyzed URLs)
summaries                -- clarus.summaries (AI analysis results)
content_ratings          -- clarus.content_ratings (user feedback)
chat_threads             -- clarus.chat_threads (per-content chat)
chat_messages            -- clarus.chat_messages (chat history)
hidden_content           -- clarus.hidden_content (user-hidden items)
domains                  -- clarus.domains (domain statistics)
api_usage                -- clarus.api_usage (API tracking)
processing_metrics       -- clarus.processing_metrics (performance)
active_chat_prompt       -- clarus.active_chat_prompt (chat config)
active_summarizer_prompt -- clarus.active_summarizer_prompt (summarizer config)
analysis_prompts         -- clarus.analysis_prompts (AI prompts)
```

### Migration Scripts (Run in Order)
1. `scripts/100-create-clarus-schema.sql` - **RUN FIRST** - Creates `clarus` schema and sets search_path
2. `scripts/000-full-schema.sql` - Creates all tables in the `clarus` schema
3. `scripts/000b-insert-prompts.sql` - AI prompts data
4. `scripts/023-add-fulltext-search.sql` - Full-text search indexes

**Tables are created in the `clarus` schema. Code references them without prefix (e.g., `users` not `clarus.users`).**

---

## Git Workflow

**NEVER push directly to main.** Always use feature branches:

1. `git checkout -b feature/short-description`
2. Make changes and commit
3. `git push origin feature/short-description`
4. `gh pr create --title "..." --body "..."`
5. CI runs → merge after passing

---

## Workflow Rules

- **Always explain what you're doing before doing it**
- **Always create a todo list for any task**
- Delete dead/unused code when found
- Run typecheck AND lint before committing
- **Fix ALL lint warnings** - no technical debt, whether new or pre-existing
- When you find something broken, fix it immediately
- **Fix lint AND TypeScript errors AND logic errors** - all code must fit together properly
- **Never introduce logic holes or vulnerabilities** - create code that works correctly as a system
- **No `any` types** - use proper TypeScript types always

---

## Payment Integration (Polar)

Polar replaced Stripe on 2026-01-28. Key files:
- `lib/polar.ts` - SDK setup with placeholder product IDs
- `app/api/polar/checkout/route.ts` - Checkout session creation
- `app/api/polar/webhook/route.ts` - Webhook event handling
- `app/api/polar/portal/route.ts` - Customer portal access

Database column: `users.polar_customer_id` (not stripe_customer_id)

---

## Pricing (Locked — Hard Caps, No "Unlimited")

> **These prices and limits are final. Do not change without explicit owner approval.**
> **RULE: No "Unlimited" on any tier. Every feature has a hard cap to prevent abuse.**

| Feature | Free | Starter ($8/mo) | Pro ($16/mo) |
|---------|------|-----------------|--------------|
| Analyses/month | 5 | 50 | 300 |
| Chat messages/content | 10 | 30 | 100 |
| Library items | 25 | 500 | 5,000 |
| Bookmarks | 5 | 50 | 500 |
| Tags | 3 | 50 | 100 |
| Share links/month | 0 | 10 | 100 |
| Exports/month | 0 | 50 | 100 |
| Claim tracking | No | No | Yes |
| Weekly digest | No | Yes | Yes |
| Priority processing | No | No | Yes |

Annual discount: 17% ($80/yr Starter, $160/yr Pro = 2 months free).

**Rules:**
- Do NOT add a Team/Enterprise tier until team features are built
- Do NOT change prices, limits, or feature gating without explicit approval
- Do NOT use the word "Unlimited" anywhere in pricing or marketing
- Pricing page lives at `app/pricing/page.tsx`
- Tier gating logic lives in `lib/tier-limits.ts`

---

## AI Models

> **Switched from Claude (Anthropic) to Gemini 2.5 Flash (Google) on 2026-01-30.**
> **Reason: 7x cheaper per analysis ($0.032 vs $0.225). Quality is adequate for content analysis.**

| Component | Model | Cost (per 1M tokens) |
|-----------|-------|---------------------|
| 6 analysis sections | `google/gemini-2.5-flash` | $0.30 in / $2.50 out |
| Summarizer | `google/gemini-2.5-flash` | $0.30 in / $2.50 out |
| Chat | `google/gemini-2.5-flash` | $0.30 in / $2.50 out |
| Keyword extraction | `google/gemini-2.5-flash-lite` | $0.10 in / $0.40 out |

- Models configured in database (`analysis_prompts`, `active_chat_prompt`, `active_summarizer_prompt`)
- Fallback models in code default to `google/gemini-2.5-flash`
- Legacy Claude pricing kept in `lib/api-usage.ts` for historical cost tracking
- Migration script: `scripts/030-switch-to-gemini-flash.sql`

**Content Safety:** All prompts include mandatory CONTENT_REFUSED guardrails for CSAM, terrorism, weapons manufacturing. Content about politics, conspiracy theories, controversial opinions IS allowed.

**Speaker Attribution:** All analysis prompts attribute claims/arguments to specific speakers by name for video/podcast content. Makes analysis more intimate and useful.

---

## Content Moderation Policy

> **Legal obligation under 18 U.S.C. § 2258A — ESPs must report apparent CSAM to NCMEC.**

- Layer 1: Google Safe Browsing API (URL screening before scrape)
- Layer 2: Keyword screening on scraped text (CSAM/terrorism terms)
- Layer 3: AI model refusal detection (Gemini safety refusals)
- Layer 4: Admin dashboard moderation queue + NCMEC CyberTipline reporting
- All flagged content preserved with legal hold (non-deletable)
- Penalty for not reporting: $150K first offense, $300K subsequent

---

## Clarus Session Work

> **Last Updated**: 2026-01-30 (Session 3)

### Completed

| Task | PR | Status |
|------|-----|--------|
| Security hardening: Zod validation, auth helpers, security headers | #3 | Merged |
| Optimize CI workflow (PR-only triggers, concurrency, combined jobs) | #4 | Merged |
| Add clarus schema isolation for shared Supabase | #5 | Merged |
| Code cleanup, TypeScript fixes, Polar migration | #6 | Merged |
| Configure MCP servers (Vercel, Supabase) | - | Done |
| Dead code cleanup (1,481+ lines) | #13, #14 | Merged |
| Perf: middleware auth bypass, caching, CSS animations, ISR | #15 | Merged |
| Landing page overhaul (hero, features, personas, CTA, SEO) | #17 | Merged |
| Switch AI models to Gemini 2.5 Flash | WIP | In current branch |
| Remove "Unlimited" from all pricing, add hard caps | WIP | In current branch |
| Enhanced AI prompts (speaker attribution + content safety) | WIP | In current branch |
| Landing page honesty (fix pills, persona claims, SEO title) | WIP | In current branch |

### Current Branch

`feature/landing-page-honesty-pricing-caps` — pending PR

### TODO (Not Yet Built)

1. **Content moderation pipeline** — URL screening, keyword scanning, AI refusal handling
2. **NCMEC reporting mechanism** — Automated evidence collection, admin review, CyberTipline filing
3. **Admin dashboard** — User metrics, content analytics, API costs, revenue, moderation queue
4. **Weekly discovery newsletter** — Anonymous content curation, Resend email, /discover page
5. **In-product paywall detection** — Warn users before processing paywalled URLs
6. **SEO content/help articles** — Feature pages for organic search traffic
7. **Podcast transcription** — AssemblyAI or Deepgram integration with speaker diarization
8. **Run database migration** — `scripts/030-switch-to-gemini-flash.sql` on live Supabase
9. **Complete Vercel setup** — Import repo, env vars, custom domain
10. **Set up external services** — OpenRouter credits, Tavily, Firecrawl, Polar

### Notes

- Supabase project ID: `srqmutgamvktxqmylied`
- Tables in `public` schema belong to OTHER projects - DO NOT TOUCH
- All Clarus tables go in the `clarus` schema (search_path handles this automatically)
- Revert point: Commit `f4a62f8` is the baseline before landing page work
