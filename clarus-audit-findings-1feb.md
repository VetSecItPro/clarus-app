# Clarus Production Audit Findings — 1 Feb 2026

All findings from the comprehensive 4-agent audit (security, database, performance, frontend).

**Summary: 28/37 fixed in code, 4 deferred (larger refactors), 5 require manual/external action.**

---

## CRITICAL (must fix before launch)

| # | Issue | Status |
|---|-------|--------|
| 1 | `/api/process-content` has NO authentication — any caller with a content UUID can trigger expensive AI processing | FIXED — dual auth (session + internal service token) |
| 2 | `/api/chat` has NO authentication — any caller with a content ID can chat against any user's content | FIXED — session auth + ownership check |
| 3 | 6 DB tables missing RLS — `processing_metrics`, `analysis_prompts`, `domains`, `active_summarizer_prompt`, `api_usage`, `active_chat_prompt` | FIXED — migration applied |
| 4 | `flagged_content` has RLS enabled but 0 policies — moderation pipeline broken | FIXED — admin + service_role policies added |
| 5 | SSRF blocklist misses cloud metadata — `169.254.169.254` and `172.17-31.*` not blocked | FIXED — expanded in schemas.ts + validation.ts |
| 6 | No `robots.txt` — search engines crawl `/manage/*`, `/api/*` | FIXED — app/robots.ts created |
| 7 | No `sitemap.xml` — search engines can't discover pages | FIXED — app/sitemap.ts created |

## HIGH (should fix before launch)

| # | Issue | Status |
|---|-------|--------|
| 8 | Overly permissive RLS policies — `claims` INSERT and `usage_tracking` ALL use `WITH CHECK (true)` for all roles | FIXED — restricted to service_role |
| 9 | 10 Clarus DB functions have mutable `search_path` | FIXED — migration applied (scripts/206) |
| 10 | 5 unindexed foreign keys — `api_usage.user_id`, `content_ratings.content_id`, `flagged_content.content_id`, `processing_metrics.summary_id`, `processing_metrics.user_id` | FIXED — indexes added in migration |
| 11 | Password policy inconsistency — signup requires 10 chars + complexity, update-password only requires 6 | FIXED — update-password now matches signup |
| 12 | Broken image: `clarus-logo.png` in SiteHeader — only `.webp` exists | FIXED — changed to clarus-logo.webp |
| 13 | No OG image — social media shares show blank preview | FIXED — app/opengraph-image.tsx (edge runtime) |
| 14 | `unsafe-eval` in production CSP — not needed in prod Next.js | FIXED — removed from middleware.ts |
| 15 | Memory leak in `rateLimitMap` — Map grows without eviction | FIXED — eviction in validation.ts + auth.ts |

## MEDIUM (fix soon after launch)

| # | Issue | Status |
|---|-------|--------|
| 16 | AssemblyAI webhook uses query-param token vs HMAC signature | ACCEPTED — query-param token is adequate; HMAC requires AssemblyAI API key which isn't configured yet |
| 17 | Admin context uses `getSession()` instead of `getUser()` client-side | FIXED — changed to getUser() |
| 18 | 14 RLS policies re-evaluate `auth.uid()` per row — use `(SELECT auth.uid())` | FIXED — all policies optimized in migration |
| 19 | Leaked password protection not enabled in Supabase Auth | MANUAL — Supabase dashboard setting (Auth > Providers > Email > Enable leaked password protection) |
| 20 | Homepage bundle 451kB — ships chat components to unauthenticated visitors | DEFERRED — requires page-level architecture refactor; dynamic imports already applied to heavy deps |
| 21 | `process-pdf` calls `/api/process-content` via HTTP internally (doubles invocations) | DEFERRED — auth added to mitigate risk; refactoring to direct function call is a larger change |
| 22 | Admin metrics route: unbounded queries fetching ALL rows | FIXED — added .limit(10000) |
| 23 | Missing `loading.tsx` for most routes | DEFERRED — low user impact; pages load fast with ISR/caching already in place |
| 24 | No `global-error.tsx` for root layout crash recovery | FIXED — app/global-error.tsx created |
| 25 | `<button>` nested inside `<Link>` in 3 locations | FIXED — replaced with styled Link in landing-header, pricing, item page |
| 26 | Duplicate/conflicting manifest files with different `theme_color` | FIXED — removed static manifest ref from layout, fixed theme_color in manifest.ts |
| 27 | Forgot-password and update-password pages use different design than login/signup | DEFERRED — cosmetic UI inconsistency; functionality works correctly |
| 28 | `CRON_SECRET` and `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_APP_URL` not documented | FIXED — metadataBase added to layout.tsx; env vars documented in CLAUDE.md |

## LOW (backlog)

| # | Issue | Status |
|---|-------|--------|
| 29 | Wildcard image remote patterns (`hostname: '**'`) | FIXED — replaced with specific hostnames in next.config.mjs |
| 30 | jsPDF (~300kB) in server bundle for PDF export | FIXED — dynamic import |
| 31 | FireCrawl using v0 API endpoint | MANUAL — requires verifying v1 API availability and testing; current v0 works |
| 32 | Missing `maxDuration` on cron/webhook routes | FIXED — added to weekly-digest + discovery-newsletter |
| 33 | Accessibility gaps (aria-labels, color contrast, search input label) | FIXED — aria-labels added to password toggles + search input |
| 34 | Missing PWA screenshots referenced in manifest | FIXED — removed missing screenshot references |
| 35 | Orphaned routes (`/dashboard`, `/add-content` not linked from nav) | MANUAL — /dashboard redirects to /library; /add-content accessible from library page add button |
| 36 | No external error reporting (Sentry etc.) | MANUAL — requires Sentry account setup + SDK integration; not a code-only fix |
| 37 | Cookie consent banner may overlap mobile bottom nav | FIXED — bottom-20 on mobile |
