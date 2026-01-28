# Clarus

AI-powered content analysis and fact-checking.

## Tech Stack
- **Framework**: Next.js (App Router)
- **Database**: Supabase/Postgres
- **Auth**: Supabase Auth
- **Payments**: Stripe
- **AI**: OpenRouter
- **Scraping**: Firecrawl, Supadata
- **Hosting**: Vercel
- **Production URL**: https://clarusapp.io

## Quick Commands

### Vercel (MCP connected)
Use MCP tools for Vercel operations:
- `mcp__vercel__list_projects` - List projects
- `mcp__vercel__list_deployments` - View deployments
- `mcp__vercel__deploy_to_vercel` - Deploy project
- Team ID: `team_HFUTBVxI8jKYi334LvgVsVNh` (VetSecItPro)

Fallback CLI (if MCP unavailable):
```bash
vercel env pull .env.vercel --yes   # Pull env vars
vercel --prod                        # Deploy production
```

### Database (MCP connected)
Use MCP tools for Supabase operations:
- `mcp__supabase__list_tables` - List all tables
- `mcp__supabase__execute_sql` - Run queries
- `mcp__supabase__apply_migration` - Apply DDL migrations
- `mcp__supabase__get_logs` - Debug issues
- Project ref: `dxyfpehucygiughjmiek`

Fallback psql (if MCP unavailable):
```bash
PGPASSWORD="UI5MeSG65Igmcuh7" psql "postgres://postgres.dxyfpehucygiughjmiek:UI5MeSG65Igmcuh7@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "YOUR_SQL_HERE"
```

### Run Locally
```bash
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm install && pnpm dev
```

### Shell Commands (Claude Code)
Since nvm isn't loaded in Claude Code's shell, always prefix pnpm commands with:
```bash
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm <command>
```
Examples:
- `export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm typecheck`
- `export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm lint`
- `export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm build`

## DB Tables
users, content, content_ratings, chat_threads, chat_messages, summaries, active_chat_prompt, active_summarizer_prompt, analysis_prompts, domains

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
- Vercel MCP: ✅ Connected (team_HFUTBVxI8jKYi334LvgVsVNh)
- Supabase MCP: ✅ Connected (dxyfpehucygiughjmiek)
- GitHub CLI works: `gh`
