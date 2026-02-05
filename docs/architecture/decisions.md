# Architecture Decision Records

This document captures the key technical decisions made in the Clarus codebase, their rationale, the alternatives that were considered, and the trade-offs accepted. It is intended for internal use and acquisition due diligence.

---

## ADR-001: Supabase as Backend

**Status:** Accepted
**Date:** 2024-10 (project inception)
**Context:** Clarus needed a backend with authentication, a relational database, real-time capabilities, and row-level security -- all without the operational overhead of managing infrastructure. The founder was already running other projects (social media tracker, AWS course tool, Steel Motion website) that needed a database, so cost consolidation was a factor.
**Decision:** Use Supabase (hosted Postgres) as the sole backend, sharing a single Supabase instance across multiple projects with schema-level isolation.
**Alternatives Considered:**
- **Firebase** -- NoSQL data model is a poor fit for relational content analysis data (joins across content, summaries, chat threads, usage tracking). Firestore pricing becomes unpredictable at scale due to per-document-read billing.
- **PlanetScale** -- MySQL-based, no built-in auth, no real-time subscriptions. Would require bolting on a separate auth provider (Clerk, Auth0) at additional cost.
- **Neon** -- Serverless Postgres with branching, but no built-in auth, no RLS policies out of the box, and a smaller ecosystem of client libraries at the time.
- **Direct Postgres on Railway/Render** -- Full control but requires managing connection pooling, auth, and real-time infrastructure manually. Higher ops burden for a solo developer.

**Consequences:**
- Positive: Single bill for auth + database + real-time. RLS provides multi-tenant security at the database layer. Supabase client SDKs (`@supabase/ssr`, `@supabase/supabase-js`) integrate cleanly with Next.js server components and API routes.
- Positive: Sharing one Supabase instance across projects saves approximately $75/month in duplicate infrastructure costs.
- Negative: Schema isolation requires discipline (see ADR-004). A mistake in one project could theoretically affect another.
- Negative: Vendor lock-in to Supabase's auth and client SDK patterns. Migration to raw Postgres would require rewriting auth flows.

---

## ADR-002: OpenRouter for AI Model Access

**Status:** Accepted
**Date:** 2024-11
**Context:** Clarus makes 7-9 AI calls per content analysis (6 analysis sections + summarizer + keyword extraction + tone detection). The application needs to call specific models (primarily Gemini 2.5 Flash) with structured JSON output, retry on failure, and potentially swap models without code changes.
**Decision:** Route all AI calls through OpenRouter (`openrouter.ai`) rather than calling model provider APIs directly.
**Alternatives Considered:**
- **Google Gemini API directly** -- Lower latency (no proxy hop) and slightly cheaper per token. However, ties the application to a single provider with no fallback if Google has an outage or deprecates the model.
- **OpenAI API** -- GPT-4o is higher quality for some tasks but 5-10x more expensive per token than Gemini Flash. Cost at 150 analyses/month/user would be prohibitive.
- **Anthropic API** -- Claude excels at analysis but has higher per-token costs than Gemini Flash and, at the time, did not support structured JSON output mode natively.
- **Multi-provider abstraction (Vercel AI SDK only)** -- The Vercel AI SDK is used for chat streaming, but for the analysis pipeline, direct HTTP calls to OpenRouter give more control over retry logic, timeout handling, and per-section error isolation.

**Consequences:**
- Positive: Single API key, single billing account, single set of rate limits to manage. Model swaps require only a database change (see ADR-011), not a code deployment.
- Positive: Built-in fallback -- if one provider is down, OpenRouter can route to alternatives automatically.
- Negative: Added latency from the proxy layer (typically 50-200ms per call). Acceptable given that analysis calls are not real-time.
- Negative: OpenRouter takes a small margin on top of provider pricing. Estimated overhead is approximately 5-10% per token.

---

## ADR-003: Gemini 2.5 Flash as Primary Model

**Status:** Accepted
**Date:** 2025-01
**Context:** The analysis pipeline generates structured JSON for 6 sections (brief overview, triage, truth check, action items, key takeaways, detailed summary) plus a summarizer, keyword extractor, and tone detector. The model must reliably produce valid JSON, handle long inputs (10-50k tokens), and remain cost-effective at scale.
**Decision:** Use `google/gemini-2.5-flash` for all 6 main analysis sections, the summarizer, and chat. Use `google/gemini-2.5-flash-lite` for keyword extraction and tone detection (lighter tasks).
**Alternatives Considered:**
- **GPT-4o** -- Higher quality on some benchmarks, but at approximately $2.50-$10.00 per 1M tokens (input/output) vs. Gemini Flash's sub-$1 pricing, the cost difference is 5-10x. At 150 Pro-tier analyses/month with 9 calls each, this would cost hundreds of dollars per user per month.
- **Claude 3.5 Sonnet** -- Excellent analysis quality, but similarly priced to GPT-4o for this volume. Also lacked native JSON mode at the time of decision.
- **Gemini 2.5 Pro** -- Higher quality than Flash but 3-4x the cost. Quality difference was not significant enough for structured extraction tasks to justify the premium.
- **Llama 3 (via OpenRouter)** -- Open-source alternative, but JSON adherence was inconsistent and required more retries, negating the cost savings.

**Consequences:**
- Positive: At sub-$0.50 per 1M input tokens, the cost per analysis is approximately $0.01-0.03. This enables a $29/month Pro tier with 150 analyses while maintaining healthy margins.
- Positive: Gemini Flash has native JSON mode (`response_format: { type: "json_object" }`) which reduces parse failures.
- Positive: Flash-lite for lightweight tasks (keyword extraction, tone detection) further reduces costs by approximately 60% on those calls.
- Negative: JSON output still occasionally requires fallback parsing (markdown fences, truncation repair) -- handled by `lib/ai-response-parser.ts`.
- Negative: Gemini's content safety filters sometimes refuse legitimate content about politics or controversy. Mitigated by `CONTENT_REFUSED` detection in the moderation pipeline.

---

## ADR-004: Clarus Schema Isolation

**Status:** Accepted
**Date:** 2024-10
**Context:** Clarus shares a Supabase instance with four other projects: a social media content tracker (`sm_content`), an AWS course memory system (`aws_course_memory`), Steel Motion website forms (`sm_partnership_inquiries`, `sm_contact_inquiries`), and an n8n automation schema (`automation.*`). Each project was added to avoid paying for separate Supabase instances ($25/month each).
**Decision:** All Clarus tables live in a dedicated `clarus` schema rather than the default `public` schema. The Supabase client is configured with `db: { schema: "clarus" }` so that all queries implicitly target the correct schema. The database `search_path` is set so that unqualified table names resolve to `clarus.*`.
**Alternatives Considered:**
- **Separate Supabase instances** -- Complete isolation but costs $25/month per project. With 5 projects, that is $125/month for databases alone.
- **Table prefixes in `public` schema** (e.g., `clarus_content`, `sm_content`) -- Simpler setup, but RLS policies and client configuration become error-prone. No schema-level separation means a misconfigured query could accidentally touch another project's data.
- **Separate databases on a single Postgres server** -- Would require managing connection pooling and credentials per database. Supabase does not support multiple databases per project.

**Consequences:**
- Positive: True schema isolation -- a query like `SELECT * FROM content` in the Clarus client can never accidentally read `sm_content` or `automation.reddit_monitoring`.
- Positive: RLS policies are scoped per schema, so Clarus policies cannot interfere with other projects.
- Positive: Saves approximately $100/month by consolidating 5 projects into one instance.
- Negative: Requires strict discipline -- every `createClient` and `createServerClient` call must include `{ db: { schema: "clarus" } }`. A missing schema option would silently query the wrong tables.
- Negative: Supabase dashboard shows all schemas, which can be confusing. The `CLAUDE.md` file includes explicit instructions to ignore non-Clarus tables.

---

## ADR-005: In-Memory Rate Limiting

**Status:** Accepted
**Date:** 2025-01
**Context:** API routes need rate limiting to prevent abuse (brute-force auth attempts, chat spam, analysis pipeline overload). The application runs on Vercel serverless functions, where each invocation may or may not share memory with previous invocations depending on warm/cold start behavior.
**Decision:** Use an in-memory `Map<string, { count, resetTime }>` for rate limiting (`lib/validation.ts`), with periodic eviction of expired entries (every 1,000 calls) and a hard cap of 10,000 entries to bound memory usage.
**Alternatives Considered:**
- **Redis (Upstash)** -- Distributed rate limiting that works across all serverless instances. Accurate but adds $10-25/month, ~5-10ms latency per check, and another service dependency.
- **Database-backed counters** -- Store rate limit state in Supabase. Accurate across instances but adds a database round-trip (~20-50ms) to every API request, which is unacceptable for the chat streaming endpoint.
- **Vercel KV (Redis)** -- Similar to Upstash but with Vercel-native integration. Same cost and latency concerns.
- **Middleware-only rate limiting (e.g., Vercel Edge Config)** -- Limited to simple IP-based rules, cannot do per-user or per-endpoint granular limiting.

**Consequences:**
- Positive: Zero additional cost, zero additional latency. Rate limit checks are sub-microsecond.
- Positive: Memory-bounded -- the 10,000-entry cap and periodic eviction prevent unbounded growth in long-lived serverless instances.
- Negative: Rate limits are per-instance, not global. A user hitting different Vercel edge functions could bypass limits. In practice, Vercel's warm-instance reuse means the same user typically hits the same instance within a short window.
- Negative: Cold starts reset all counters. This means rate limits are "best effort" rather than guaranteed.
- Trade-off: Acceptable for the current scale (single-digit concurrent users). If Clarus grows to hundreds of concurrent users, upgrading to Upstash Redis is a straightforward swap in `checkRateLimit()`.

---

## ADR-006: Firecrawl for Article Scraping

**Status:** Accepted
**Date:** 2024-11
**Context:** Clarus needs to extract the main content from any URL (news articles, blog posts, research papers) in a clean format suitable for AI analysis. Many modern websites use JavaScript rendering, anti-bot measures, and complex layouts that break simple HTTP-based scrapers.
**Decision:** Use Firecrawl (`api.firecrawl.dev`) for article scraping. It returns content in Markdown format with metadata (title, description, OG image).
**Alternatives Considered:**
- **Puppeteer/Playwright** -- Full browser rendering handles JavaScript-heavy sites, but requires a persistent browser process that is incompatible with serverless functions (Vercel has a 50MB function size limit and no persistent processes). Could run on a separate VM but adds infrastructure.
- **Custom `fetch` + Cheerio** -- Lightweight and free, but fails on JavaScript-rendered content (SPAs, Medium, Substack). Requires per-site parsing rules that do not scale.
- **Jina AI Reader** -- Similar API-based approach to Firecrawl but less mature at the time. Markdown output quality was inconsistent.
- **Diffbot** -- Enterprise-grade article extraction but pricing starts at $299/month. Overkill for the current scale.

**Consequences:**
- Positive: Works in serverless -- a single HTTP POST returns clean Markdown. No browser processes, no headless Chrome dependencies.
- Positive: Handles anti-bot measures (Cloudflare, CAPTCHA challenges) that would block simple HTTP scrapers.
- Positive: Markdown output feeds directly into AI prompts without HTML stripping.
- Negative: Per-scrape cost (~$0.01-0.05 depending on plan). At scale, this adds up -- 150 Pro-tier analyses/month = $1.50-7.50/month per user.
- Negative: Vendor dependency -- if Firecrawl goes down, article analysis is completely blocked. Mitigated with a 5-retry strategy with exponential backoff.
- Negative: `onlyMainContent: true` occasionally strips relevant sidebar content (author bios, publication dates). An acceptable trade-off for clean AI input.

---

## ADR-007: Polar for Payments

**Status:** Accepted
**Date:** 2025-01
**Context:** Clarus needs subscription billing (monthly and annual plans), one-time purchases (day pass), a customer portal for plan management, and webhook-driven tier changes in the database. The application has four tiers: Free, Starter ($18/month), Pro ($29/month), and Day Pass ($10 one-time).
**Decision:** Use Polar (`polar.sh`) for all payment processing. Product IDs are environment variables, and a webhook handler (`app/api/polar/webhook/route.ts`) updates the user's tier and `polar_customer_id` in the database.
**Alternatives Considered:**
- **Stripe** -- Industry standard with the most comprehensive API. However, requires PCI compliance considerations, has a steeper integration curve (Stripe Elements, webhook signature verification, complex subscription lifecycle), and takes 2.9% + $0.30 per transaction.
- **Paddle** -- Handles sales tax/VAT as Merchant of Record, reducing compliance burden. However, takes a higher percentage (5% + $0.50) and has less flexibility in pricing models.
- **Lemon Squeezy** -- Similar Merchant of Record model to Paddle with a developer-friendly API. Newer company with less track record. 5% + $0.50 fee structure.

**Consequences:**
- Positive: Developer-friendly SDK (`@polar-sh/sdk`). The checkout flow is a single `polar.checkouts.create()` call. Webhook handling is straightforward with typed event payloads.
- Positive: Lower fees than Paddle/Lemon Squeezy for the current pricing tiers.
- Positive: Customer portal is built-in -- users can manage subscriptions without custom UI.
- Negative: Polar is a newer company with a smaller market presence than Stripe. Switching costs would be moderate (rewrite webhook handler + checkout flow).
- Negative: No built-in usage-based billing -- tier enforcement is handled entirely in application code (`lib/tier-limits.ts`, `lib/usage.ts`).

---

## ADR-008: Parallel AI Analysis Pipeline

**Status:** Accepted
**Date:** 2025-02
**Context:** Each content analysis generates 6 primary AI sections (brief overview, triage, truth check, action items, key takeaways, detailed summary) plus auxiliary calls (tone detection, keyword extraction, auto-tagging). Running these sequentially would take 60-120 seconds per analysis. Users expect results within 30 seconds.
**Decision:** Run all 9 AI calls in parallel using `Promise.all`. A pre-phase runs web search context retrieval and tone detection in parallel (zero added latency), then all 6 analysis sections + summarizer + auto-tagger fire simultaneously. Each section saves to the database independently the moment it completes, so the UI can progressively render results.
**Alternatives Considered:**
- **Sequential pipeline** -- Simpler error handling and lower peak API concurrency. But total latency would be 9 x 8-15 seconds = 72-135 seconds per analysis. Unacceptable for user experience.
- **Phased pipeline (2 phases)** -- Run 4 independent sections first, then 2 triage-dependent sections. This was the original design but was simplified when it became clear that triage-dependent sections (truth check, action items) could run independently since triage data is only used post-completion for content category filtering, not as input.
- **Queue-based async processing** -- Submit analysis to a job queue (e.g., Inngest, QStash) and poll for results. Better for scaling but adds infrastructure complexity and prevents progressive rendering.

**Consequences:**
- Positive: Total analysis time is bounded by the slowest individual section (~8-15 seconds), not the sum. Typical wall-clock time is 10-20 seconds for a full analysis.
- Positive: Progressive rendering -- the UI can show each section as it arrives via polling, rather than waiting for all sections.
- Positive: Error isolation -- if one section fails (e.g., truth check times out), the other 5 sections are still saved. The UI shows partial results with an error indicator for the failed section.
- Negative: Peak API concurrency is high -- 9 simultaneous requests to OpenRouter per analysis. At Pro tier with 150 analyses/month, this could produce 1,350 concurrent API calls in burst scenarios. Mitigated by per-user rate limiting.
- Negative: Cost is the same as sequential (same number of API calls), but burst usage patterns may trigger OpenRouter rate limits more frequently.
- Trade-off: The `maxDuration = 300` setting (5 minutes) on the process-content route is necessary for long podcast transcriptions but means each invocation holds a Vercel function slot for up to 5 minutes.

---

## ADR-009: Content Moderation Pipeline

**Status:** Accepted
**Date:** 2025-04
**Context:** As an Electronic Service Provider (ESP) processing user-submitted URLs, Clarus has a legal obligation under 18 U.S.C. Section 2258A to report apparent CSAM (child sexual abuse material) to NCMEC. Beyond legal compliance, the platform must prevent analysis of content promoting terrorism, weapons manufacturing, and human trafficking.
**Decision:** Implement a 4-layer content moderation pipeline in `lib/content-screening.ts`:
1. **Layer 1: URL Screening** -- Block known illegal content domains (onion proxies, darknet indices) before scraping.
2. **Layer 2: Keyword Pre-Screening** -- Detect co-occurring indicator patterns (e.g., age-indicating terms near exploitation terms) in scraped text. Uses multi-word phrase matching to minimize false positives.
3. **Layer 3: AI Refusal Detection** -- Detect `CONTENT_REFUSED` responses from Gemini's built-in safety filters after AI processing.
4. **Layer 4: Admin Dashboard** -- Manual review queue for flagged content, with NCMEC CyberTipline reporting capability.

All flagged content is persisted to the `flagged_content` table with content hashes, IP addresses, severity levels, and legal hold status (non-deletable).

**Alternatives Considered:**
- **AI-only moderation** -- Rely solely on Gemini's built-in safety filters. Insufficient because: (a) AI filters can be bypassed with prompt injection; (b) no pre-scrape URL blocking; (c) no audit trail for legal compliance.
- **Third-party moderation API** (e.g., Azure Content Safety, AWS Rekognition) -- Adds cost and another external dependency. Also primarily designed for image/video moderation, not text-based content analysis.
- **Keyword-only screening** -- Simple but produces high false-positive rates with single-keyword matching. The multi-word co-occurrence approach in Layer 2 was chosen to balance recall and precision.
- **No moderation** -- Legally non-viable. 18 U.S.C. Section 2258A imposes criminal penalties for ESPs that fail to report apparent CSAM.

**Consequences:**
- Positive: Legal compliance with federal reporting requirements. The `flagged_content` table provides a complete audit trail.
- Positive: Defense in depth -- even if one layer fails, the others provide coverage. URL screening catches known bad domains before any scraping occurs. Keyword screening catches content that Gemini might not flag. AI refusal detection catches content that passes keyword screening but triggers model safety filters.
- Positive: Content about politics, controversy, and conspiracy theories is explicitly allowed -- the system only flags illegal content categories (CSAM, terrorism, weapons, trafficking).
- Negative: Layer 2 keyword patterns scan only the first 50KB of content to avoid regex DoS. Content with illegal material past the 50KB mark would only be caught by Layer 3 (AI refusal).
- Negative: False positives are possible -- legitimate news articles about trafficking or terrorism investigations could trigger keyword patterns. These go to the admin review queue rather than being auto-blocked.

---

## ADR-010: Hard Caps Over Unlimited

**Status:** Accepted
**Date:** 2025-01
**Context:** SaaS pricing commonly offers "unlimited" usage on higher tiers to attract customers. However, AI API costs scale linearly with usage (each analysis costs approximately $0.03-0.10 in API calls), making unlimited plans a financial risk. A single power user on an "unlimited" Pro plan could generate thousands of analyses and cost more than their subscription revenue.
**Decision:** Every tier has hard numeric caps on every feature. No feature is labeled "unlimited" anywhere in the product. The Free tier gets 5 analyses/month, Starter gets 50, Pro gets 150, and Day Pass gets 15.
**Alternatives Considered:**
- **Unlimited on Pro tier** -- Standard SaaS practice. Risk: a single user running 1,000+ analyses/month at $0.05 each = $50 in API costs against $29 revenue. Even 5 such users would eliminate all margin.
- **Soft limits with overage billing** -- Allow exceeding caps with per-unit charges. More complex billing logic, harder to communicate to users, and requires metered billing support (which Polar does not natively provide).
- **Usage-based pricing only** -- Pay per analysis with no subscription. Unpredictable bills for users, lower retention than subscription models.
- **Higher caps with throttling** -- Allow high usage but throttle response times after a threshold. Degrades user experience and is difficult to implement fairly.

**Consequences:**
- Positive: Cost predictability -- maximum API cost per user per month is bounded and calculable. At Pro tier: 150 analyses x $0.05 = $7.50 max API cost against $29 revenue = 74% gross margin.
- Positive: Abuse prevention -- no single user can generate runaway costs.
- Positive: Simplicity -- `lib/tier-limits.ts` is a single `Record<UserTier, TierLimits>` object. Limit checks are a simple `currentCount >= limit` comparison.
- Negative: Users accustomed to "unlimited" plans may perceive hard caps as restrictive. Mitigated by setting caps high enough that 95%+ of users never hit them.
- Negative: Day Pass users (24-hour access) have particularly tight limits. This is intentional -- the Day Pass is a trial mechanism, not a primary revenue tier.

---

## ADR-011: Database-Stored AI Prompts

**Status:** Accepted
**Date:** 2025-02
**Context:** The AI analysis pipeline uses 9 different prompts (6 analysis sections + summarizer + keyword extractor + tone detector). Prompt engineering is an iterative process -- wording changes can significantly affect output quality. Deploying a code change for every prompt tweak is slow (build + deploy takes 2-5 minutes on Vercel) and risky (a bad prompt affects all users until the next deploy).
**Decision:** Store all AI prompts in three database tables: `analysis_prompts` (6 section prompts + keyword extraction + tone detection), `active_summarizer_prompt`, and `active_chat_prompt`. Each prompt record includes system content, user content template (with `{{CONTENT}}`, `{{TONE}}`, `{{LANGUAGE}}` placeholders), model name, temperature, max tokens, and an `is_active` flag. The application fetches prompts from the database at runtime with a per-request cache.
**Alternatives Considered:**
- **Hardcoded prompts in source code** -- Version-controlled and deployable with the application. But requires a full build + deploy cycle for every prompt change, and prompt changes cannot be rolled back independently of code changes.
- **Environment variables** -- Would work for simple prompts but impractical for multi-paragraph system prompts with formatting. Also cannot store associated metadata (model name, temperature, max tokens).
- **Config files (JSON/YAML)** -- Version-controlled but still requires deployment. No runtime hot-swapping.
- **Feature flag service (LaunchDarkly, Flagsmith)** -- Designed for boolean flags and simple values, not multi-kilobyte prompt text. Would also add another paid service.

**Consequences:**
- Positive: Hot-swappable -- prompt changes take effect on the next analysis without any deployment. Enables rapid A/B testing of prompt variations.
- Positive: Each prompt carries its own model name and parameters. Switching a section from Gemini Flash to GPT-4o is a database update, not a code change.
- Positive: The `is_active` flag enables maintaining multiple prompt versions in the database for instant rollback.
- Negative: Prompts are not version-controlled in Git. Changes to prompts do not appear in the repository history. Mitigated by the `created_at`/`updated_at` timestamps and the ability to keep old versions with `is_active = false`.
- Negative: A database outage would prevent prompt fetching and block all analysis. Mitigated by a fallback model name (`google/gemini-2.5-flash`) hardcoded in the application.
- Negative: Per-request prompt fetching adds 1 database round-trip (~10-20ms). Mitigated by the `promptsCache` Map that caches prompts within a single request batch (cleared at the start of each analysis).

---

## ADR-012: Dark-Mode-First Design

**Status:** Accepted
**Date:** 2024-11
**Context:** Clarus is a content analysis tool whose users spend extended periods reading analysis results, chatting with AI, and browsing their content library. The UI needed a visual identity that is comfortable for long reading sessions and distinct from competitors. The application uses `next-themes` for theme management and Tailwind CSS for styling.
**Decision:** Design the application dark-mode-first with pure black (`#000000` / `bg-background`) backgrounds rather than dark gray (`#1a1a1a` or similar). The primary accent color is blue (`hsl(217, 91%, 60%)`) which provides strong contrast against black. Light mode is supported but is not the default experience.
**Alternatives Considered:**
- **Dark gray backgrounds** (e.g., `#121212`, `#1a1a1a`) -- The Material Design recommendation for dark mode. Provides better depth perception through elevation shadows. However, on OLED screens, dark gray pixels still emit light, consuming more battery than true black.
- **Light-mode-first** -- Traditional SaaS approach. Familiar to most users but causes more eye strain during extended reading sessions, especially in low-light environments.
- **System-preference-only** -- Follow `prefers-color-scheme` without a default. Provides no visual identity -- the app looks different for every user.

**Consequences:**
- Positive: OLED battery savings -- pure black pixels are turned off on OLED screens, reducing power consumption by up to 40% on fully-black areas.
- Positive: Strong visual identity -- the pure black + blue accent combination is immediately recognizable and differentiates Clarus from competitors using standard gray-on-white or gray-on-dark-gray palettes.
- Positive: High contrast -- blue accent text and white body text against pure black exceed WCAG 2.1 AA contrast ratios (4.5:1 minimum).
- Negative: Pure black can cause a "smearing" effect on some OLED screens when scrolling white text over black backgrounds. Mitigated by using slightly off-white text colors in content-heavy areas.
- Negative: Elevation-based visual hierarchy (cards floating above backgrounds) is harder to achieve without gray shading. Addressed through border treatments and subtle background tints on card components.

---

## ADR-013: Prompt Injection Defense Strategy

**Status:** Accepted
**Date:** 2025-04
**Context:** Clarus processes arbitrary user-submitted content (articles, YouTube transcripts, podcasts) through AI prompts. This content could contain prompt injection attacks -- text designed to make the AI ignore its instructions and follow attacker-controlled directives instead. Attack vectors include instruction overrides ("ignore previous instructions"), role hijacking ("you are now DAN"), delimiter escapes (closing XML wrapper tags), and invisible characters (zero-width spaces hiding payload text).
**Decision:** Implement a defense-in-depth prompt injection defense in `lib/prompt-sanitizer.ts` with five layers:
1. **Control character stripping** -- Remove ASCII control characters (except whitespace) that could hide payloads.
2. **Zero-width character stripping** -- Remove Unicode zero-width joiners, soft hyphens, and other invisible characters.
3. **XML delimiter escaping** -- Replace `<` and `>` with `[LT]` and `[GT]` bracket notation, and `</` with `[/`, so injected text cannot close the `<user_content>` wrapper tag.
4. **Injection pattern neutralization** -- Detect known injection patterns (instruction overrides, role hijacking, prompt leaking, delimiter escapes) and wrap them in `[BLOCKED:...]` brackets rather than removing them. This preserves the content for analysis while preventing execution.
5. **Instruction anchoring** -- Repeat critical instructions at the END of every prompt (after user content), so the model's most recent context reinforces the original instructions.

Additionally, `detectOutputLeakage()` monitors AI outputs for signs that injection succeeded (e.g., "as you requested", "my system prompt is", "[DAN]").

**Alternatives Considered:**
- **Input rejection** -- Block any content containing injection patterns. Would produce false positives on legitimate articles about AI security, prompt engineering, or cybersecurity topics. Clarus must be able to analyze content about any topic.
- **LLM-based input classification** -- Use a separate AI call to classify whether input contains injection attempts. Adds latency and cost (an extra API call per analysis), and the classifier itself could be attacked.
- **No defense (rely on model safety)** -- Gemini and other models have some built-in injection resistance, but it is not reliable enough for production use. A single successful injection could cause the model to output harmful content or leak system prompt details.
- **Sanitization only (no output monitoring)** -- Sanitizing input is necessary but not sufficient. Output monitoring provides observability into whether attacks are succeeding despite sanitization.

**Consequences:**
- Positive: Defense in depth -- even if one layer fails, the others provide coverage. XML escaping prevents delimiter breakout, pattern neutralization catches known attack vectors, and instruction anchoring makes the model more resistant to mid-prompt overrides.
- Positive: Content preservation -- injection patterns are bracketed (`[BLOCKED:...]`), not deleted. The AI can still analyze articles about prompt injection or cybersecurity without losing content.
- Positive: Output monitoring provides real-time alerting (via `console.warn`) when injection may have succeeded, enabling incident response.
- Negative: The injection pattern list is not exhaustive. Novel attack vectors require adding new patterns. This is a known limitation of pattern-based defenses.
- Negative: XML delimiter escaping transforms the content slightly (angle brackets become bracket notation), which could affect analysis of content that discusses HTML/XML. An acceptable trade-off for security.
- Negative: Instruction anchoring increases prompt length by approximately 200 tokens per call. At 9 calls per analysis, this adds ~1,800 tokens total (~$0.001 in cost). Negligible.

---

## ADR-014: Tavily for Web Search Context

**Status:** Accepted
**Date:** 2025-01
**Context:** Content analysis benefits from real-time web context for fact-checking claims, verifying statistics, and providing background on entities mentioned in the content. The analysis pipeline extracts 3 key topics from the content, searches the web for each, and injects the results as verification context into analysis prompts. The chat feature also uses web search as an AI-triggered tool for answering questions beyond the analyzed content.
**Decision:** Use Tavily (`api.tavily.com`) for all web search operations. Configuration: `search_depth: "basic"`, `max_results: 3`, `include_answer: true`, `include_raw_content: false`. Results are deduplicated per-analysis and cached in a module-level Map that is cleared at the start of each analysis.
**Alternatives Considered:**
- **Google Custom Search API** -- High relevance quality but $5 per 1,000 queries after the free tier (100 queries/day). At 3 queries per analysis x 150 analyses/month = 450 queries/month, this would cost approximately $2.25/month. However, Google CSE does not provide a pre-synthesized answer summary, and the API ergonomics require more boilerplate.
- **Bing Search API** -- Competitive pricing ($3 per 1,000 queries) and good relevance. However, Bing's snippet quality was lower than Tavily's in testing, and it lacks the `include_answer` feature that provides a pre-synthesized summary.
- **Brave Search API** -- Privacy-focused with competitive pricing. Newer API with less documentation and community support at the time of decision. No answer synthesis feature.
- **SerpAPI** -- Aggregates multiple search engines. Pricing starts at $75/month for 5,000 queries. Overkill for the current query volume.

**Consequences:**
- Positive: Tavily's `include_answer` provides a pre-synthesized summary at no extra cost, enriching the context passed to analysis prompts without additional AI calls.
- Positive: Simple API -- a single POST request with a JSON body. No OAuth, no API key rotation, no complex result pagination.
- Positive: Cost optimization through deduplication -- near-identical queries (after normalization: lowercase, strip punctuation, collapse whitespace) share cached results, saving approximately $0.01 per deduplicated query.
- Positive: `search_depth: "basic"` is sufficient for snippet-based fact-checking at half the cost of "advanced" depth.
- Negative: At $0.01 per search x 3 searches per analysis, web search adds approximately $0.03 per analysis. At Pro tier: 150 x $0.03 = $4.50/month per user. This is budgeted into the pricing model.
- Negative: Tavily is a startup with less market presence than Google or Bing. Service continuity risk is mitigated by graceful degradation -- if Tavily is down, analysis proceeds without web context (the `getWebSearchContext` function returns `null`).
- Negative: The per-analysis cache is module-level, meaning it only deduplicates within a single serverless invocation. Cross-user deduplication (two users analyzing the same article) is not implemented. Acceptable at current scale.
