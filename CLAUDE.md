# Clarus

AI-powered content analysis for clarity and understanding.

## Links & Resources

| Resource | URL | Status |
|----------|-----|--------|
| **Production** | https://clarusapp.io | Pending DNS setup |
| **GitHub Repo** | https://github.com/VetSecItPro/clarusapp | ✅ Active |
| **Vercel Project** | TBD - needs new project | ❌ Needs setup |
| **Supabase Project** | TBD - needs new project | ❌ Needs setup |

---

## Services to Configure

### 1. Domain (Hostinger)
- **Domain**: clarusapp.io
- **Status**: ✅ Purchased
- **Action**: Configure DNS to point to Vercel after project setup

### 2. GitHub
- **Repo**: https://github.com/VetSecItPro/clarusapp
- **Status**: ✅ Complete
- **Env vars needed**: None (public repo)

### 3. Vercel (Hosting)
- **Dashboard**: https://vercel.com/dashboard
- **Status**: ❌ Needs new project
- **Actions**:
  1. Create new project linked to VetSecItPro/clarusapp
  2. Add custom domain clarusapp.io
  3. Configure environment variables (see below)
- **Env var**: None for Vercel itself

### 4. Supabase (Database + Auth)
- **Dashboard**: https://supabase.com/dashboard
- **Status**: ❌ Needs new project
- **Actions**:
  1. Create new Supabase project
  2. Run `scripts/000-full-schema.sql` to create tables
  3. Run `scripts/000b-insert-prompts.sql` to seed AI prompts
  4. Run `scripts/023-add-fulltext-search.sql` for search
  5. Enable Google OAuth in Auth settings
  6. Configure email templates
- **Env vars needed**:
  - `NEXT_PUBLIC_SUPABASE_URL` - Project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key

### 5. OpenRouter (AI/LLM)
- **Dashboard**: https://openrouter.ai/settings/keys
- **Status**: ❌ Needs API key
- **Actions**:
  1. Create OpenRouter account
  2. Add credits ($20-50 to start)
  3. Generate API key
- **Env var**: `OPENROUTER_API_KEY`

### 6. Stripe (Payments)
- **Dashboard**: https://dashboard.stripe.com
- **Status**: ❌ Needs account
- **Actions**:
  1. Create Stripe account
  2. Create product "Clarus Pro" with monthly/annual prices
  3. Set up webhook endpoint: `https://clarusapp.io/api/stripe/webhook`
  4. Get API keys
- **Env vars needed**:
  - `STRIPE_SECRET_KEY` - Secret key
  - `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Publishable key
  - `STRIPE_PRICE_MONTHLY` - Monthly price ID (price_xxx)
  - `STRIPE_PRICE_ANNUAL` - Annual price ID (price_xxx)

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
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenRouter (AI)
OPENROUTER_API_KEY=sk-or-...

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...

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
- **Payments**: Stripe
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

users, content, content_ratings, chat_threads, chat_messages, summaries, active_chat_prompt, active_summarizer_prompt, analysis_prompts, domains

### Migration Scripts
1. `scripts/000-full-schema.sql` - Complete schema (run first)
2. `scripts/000b-insert-prompts.sql` - AI prompts data
3. `scripts/023-add-fulltext-search.sql` - Full-text search indexes

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
- Run typecheck before committing
