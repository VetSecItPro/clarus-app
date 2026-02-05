# Clarus

AI-powered content analysis for clarity and understanding.

---

## CRITICAL: Supabase Database Isolation Rules

> **THIS IS MANDATORY. VIOLATING THESE RULES WILL BREAK OTHER PROJECTS.**

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
clarus.content_votes
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
clarus.usage_tracking
clarus.claims
clarus.flagged_content
clarus.contact_submissions
clarus.collections
clarus.collection_items
clarus.podcast_subscriptions
clarus.podcast_episodes
clarus.hidden_content
```

**Code doesn't need prefixes** - the search_path is configured so `SELECT * FROM users` automatically resolves to `clarus.users`.

### What To Do If You See Other Tables

If you connect to this Supabase project and see tables like `users`, `content`, `sm_content`, `aws_course_memory`, or any other tables:
1. **IGNORE THEM COMPLETELY**
2. They belong to other projects
3. Do not reference them in any code, queries, or migrations
4. Pretend they don't exist

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase/Postgres
- **Auth**: Supabase Auth (Email + Google OAuth)
- **Payments**: Polar
- **AI**: OpenRouter (Gemini 2.5 Flash)
- **Scraping**: Firecrawl (articles), Supadata (YouTube)
- **Transcription**: AssemblyAI (podcasts, speaker diarization)
- **Search**: Tavily (web search for AI context)
- **Email**: Resend
- **Hosting**: Vercel

---

## Environment Variables

All secrets are managed in `.env.local` (local) and Vercel dashboard (production). See `.env.example` for required variable names. **Never commit actual values.**

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

## Git Workflow

**NEVER push directly to main.** Always use feature branches:

1. `git checkout -b feature/short-description`
2. Make changes and commit
3. `git push origin feature/short-description`
4. `gh pr create --title "..." --body "..."`
5. CI runs → merge after passing

### Parallel Branch Merge Strategy (CRITICAL)

> **Completeness over speed. No code should overwrite other code due to merge ordering.**

When multiple feature branches exist simultaneously:

| Rule | Description |
|------|-------------|
| **Identify shared files** | Before merging, check which files each PR touches. Flag overlapping files (especially `lib/tier-limits.ts`, `types/database.types.ts`, `components/site-header.tsx`, `components/mobile-bottom-nav.tsx`). |
| **Merge docs/tests first** | PRs that only add new files (docs, tests, migrations) have zero conflict risk — merge these first. |
| **Merge isolated features next** | PRs that create new routes/pages without modifying shared files go second. |
| **Merge shared-file PRs last** | PRs that modify shared files (nav, types, tier-limits) go last, with a rebase before each merge. |
| **Rebase before every merge** | After merging PR N, rebase PR N+1 on updated main BEFORE merging. Never merge a stale branch. |
| **Resolve conflicts manually** | When both branches modify the same file, integrate BOTH changes — never accept one side and discard the other. |
| **Verify after each merge** | Pull main after each merge and confirm the build still passes before merging the next PR. |
| **Never remove worktree CWD** | When using git worktrees, always `cd` back to the main repo directory BEFORE removing a worktree. Removing the shell's CWD breaks the entire shell session. |

---

## Workflow Rules

- **Completeness over speed** - it's not about fast execution, it's about fully doing all tasks correctly
- **Always explain what you're doing before doing it**
- **Always create a todo list for any task**
- Delete dead/unused code when found
- Run typecheck AND lint before committing
- **Fix ALL lint warnings** - no technical debt, whether new or pre-existing
- When you find something broken, fix it immediately
- **Fix lint AND TypeScript errors AND logic errors** - all code must fit together properly
- **Never introduce logic holes or vulnerabilities** - create code that works correctly as a system
- **No `any` types** - use proper TypeScript types always
- **Respect dependencies and order of precedence** - when multiple changes touch shared files, merge strategically so nothing gets overwritten

### Context Recovery (Multi-Agent Sessions)

When a session runs out of context mid-fix, check 3 things to resume:
1. **`git diff`** for code changes already made by agents (live in working tree)
2. **`list_migrations`** (Supabase MCP) for DB changes already applied
3. **`.security-audit.json`** for tracking state (which findings are open vs resolved)

The agents' work survives even if the orchestrating session doesn't — changes live in the working tree and database. A new session just needs to verify, fill gaps, and ship.

---

## Payment Integration (Polar)

Key files:
- `lib/polar.ts` - SDK setup
- `app/api/polar/checkout/route.ts` - Checkout session creation
- `app/api/polar/webhook/route.ts` - Webhook event handling
- `app/api/polar/portal/route.ts` - Customer portal access

Database column: `users.polar_customer_id`

---

## Pricing (Locked — Hard Caps, No "Unlimited")

> **These prices and limits are final. Do not change without explicit owner approval.**
> **RULE: No "Unlimited" on any tier. Every feature has a hard cap to prevent abuse.**

| Feature | Free | Starter ($18/mo) | Pro ($29/mo) | Day Pass ($10) |
|---------|------|-----------------|--------------|----------------|
| Analyses/month | 5 | 50 | 150 | 15 (24hr) |
| Podcast analyses/month | 0 | 10 | 30 | 3 (24hr) |
| Chat messages/content | 10 | 25 | 50 | 25 |
| Chat messages/month | 50 | 300 | 1,000 | 100 (24hr) |
| Library items | 25 | 500 | 5,000 | 25 |
| Bookmarks | 5 | 50 | 500 | 10 |
| Tags | 3 | 50 | 100 | 10 |
| Share links/month | 0 | 10 | 100 | 5 (24hr) |
| Exports/month | 0 | 50 | 100 | 10 (24hr) |
| Claim tracking | No | No | Yes | Yes |
| Weekly digest | No | Yes | Yes | No |
| Priority processing | No | No | Yes | No |

Annual discount: up to 33% off ($144/yr Starter saves $72, $279/yr Pro saves $69).

**Rules:**
- Do NOT add a Team/Enterprise tier until team features are built
- Do NOT change prices, limits, or feature gating without explicit approval
- Do NOT use the word "Unlimited" anywhere in pricing or marketing
- Pricing page lives at `app/pricing/page.tsx`
- Tier gating logic lives in `lib/tier-limits.ts`

---

## AI Models

| Component | Model |
|-----------|-------|
| 6 analysis sections | `google/gemini-2.5-flash` |
| Summarizer | `google/gemini-2.5-flash` |
| Chat | `google/gemini-2.5-flash` |
| Keyword extraction | `google/gemini-2.5-flash-lite` |
| Tone detection | `google/gemini-2.5-flash-lite` |

- Models configured in database (`analysis_prompts`, `active_chat_prompt`, `active_summarizer_prompt`)
- Fallback models in code default to `google/gemini-2.5-flash`
- AI prompts are stored in the database, not in the codebase

**Content Safety:** All prompts include mandatory CONTENT_REFUSED guardrails for CSAM, terrorism, weapons manufacturing. Content about politics, conspiracy theories, controversial opinions IS allowed.

---

## Content Moderation Policy

> **Legal obligation under 18 U.S.C. § 2258A — ESPs must report apparent CSAM to NCMEC.**

- Layer 1: Google Safe Browsing API (URL screening before scrape)
- Layer 2: Keyword screening on scraped text (CSAM/terrorism terms)
- Layer 3: AI model refusal detection (Gemini safety refusals)
- Layer 4: Admin dashboard moderation queue + NCMEC CyberTipline reporting
- All flagged content preserved with legal hold (non-deletable)

---

## Migration Scripts (Run in Order)

1. `scripts/100-create-clarus-schema.sql` - Creates `clarus` schema and sets search_path
2. `scripts/000-full-schema.sql` - Creates all tables in the `clarus` schema
3. `scripts/023-add-fulltext-search.sql` - Full-text search indexes
4. Additional numbered migration scripts as needed

**Prompt data is managed directly in the database, not in migration files.**

---

## Notes

- Tables in `public` schema belong to OTHER projects — DO NOT TOUCH
- All Clarus tables go in the `clarus` schema (search_path handles this automatically)

---

## Task Tracking

> **All task tracking lives in `clarus-master-todo-list.md` (gitignored).**
> That file is the single source of truth for what's done, what's pending, and what's planned.
> Always read it at the start of every Claude Code session.
