# Vajra Truth Checker

## Tech Stack
- **Framework**: Next.js (App Router)
- **Database**: Supabase/Postgres
- **Auth**: Supabase Auth
- **Payments**: Stripe
- **AI**: OpenRouter
- **Scraping**: Firecrawl, Supadata
- **Hosting**: Vercel

## Quick Commands

### Vercel (use CLI, not MCP)
```bash
vercel env pull .env.vercel --yes   # Pull env vars
vercel --prod                        # Deploy production
vercel list                          # View deployments
```

### Database (use psql, not Supabase CLI)
```bash
PGPASSWORD="***REMOVED***" psql "postgres://postgres.***REMOVED***:***REMOVED***@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "YOUR_SQL_HERE"
```

### Migrations (via psql)
```bash
PGPASSWORD="***REMOVED***" psql "$POSTGRES_URL" -f migrations/filename.sql
```

### Run Locally
```bash
pnpm install && pnpm dev
```

## DB Tables
users, content, content_ratings, chat_threads, chat_messages, summaries, active_chat_prompt, active_summarizer_prompt

## Deploying to GitHub

When asked to commit/push to GitHub:
1. `git add -A`
2. `git commit -m "message"` (include Co-Authored-By footer)
3. `git push origin <branch>`
4. CI runs automatically on PR → lint, typecheck, build, E2E, Lighthouse
5. After merge to main → CI runs again → Deploy to Vercel triggers

## Notes
- Vercel MCP broken (403) → use `vercel` CLI
- Supabase MCP wrong project → use `psql` direct
- GitHub CLI works: `gh`
