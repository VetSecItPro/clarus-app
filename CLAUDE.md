# Vajra Truth Checker

## Tech Stack
- **Framework**: Next.js (App Router)
- **Database**: Supabase/Postgres
- **Auth**: Supabase Auth
- **Payments**: Stripe
- **AI**: OpenRouter
- **Scraping**: Firecrawl, Supadata
- **Hosting**: Vercel
- **Production URL**: https://infosecops.io

## Quick Commands

### Vercel (use CLI, not MCP)
```bash
vercel env pull .env.vercel --yes   # Pull env vars
vercel --prod                        # Deploy production
vercel list                          # View deployments
```

### Database (use psql, not Supabase CLI)
```bash
PGPASSWORD="UI5MeSG65Igmcuh7" psql "postgres://postgres.dxyfpehucygiughjmiek:UI5MeSG65Igmcuh7@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "YOUR_SQL_HERE"
```

### Migrations (via psql)
```bash
PGPASSWORD="UI5MeSG65Igmcuh7" psql "$POSTGRES_URL" -f migrations/filename.sql
```

### Run Locally
```bash
pnpm install && pnpm dev
```

## DB Tables
users, content, content_ratings, chat_threads, chat_messages, summaries, active_chat_prompt, active_summarizer_prompt

## Git Workflow (Feature Branch + PR)

**NEVER push directly to main.** Always use feature branches:

1. **Create feature branch**: `git checkout -b feature/short-description`
2. **Make changes and commit**:
   ```bash
   git add -A
   git commit -m "feat: description

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
   ```
3. **Push feature branch**: `git push origin feature/short-description`
4. **Create PR**: `gh pr create --title "..." --body "..."`
5. **CI runs on PR** → lint, typecheck, build, E2E, Lighthouse
6. **Review & merge** → After approval, merge to main
7. **Deploy** → Vercel auto-deploys on merge to main

### Branch Naming
- `feature/...` - New features
- `fix/...` - Bug fixes
- `refactor/...` - Code refactoring
- `docs/...` - Documentation updates

## Workflow Rules
- **Always explain what you're doing before doing it** - User wants to understand actions before they're taken
- **Always create a todo list for any task** - Turn every request into a todo list and implement items one by one so progress can be tracked
- Delete dead/unused code when found
- Run typecheck before committing

## Notes
- Vercel MCP broken (403) → use `vercel` CLI
- Supabase MCP wrong project → use `psql` direct
- GitHub CLI works: `gh`
