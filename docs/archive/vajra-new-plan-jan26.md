# Vajra Truth Checker — Master Implementation Plan

**Started**: Jan 26, 2026
**Last Updated**: Jan 29, 2026
**Business Model**: B2C — Individual content consumers who want to quickly assess and understand content

---

## Status Dashboard

| Workstream | Status | Progress |
|-----------|--------|----------|
| 1: UI Restoration + Enhancement | COMPLETED | 5/5 phases done |
| 2A: Complete AI Prompt Rewrite | COMPLETED | 5/5 steps done |
| 2B: Chrome Extension (Side Panel) | COMPLETED | 11/11 steps done |
| 2C.1: PWA Setup | COMPLETED | 5/5 steps done |
| 2C.3: Knowledge Library | COMPLETED | 4/4 steps done |
| 3: Infrastructure Migration | PLANNED (LATER) | 0/? steps |
| 4: AI Auto-Tagging | COMPLETED | 2/2 steps done |

---

## Workstream 1: UI Restoration + Enhancement (COMPLETED)

### Phase 1A: Restore Split-Screen Card Layout (DONE)
- Restored `app/item/[id]/page.tsx` from git history (`7e1bb08~1`)
- Desktop: Split-screen with left panel (480px, sticky) + right panel (flex-1, scrollable)
- Left panel: YouTube player, metadata, tags, domain credibility, action buttons
- Right panel: 6 analysis cards (Overview, Quick Assessment, Key Takeaways, Truth Check, Action Items, Detailed Analysis)
- Switched from `withAuth` HOC to `getCachedSession` pattern (matching newer code)

#### Desktop Layout (Implemented)

```
┌────────────────────────┬────────────────────────────────────────┐
│  LEFT PANEL (480px)    │  RIGHT PANEL (flex-1, scrollable)      │
│  (independently        │                                        │
│   scrollable)          │  ┌──────────────────────────────────┐  │
│                        │  │  Overview (blue, Eye icon)       │  │
│  ┌──────────────────┐  │  │  Brief text overview of content  │  │
│  │                  │  │  └──────────────────────────────────┘  │
│  │  YouTube Player  │  │                                        │
│  │  (16:9)          │  │  ┌──────────────────────────────────┐  │
│  │                  │  │  │  Quick Assessment (amber,         │  │
│  └──────────────────┘  │  │  Sparkles) — TriageCard           │  │
│                        │  │  • Quality Score (1-10)           │  │
│  Title of the Video    │  │  • Skip / Skim / Worth It /      │  │
│  domain.com · 15 min   │  │    Must See                       │  │
│  Tags: [AI] [Tech]     │  │  • Worth Your Time?              │  │
│                        │  │  • Target Audience chips          │  │
│  Signal/Noise Voting   │  └──────────────────────────────────┘  │
│  [Share] [Delete]      │                                        │
│  [Regenerate]          │  ┌──────────────────────────────────┐  │
│                        │  │  Key Takeaways (cyan, Lightbulb)  │  │
│  ┌──────────────────┐  │  │  Markdown + clickable timestamps │  │
│  │                  │  │  └──────────────────────────────────┘  │
│  │  CHAT            │  │                                        │
│  │  (always visible)│  │  ┌──────────────────────────────────┐  │
│  │                  │  │  │  Truth Check (emerald, Shield)    │  │
│  │  [AI]: Here's    │  │  │  • Overall Rating                │  │
│  │  what I found... │  │  │  • Issues Found                  │  │
│  │                  │  │  │  • Strengths                     │  │
│  │  [You]: Is the   │  │  │  • Sources Quality               │  │
│  │  source reliable?│  │  └──────────────────────────────────┘  │
│  │                  │  │                                        │
│  │  [AI]: Looking   │  │  ┌──────────────────────────────────┐  │
│  │  at the sources..│  │  │  Action Items (orange, Target)    │  │
│  │                  │  │  │  Checkable to-dos by priority    │  │
│  │  ──────────────  │  │  └──────────────────────────────────┘  │
│  │  [Ask about      │  │                                        │
│  │   this content]  │  │  ┌──────────────────────────────────┐  │
│  │  [Send]          │  │  │  Detailed Analysis (violet,       │  │
│  └──────────────────┘  │  │  BookOpen, collapsible)           │  │
│                        │  └──────────────────────────────────┘  │
│                        │                                        │
└────────────────────────┴────────────────────────────────────────┘
```

### Phase 1B: Mobile Tab Switcher (DONE)
- Added Analysis/Chat tab switcher below metadata on mobile
- Sticky video player at top
- Scroll position preserved per tab using refs
- Chat input sticks to bottom of chat tab viewport

#### Mobile Layout — Analysis Tab (Implemented)

```
┌───────────────────────────────┐
│  Site Header                  │
├───────────────────────────────┤ ◄── sticky top
│ ┌───────────────────────────┐ │
│ │                           │ │
│ │   YouTube Video Player    │ │
│ │   (16:9, full width)      │ │
│ │                           │ │
│ └───────────────────────────┘ │
│  Title of the Video           │
│  domain.com · 15 min          │
├───────────────────────────────┤
│  [ Analysis ]  [ Chat ]      │ ◄── tab switcher
├───────────────────────────────┤
│                               │
│ ┌───────────────────────────┐ │  ▲
│ │  Overview (blue)          │ │  │
│ └───────────────────────────┘ │  │
│ ┌───────────────────────────┐ │  │
│ │  Quick Assessment (amber) │ │  │
│ │  Quality Score, Worth It  │ │  │
│ └───────────────────────────┘ │  │
│ ┌───────────────────────────┐ │  │ scrollable
│ │  Key Takeaways (cyan)     │ │  │
│ └───────────────────────────┘ │  │
│ ┌───────────────────────────┐ │  │
│ │  Truth Check (emerald)    │ │  │
│ └───────────────────────────┘ │  │
│ ┌───────────────────────────┐ │  │
│ │  Action Items (orange)    │ │  │
│ └───────────────────────────┘ │  │
│ ┌───────────────────────────┐ │  │
│ │  Detailed Analysis        │ │  │
│ └───────────────────────────┘ │  ▼
│                               │
│  Signal/Noise Voting          │
│  [Share] [Delete] [Regen]     │
│                               │
└───────────────────────────────┘
```

#### Mobile Layout — Chat Tab (Implemented)

```
┌───────────────────────────────┐
│  Site Header                  │
├───────────────────────────────┤ ◄── sticky top
│ ┌───────────────────────────┐ │
│ │   YouTube Video Player    │ │
│ └───────────────────────────┘ │
│  Title · metadata             │
├───────────────────────────────┤
│  [ Analysis ]  [ Chat ]      │ ◄── tab switcher
├───────────────────────────────┤
│                               │
│  [AI]: Here's what I found    │
│  about this video...          │
│                               │
│  [Suggestion chips]           │
│  "Key takeaways"              │
│  "Fact check claims"          │
│  "Action items"               │
│                               │
│  [You]: Is the source         │
│  reliable?                    │
│                               │
│  [AI]: Looking at the         │
│  sources referenced...        │
│                               │
│  ┌───────────────────────────┐│
│  │ Ask about this content... ││
│  │                [mic] [>]  ││
│  └───────────────────────────┘│
│                               │
└───────────────────────────────┘
```

**Key mobile behaviors**:
- Video player stays sticky at top in both tabs
- Tab switcher stays pinned below metadata (does not scroll away)
- Switching tabs preserves scroll position in each tab
- Chat input sticks to bottom of chat tab viewport
- Clickable timestamps in Analysis tab seek the sticky video player

### Phase 1C: Enhanced Chat System Prompt (DONE)
- Changed system prompt from generic "intelligent AI assistant" to "Vajra, an analysis assistant"
- Added grounding rules: cite sections by name, don't invent facts, admit gaps
- Added `action_items` to summary data fetch (was missing)
- Added action items section to context building
- File modified: `app/api/chat/route.ts`

### Phase 1D: STT Dictation (DONE)
- Mic button on chat input bar using Web Speech API
- Reused existing `useSpeechToText` hook from `lib/hooks/use-speech.ts`
- Recording animation (pulsing red ring)
- Graceful fallback: hides mic button if browser doesn't support it
- File modified: `components/inline-chat.tsx`

#### Chat Input with Mic (Implemented)

```
┌─────────────────────────────────────┐
│ Ask about this content...  [mic] [>] │
└─────────────────────────────────────┘

States:
  Idle:      [mic]     ← tap to start recording
  Recording: [mic*]    ← pulsing red ring, tap to stop
```

### Phase 1E: Context-Aware Suggestion Chips (DONE)
- Suggestion chips below chat input, contextual to content type
- Uses `getSuggestionChips()` function based on `contentType` and `contentCategory`
- Chips disappear after first message sent
- File modified: `components/inline-chat.tsx`

### Phase 1 — TTS Read-Back (Implemented)
- Each AI response gets a speaker icon to read it aloud
- Uses `speechSynthesis` API (built into browsers, zero cost)
- Icon toggles between play/stop states

```
┌─────────────────────────────────────┐
│  [AI]: Based on the Truth Check,    │
│  this video has 2 factual issues... │
│                          [speaker]  │
└─────────────────────────────────────┘

States:
  Idle:      [speaker]  ← tap to start reading
  Speaking:  [stop]     ← tap to stop
```

### Files Created/Modified in Workstream 1

| File | Change |
|------|--------|
| `components/inline-chat.tsx` | **CREATED** — New inline chat component with STT, TTS, suggestion chips |
| `app/item/[id]/page.tsx` | **REWRITTEN** — From redirect to full split-screen page (~1600 lines) |
| `app/api/chat/route.ts` | **MODIFIED** — Enhanced system prompt with grounding |

### Bugs Fixed During Workstream 1
- TS2322: `string | null` vs `string | undefined` for contentType props
- Removed unused imports: `TriageData` in inline-chat.tsx
- Removed unused variable: `syntheticEvent` in inline-chat.tsx
- Fixed `any` type: changed to `unknown` with `instanceof Error` check
- Removed unused: `currentUserContentRating`, `handleSignalNoiseVote`, `handleDelete`, `router`

---

## Scoring Systems Reference

### Signal-to-Noise Scoring (4-tier recommendation)

| Score | Label | Color | Meaning |
|-------|-------|-------|---------|
| 0 | Skip | Red | Not worth your time |
| 1 | Skim | Orange | Scan for a few useful bits |
| 2 | Worth It | Emerald | Good signal, worth watching |
| 3 | Must See | Green | Excellent, high-value content |

### Truth Check Rating (5-tier accuracy)

| Rating | Meaning |
|--------|---------|
| Accurate | Claims are well-supported |
| Mostly Accurate | Minor issues, broadly correct |
| Mixed | Some accurate, some problematic |
| Questionable | Significant concerns |
| Unreliable | Major factual problems |

### Quality Score Calibration

| Range | Label | Meaning |
|-------|-------|---------|
| 1-3 | Low | Actively misleading, filler, or clickbait |
| 4-5 | Below Average | Some valid points, poor execution |
| 6-7 | Solid | Delivers on its promise with reasonable depth |
| 8-9 | Strong | Original insights, well-evidenced |
| 10 | Exceptional | Rare. Paradigm-shifting or definitive |

---

## Workstream 2A: Complete AI Prompt Rewrite (IN PROGRESS)

### Goal
Replace ALL 7 AI prompts with completely original versions — different structure, methodology, tone, and formatting guidance. JSON outputs must still match existing TypeScript interfaces. This eliminates any connection to the former partner's prompt designs.

### Steps

| # | Step | Status |
|---|------|--------|
| 1 | Back up current prompts | DONE — saved to `scripts/backup-prompts-pre-rewrite.sql` |
| 2 | Apply new analysis prompts (5 rows) | DONE — all 5 updated in DB |
| 3 | Apply new short_summary/summarizer prompt | DONE — active_summarizer_prompt updated |
| 4 | Update hardcoded topic extraction prompt | DONE — process-content/route.ts updated |
| 5 | Verify with test analysis | NOT STARTED |

### Prompts to Rewrite

| # | Prompt Type | Table | Output | Status |
|---|------------|-------|--------|--------|
| 1 | `brief_overview` | `analysis_prompts` | Plain text (max 4 sentences) | DONE |
| 2 | `triage` | `analysis_prompts` | JSON -> TriageData | DONE |
| 3 | `truth_check` | `analysis_prompts` | JSON -> TruthCheckData | DONE |
| 4 | `action_items` | `analysis_prompts` | JSON -> ActionItemsData | DONE |
| 5 | `detailed_summary` | `analysis_prompts` | Markdown text | DONE |
| 6 | `short_summary` | `active_summarizer_prompt` | JSON with markdown field | DONE |
| 7 | Topic extraction | Hardcoded in `process-content/route.ts` | JSON array of search queries | DONE |

### New Prompt Designs

#### Prompt 1: brief_overview
- **Model**: `anthropic/claude-sonnet-4` | **Temp**: 0.3 | **Max tokens**: 600 | **JSON**: No
- **Methodology**: Lead with substance, not framing. Third person, present tense. Max 4 sentences. No markdown, no bullets. Must include specific claims/names/numbers from content.
- **Anti-pattern**: "This video discusses..." -> Instead start with the actual thesis.

#### Prompt 2: triage
- **Model**: `anthropic/claude-sonnet-4` | **Temp**: 0.2 | **Max tokens**: 800 | **JSON**: Yes
- **Methodology**: Four-step evaluation: Substance Check, Credibility Scan, Density Assessment, Audience Fit.
- **Scoring**: quality_score 1-10 with defined bands (1-3 low, 4-5 below avg, 6-7 solid, 8-9 strong, 10 exceptional). signal_noise_score 0-3 (noise -> essential).
- **Rules**: target_audience must be specific segments (not generic "developers"), worth_your_time starts with Yes/No/Maybe, honest critical scoring.

#### Prompt 3: truth_check
- **Model**: `anthropic/claude-sonnet-4` | **Temp**: 0.1 | **Max tokens**: 2500 | **JSON**: Yes
- **Methodology**: Adversarial verification protocol: extract claims, cross-reference with web search, triage by severity, detect patterns.
- **Claims array**: 3-8 claims with exact_text for inline highlighting, status (verified/false/disputed/unverified/opinion), sources, timestamps.
- **Issues array**: Each must explain WHY it matters, not just what's wrong. Uses exact issue type enum values.
- **Rating criteria**: Defined thresholds for each of the 5 overall_rating values.

#### Prompt 4: action_items
- **Model**: `anthropic/claude-sonnet-4` | **Temp**: 0.3 | **Max tokens**: 1200 | **JSON**: Yes
- **Methodology**: Strategic advisor extracting actionable intelligence. Identify -> Contextualize -> Prioritize -> Specify.
- **Rules**: 3-7 items ordered by priority, titles start with verbs, descriptions specific enough to act on, categories adapt to content domain.

#### Prompt 5: detailed_summary
- **Model**: `anthropic/claude-sonnet-4` | **Temp**: 0.4 | **Max tokens**: 3000 | **JSON**: No
- **Structure**: Core Argument -> Key Points (4-7 subsections) -> Evidence & Support -> Counterarguments & Limitations -> Bottom Line.
- **Rules**: Present tense, third person. Analytical not descriptive. Bold key terms. Include timestamps for video. Flowing paragraphs over bullet dumps.

#### Prompt 6: short_summary (Key Takeaways)
- **Model**: `anthropic/claude-sonnet-4` | **Temp**: 0.3 | **Max tokens**: 1500
- **Output**: JSON `{"mid_length_summary": "<markdown>"}` with bold TLDR, 5-8 substantive bullet points, closing caveats line.
- **Rules**: Each takeaway conveys a specific insight (not topic labels). Bold the most important phrase. Under 400 words.

#### Prompt 7: Topic extraction (hardcoded)
- **Model**: `anthropic/claude-3-haiku` (unchanged, cheap+fast)
- **Methodology**: Search query strategist targeting verifiable assertions. Prioritize time-sensitive claims. 3-5 queries as JSON array.

### Files Modified

| File | Change | Status |
|------|--------|--------|
| `scripts/backup-prompts-pre-rewrite.sql` | **CREATED** — Backup of all original prompts | DONE |
| `app/api/process-content/route.ts` | Updated hardcoded topic extraction prompt (~line 60) | DONE |
| Database: `analysis_prompts` table | UPDATE 5 rows (brief_overview, triage, truth_check, action_items, detailed_summary) | DONE |
| Database: `analysis_prompts` table | UPDATE short_summary row for consistency | DONE |
| Database: `active_summarizer_prompt` table | UPDATE row id=1 | DONE |

---

## Workstream 2B: Chrome Extension — Side Panel (COMPLETED)

### Goal
Build a Chrome extension that acts as a **lead generation funnel** — lightweight capture tool that drives signups and traffic to the website. This is a B2C acquisition channel, not a standalone product.

### Architecture Decisions

| Decision | Choice |
|----------|--------|
| UI type | Chrome Side Panel API |
| Purpose | Lead gen, NOT product replacement |
| Auth | Required — drives signups |
| Free tier | 5 analyses/month |
| What it shows | Teaser only (score + recommendation + one-liner) |
| Full analysis | Opens website in new tab |

### Folder Structure

```
chrome-extension/
  manifest.json           # Manifest V3
  background.js           # Service worker (icon click -> open panel)
  sidepanel.html          # Side panel markup
  sidepanel.js            # Side panel logic (auth, analyze, results)
  sidepanel.css           # Dark theme matching Vajra
  lib/
    api.js                # Calls Vajra API endpoints
    auth.js               # Supabase auth token management
    storage.js            # chrome.storage wrapper (tokens, usage)
  icons/
    icon-16.png
    icon-32.png
    icon-48.png
    icon-128.png
```

### Side Panel States

#### State 1: Logged Out

```
┌──────────────────────────────┐
│  [Vajra Logo]                │
│                              │
│  Analyze any webpage for     │
│  accuracy and quality.       │
│                              │
│  ┌────────────────────────┐  │
│  │       Log In           │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │       Sign Up          │  │
│  └────────────────────────┘  │
│                              │
│  Free: 5 analyses/month     │
│                              │
└──────────────────────────────┘
```

#### State 2: Ready

```
┌──────────────────────────────┐
│  [Vajra Logo]    [user@...]  │
│                              │
│  Current page:               │
│  example.com/article/...     │
│                              │
│  ┌────────────────────────┐  │
│  │  Analyze This Page     │  │
│  └────────────────────────┘  │
│                              │
│  3 of 5 free analyses left   │
│                              │
└──────────────────────────────┘
```

#### State 3: Processing

```
┌──────────────────────────────┐
│  [Vajra Logo]                │
│                              │
│  Analyzing...                │
│                              │
│  [=====>          ] 40%      │
│                              │
│  Fetching content...         │
│  Generating overview...      │
│  Fact-checking claims...     │
│                              │
└──────────────────────────────┘
```

#### State 4: Results Teaser

```
┌──────────────────────────────┐
│  [Vajra Logo]                │
│                              │
│  Quality: 7/10               │
│  [=======---]                │
│                              │
│  Recommendation: Worth It    │
│                              │
│  "Central thesis one-liner   │
│   from the brief overview    │
│   goes here..."              │
│                              │
│  ┌────────────────────────┐  │
│  │  View Full Analysis -> │  │
│  └────────────────────────┘  │
│                              │
│  2 of 5 free analyses left   │
│                              │
└──────────────────────────────┘
```

#### State 5: Limit Reached

```
┌──────────────────────────────┐
│  [Vajra Logo]                │
│                              │
│  You've used all 5 free      │
│  analyses this month.        │
│                              │
│  Upgrade to Pro for          │
│  unlimited analyses.         │
│                              │
│  ┌────────────────────────┐  │
│  │   Upgrade to Pro ->    │  │
│  └────────────────────────┘  │
│                              │
│  Resets on Feb 1             │
│                              │
└──────────────────────────────┘
```

### Extension Flow

1. User clicks extension icon -> side panel opens
2. If not logged in -> show login/signup buttons (open website auth pages)
3. After login -> store Supabase tokens in `chrome.storage.local`
4. User clicks "Analyze" -> get current tab URL via `chrome.tabs` API
5. Check usage limit -> if exceeded, show upgrade prompt
6. Create content record via Supabase REST API
7. Call `/api/process-content` with content_id
8. Poll `/api/content-status/[id]` every 2 seconds
9. When triage + brief_overview ready -> show teaser
10. "View Full Analysis" -> `chrome.tabs.create({ url: '/item/[id]' })`

### Implementation Steps

| # | Step | Status |
|---|------|--------|
| 1 | Create `chrome-extension/` directory with manifest.json | DONE |
| 2 | Implement `background.js` — service worker, side panel behavior | DONE |
| 3 | Implement `sidepanel.html` + `sidepanel.css` — all 5 UI states | DONE |
| 4 | Implement `lib/auth.js` — login flow, token storage, token refresh | DONE |
| 5 | Implement `lib/api.js` — content creation, process trigger, polling | DONE |
| 6 | Implement `lib/storage.js` — usage tracking, monthly reset | DONE |
| 7 | Implement `sidepanel.js` — wire everything together, state management | DONE |
| 8 | Add CORS headers to website for extension origin | DONE |
| 9 | Generate extension icons from Vajra branding | DONE (placeholder icons) |
| 10 | Test sideloading locally (chrome://extensions -> Load unpacked) | READY FOR USER |
| 11 | Publish to Chrome Web Store ($5 developer fee, 1-3 day review) | READY FOR USER |

### Website Changes for Extension Support

| File | Change |
|------|--------|
| `next.config.mjs` or middleware | Add CORS headers for `chrome-extension://` on API routes |
| `app/login/page.tsx` | Handle `?extension=true` query param for post-login token handoff |

---

## Workstream 2C: PWA + Knowledge Library (COMPLETED)

### C.1: PWA Setup (DONE)

| # | Step | File | Status |
|---|------|------|--------|
| 1 | Create service worker | `public/sw.js` | DONE |
| 2 | Create offline fallback page | `public/offline.html` | DONE |
| 3 | Enhance manifest | `app/manifest.ts` | DONE |
| 4 | Add install prompt banner | Homepage component | SKIPPED (not critical) |
| 5 | Generate PWA icons | `public/icons/` | DONE (SVG icons exist) |

#### PWA Files Created/Modified:
- `public/sw.js` — Service worker with aggressive caching strategy
- `public/offline.html` — Offline fallback page with Vajra branding
- `app/manifest.ts` — Enhanced with scope, orientation, categories, shortcuts, screenshots

### ~~C.2: Batch URL Analysis~~ (REMOVED)

**Decision**: Removed from plan. Batch processing leans B2B/enterprise and invites abuse (scraping services, bots, competitors mass-analyzing). Vajra is B2C — individual users encounter one piece of content at a time and want a quick verdict. If B2B becomes a goal later, batch can be reintroduced as a gated enterprise feature at a premium price point.

### C.3: Knowledge Library — Searchable History (DONE)

| # | Step | File | Status |
|---|------|------|--------|
| 1 | Add full-text search indexes | `scripts/023-add-fulltext-search.sql` | DONE |
| 2 | Create search endpoint | `app/api/search/route.ts` | DONE |
| 3 | Enhance library page | `app/library/page.tsx` | DONE |
| 4 | Add sort options | By date, quality score, relevance | DONE |

#### Knowledge Library Files Created/Modified:
- `scripts/023-add-fulltext-search.sql` — PostgreSQL full-text search migration:
  - Adds `search_vector` tsvector column to `content` table (title weight A, full_text weight B)
  - Adds `search_vector` tsvector column to `summaries` table (overview, summaries)
  - Creates GIN indexes for fast full-text queries
  - Creates `search_user_content()` function for relevance-ranked search
  - Creates `search_content_suggestions()` function for autocomplete
- `app/api/search/route.ts` — Search API endpoint:
  - GET: Full-text search with pagination and type filtering
  - POST: Autocomplete suggestions
  - Falls back to ILIKE if full-text search function not available
- `app/library/page.tsx` — Enhanced library page:
  - Search bar uses full-text search API when typing
  - Added "Best Quality" sort option (by quality_score)
  - Added score filter chips (All, 8+, 6-7, Below 6)
- `lib/hooks/use-library.ts` — Updated library hook:
  - Uses search API for queries, browse fetcher for browsing
  - Supports relevance-based sorting when searching

**Note**: The full-text search migration (`scripts/023-add-fulltext-search.sql`) needs to be applied to the database for full-text search to work. Until then, the search API falls back to ILIKE pattern matching.

---

## Execution Order

1. **Prompt Rewrite (2A)** — Code done, needs live URL test to verify output
2. **Chrome Extension (2B)** — Build after prompts are verified
3. **PWA (2C.1)** — Quick win, do alongside extension
4. **Knowledge Library (2C.3)** — After PWA

---

## Workstream 3: Infrastructure Migration

This workstream covers migrating to your own GitHub repo and Supabase project.

### 3.1: Database Migration to New Supabase

#### Migration Files (in order of execution)

| File | Purpose | When to Run |
|------|---------|-------------|
| `scripts/000-full-schema.sql` | Complete schema: tables, indexes, RLS policies, functions | Run FIRST on fresh database |
| `scripts/000b-insert-prompts.sql` | Current AI prompts (analysis, chat, summarizer) | Run SECOND |

**Note**: Files 002-023 are incremental migrations that have already been applied. They're kept for reference but NOT needed for a fresh setup since `000-full-schema.sql` includes everything.

#### Step-by-Step Migration Process

1. **Create new Supabase project**
   - Go to supabase.com and create new project
   - Note the project URL and anon key

2. **Run schema migration**
   ```bash
   # Get connection string from Supabase dashboard (Settings > Database)
   psql "YOUR_NEW_CONNECTION_STRING" -f scripts/000-full-schema.sql
   ```

3. **Insert AI prompts**
   ```bash
   psql "YOUR_NEW_CONNECTION_STRING" -f scripts/000b-insert-prompts.sql
   ```

4. **Create auth trigger** (run in Supabase SQL Editor)
   ```sql
   CREATE TRIGGER on_auth_user_created
       AFTER INSERT ON auth.users
       FOR EACH ROW EXECUTE FUNCTION handle_new_user();
   ```

5. **Update environment variables**
   - `NEXT_PUBLIC_SUPABASE_URL` → new project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → new anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → new service role key

6. **Update Chrome extension config**
   - `chrome-extension/lib/config.js` → update SUPABASE_URL and SUPABASE_ANON_KEY

#### Database Tables Summary

| Table | Purpose |
|-------|---------|
| `users` | User profiles (synced with Supabase Auth) |
| `content` | URLs submitted for analysis |
| `summaries` | AI-generated analysis (overview, triage, truth check, etc.) |
| `content_ratings` | User ratings (signal-to-noise score) |
| `chat_threads` | Chat conversations per content item |
| `chat_messages` | Individual chat messages |
| `hidden_content` | User-hidden items |
| `domains` | Domain credibility statistics |
| `analysis_prompts` | AI prompt configurations (6 prompt types) |
| `active_summarizer_prompt` | Short summary/key takeaways prompt |
| `active_chat_prompt` | Chat system prompt |
| `api_usage` | API call tracking |
| `processing_metrics` | Processing performance metrics |

#### Key Database Functions

| Function | Purpose |
|----------|---------|
| `search_user_content()` | Full-text search with relevance ranking |
| `search_content_suggestions()` | Autocomplete suggestions |
| `get_brain_content()` | Get content + summaries for chat context |
| `upsert_domain_stats()` | Update domain credibility stats |
| `add_tag_to_content()` | Add tag to content |
| `remove_tag_from_content()` | Remove tag from content |
| `handle_new_user()` | Auto-create user record on signup |

### 3.2: GitHub Migration

1. Create new repo on your GitHub account
2. Update remote: `git remote set-url origin git@github.com:YOUR_USERNAME/vajra-truth-checker.git`
3. Push all code: `git push -u origin main`
4. Update Vercel project to use new repo

### 3.3: Vercel Deployment

1. Connect new GitHub repo to Vercel
2. Update environment variables to new Supabase credentials
3. Redeploy

### 3.4: Chrome Extension Publishing

1. Update `chrome-extension/lib/config.js` with production URLs
2. Replace placeholder icons with real icons
3. Create Chrome Web Store developer account ($5 one-time fee)
4. Upload `chrome-extension/` folder as ZIP
5. Fill out store listing
6. Submit for review (1-3 days)

---

## TypeScript Interfaces (Reference — Prompt Outputs Must Match)

### TriageData
```typescript
{
  quality_score: number       // 1-10
  worth_your_time: string     // "Yes/No/Maybe - reason"
  target_audience: string[]   // Specific segments
  content_density: string     // "Low/Medium/High - description"
  estimated_value: string
  signal_noise_score: number  // 0-3
  content_category: ContentCategory
}
```

### TruthCheckData
```typescript
{
  overall_rating: "Accurate" | "Mostly Accurate" | "Mixed" | "Questionable" | "Unreliable"
  claims: ClaimHighlight[]    // 3-8 claims with exact_text for inline highlighting
  issues: TruthIssue[]        // type must be: misinformation|misleading|bias|unjustified_certainty|missing_context
  strengths: string[]
  sources_quality: string
}
```

### ClaimHighlight
```typescript
{
  exact_text: string          // EXACT phrase from content for highlighting
  status: "verified" | "false" | "disputed" | "unverified" | "opinion"
  explanation: string
  sources: string[]
  timestamp: string | null    // [M:SS] for videos
  severity: "low" | "medium" | "high"
}
```

### ActionItemsData
```typescript
// AI returns: { "action_items": ActionItemData[] }
// Code extracts the array and stores as ActionItemData[]
ActionItemData[]
// Each item:
{
  title: string               // Starts with verb
  description: string
  priority: "high" | "medium" | "low"
  category: string
}
```

### ContentCategory (enum)
```
music | podcast | news | opinion | educational | entertainment |
documentary | product_review | tech | finance | health | other
```

---

## Workstream 4: AI Auto-Tagging (COMPLETED)

### Goal
Automatically generate 3-5 topic tags when content is processed, eliminating manual-only tagging. Tags populate the existing `content.tags` column (`text[]`) and appear in the item page sidebar and Library tag filters with zero UI changes.

### Implementation

| # | Step | Status |
|---|------|--------|
| 1 | Insert `auto_tags` prompt into `clarus.analysis_prompts` | DONE — via Supabase MCP |
| 2 | Add `generateAutoTags()` + Phase 1 parallel integration | DONE — `app/api/process-content/route.ts` |

### Details

- **Prompt**: `auto_tags` type in `analysis_prompts` — uses `google/gemini-2.5-flash`, temp 0.2, max 200 tokens, expects JSON `{ "tags": [...] }`, web search disabled
- **Function**: `generateAutoTags()` — calls `generateSectionWithAI` with 2 retries (non-critical), lowercases/trims/validates (max 50 chars, max 5 tags)
- **Integration**: Runs as `autoTagPromise` in Phase 1 `Promise.all` alongside overview, triage, mid-summary, and detailed summary
- **No schema changes**: `content.tags` already exists as `text[]` with `add_tag_to_content()` / `remove_tag_from_content()` helpers
- **No UI changes**: Tag display, filtering, and manual add/remove already work end-to-end

### Files Modified

| File | Change |
|------|--------|
| `app/api/process-content/route.ts` | Added `generateAutoTags()` function + `autoTagPromise` in Phase 1 |
| Database: `clarus.analysis_prompts` | Inserted `auto_tags` prompt row |

---

## Verification Checklist

### Prompt Rewrite (2A)
- [ ] YouTube video analysis: all 6 cards render correctly
- [ ] Article analysis: all 6 cards render correctly
- [ ] Triage JSON matches TriageData interface
- [ ] TruthCheck JSON matches TruthCheckData interface (claims[] with exact_text)
- [ ] ActionItems JSON matches ActionItemsData interface
- [ ] Markdown formatting clean in Key Takeaways and Detailed Analysis
- [ ] Brief overview is plain text (no markdown)
- [ ] Web search context injected for truth_check, action_items, detailed_summary
- [ ] Web search NOT injected for brief_overview and triage

### Chrome Extension (2B) — Code Complete, Ready for Testing
- [ ] Sideload extension locally (chrome://extensions -> Load unpacked -> select chrome-extension/)
- [ ] Icon appears in toolbar
- [ ] Click icon -> side panel opens
- [ ] Login flow works (tokens stored in chrome.storage)
- [ ] "Analyze" detects current tab URL
- [ ] Processing shows progress
- [ ] Teaser displays score + recommendation + one-liner
- [ ] "View Full Analysis" opens /item/[id] in new tab
- [ ] Usage counter tracks analyses per month
- [ ] Limit enforcement shows upgrade prompt

### PWA (2C.1)
- [x] Service worker registered (`public/sw.js`)
- [x] Offline fallback works (`public/offline.html`)
- [x] Manifest enhanced with shortcuts, categories
- [ ] Install prompt appears (browser-dependent)

### Knowledge Library (2C.3)
- [x] Search API created (`app/api/search/route.ts`)
- [x] Score filter chips added (All, 8+, 6-7, Below 6)
- [x] Sort by quality score option added
- [ ] Apply migration `scripts/023-add-fulltext-search.sql` to database
- [ ] Test full-text search with relevance ranking

### Build Verification
```bash
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm typecheck
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm lint
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" && pnpm build
```

---

## Workstream 5: Features Shipped (Jan 29, 2026) — PR #9

| Feature | Description | Migration |
|---------|-------------|-----------|
| Shareable Analysis Links | Public `/share/[token]` pages, share modal Link+Email tabs, 12-char base62 tokens | `200-add-share-token.sql` |
| Reading List | Bookmark button on item page (desktop+mobile), settings gear "Reading List" label | None (uses existing `is_bookmarked`) |
| Weekly Digest Email | Vercel cron Sunday 2pm UTC, sends to `digest_enabled=true` users, digest preferences API | `201-add-digest-columns.sql` |
| Claim Tracking | Claims extracted during processing, pg_trgm similarity, cross-references API, purple badges | `202-create-claims-table.sql` |

---

## Workstream 6: Monetization — Competitive Analysis & Tier Design

**Date**: Jan 29, 2026

### Competitive Landscape: What They Offer vs. What Clarus Offers

#### Category A: AI Content Summarizers

| Feature | Glasp ($7/mo) | TLDR This | Scholarcy ($5/mo) | NoteGPT | Recall ($10/mo) | Summarize.tech | **Clarus** |
|---------|--------------|-----------|-------------------|---------|----------------|----------------|------------|
| Article summarization | Yes | Yes | Yes (academic) | Yes | Yes | No | **Yes** |
| YouTube summarization | Yes (3/day free) | No | No | Yes | Yes | Yes | **Yes** |
| X post analysis | No | No | No | No | No | No | **Yes** |
| Quality scoring (1-10) | No | No | No | No | No | No | **Yes** |
| Signal-to-noise rating | No | No | No | No | No | No | **Yes** |
| Fact-checking / truth check | No | No | No | No | No | No | **Yes** |
| Claim tracking across content | No | No | No | No | No | No | **Yes** |
| Chat with content | No | No | No | Limited | No | No | **Yes (voice+text)** |
| Action items extraction | No | No | No | No | No | No | **Yes** |
| Shareable analysis links | No | No | No | No | No | No | **Yes** |
| Weekly digest email | No | No | No | No | No | No | **Yes** |
| Community feed | Social highlights | No | No | No | No | No | **Yes** |
| Tags/organization | No | No | No | No | Auto-linking | No | **Yes (auto+manual)** |
| Domain credibility stats | No | No | No | No | No | No | **Yes** |
| Export (Markdown/PDF) | No | No | Word/PPT | No | No | No | **Yes** |

#### Category B: Fact-Checking Tools

| Feature | ClaimBuster | Full Fact | Logically | **Clarus** |
|---------|-------------|-----------|-----------|------------|
| Consumer-facing | No (research) | No (B2B) | No (enterprise) | **Yes** |
| URL-based analysis | No | No | No | **Yes** |
| Claim verification | Yes (automated) | Yes (professional) | Yes (enterprise) | **Yes (AI + web search)** |
| Cross-reference claims | No | No | No | **Yes (pg_trgm)** |
| Content summarization | No | No | No | **Yes (6 sections)** |
| Chat about claims | No | No | No | **Yes** |
| Pricing | Free (research) | B2B | Enterprise | **$0-16/mo** |

#### Category C: Document/Research Chat Tools

| Feature | ChatPDF ($20/mo) | Humata ($10-50/mo) | Perplexity ($20/mo) | Readwise ($10/mo) | **Clarus** |
|---------|------------------|-------------------|--------------------|-------------------|------------|
| Chat with content | Yes (PDF only) | Yes (uploaded files) | Yes (search-based) | No | **Yes (any URL)** |
| URL-based analysis | No | No | No | Yes (save) | **Yes (deep analysis)** |
| Quality scoring | No | No | No | No | **Yes** |
| Fact-checking | No | No | Partial (search) | No | **Yes (structured)** |
| Action items | No | No | No | No | **Yes** |
| Community/social | No | No | No | No | **Yes** |
| Export | Yes | Yes | No | Yes | **Yes** |

#### Key Pricing Data Points from Competitors

| Tool | Free Tier | Entry Paid | Standard | Pro/Team |
|------|-----------|------------|----------|----------|
| Glasp | 3 summaries/day | $7/mo | - | - |
| Recall | 10 total summaries | $10/mo | - | - |
| Humata | 60 pages/month | $1.99/mo (student) | $9.99/mo | $49/user/mo |
| ChatPDF | 2 docs/day | $19.99/mo | - | - |
| Perplexity | Limited queries | $20/mo | - | $200/mo |
| Otter.ai | 300 min/month | $8.33/mo | $20/mo | $30/user/mo |
| Elicit | 5,000 one-time credits | $12/mo | $49/mo | Custom |
| Readwise | - | $5.59/mo | $9.99/mo | - |
| Monica AI | 40 daily basic | $8.30/mo | $24.90/mo | - |

### The Claude/ChatGPT Question: Can Clarus Compete?

**The honest answer: No, Clarus cannot compete head-to-head with ChatGPT/Claude on raw summarization.** Any user can paste a URL into ChatGPT and get a summary. That's table stakes now.

**But Clarus doesn't need to compete on summarization. Here's why Clarus wins on a different axis:**

| Dimension | ChatGPT / Claude | Clarus |
|-----------|-----------------|--------|
| **Input** | User pastes URL, asks a question | User submits URL, gets structured analysis automatically |
| **Output** | One-shot text blob | 6 structured sections with scores, ratings, claims |
| **Persistence** | Gone after chat session | Saved to library permanently |
| **Quality scoring** | None | 1-10 score + signal-to-noise + worth-your-time |
| **Fact-checking** | Only if you ask | Automatic with claim verification + web search |
| **Claim tracking** | None | Cross-references across all your content |
| **History** | None (conversation-based) | Searchable library with tags, filters, sort |
| **Sharing** | Copy-paste chat | Public share links with full analysis |
| **Community** | None | Community feed to discover analyses |
| **Digest** | None | Weekly email summarizing your week |
| **Export** | Manual copy | Structured Markdown/PDF export |
| **Mobile** | App (general purpose) | PWA optimized for content analysis |
| **Chrome extension** | ChatGPT extension (general) | Side panel built for analyze-on-the-spot |

**Clarus's positioning is NOT "better AI summarizer" — it's "your personal content intelligence system."**

ChatGPT is a conversation tool. Clarus is a **workflow** — submit, analyze, save, track, share, discover. The moat is:
1. **Structured output** (scores, ratings, claims) vs. prose blobs
2. **Persistence** (library, tags, search) vs. ephemeral chat
3. **Cross-content intelligence** (claim tracking, domain credibility) vs. one-off answers
4. **Automated workflow** (one URL, 6 sections, no prompting) vs. manual prompt crafting

### Solo Dev ROI Analysis

#### Cost Structure (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Vercel (Pro) | $20/mo | Needed for cron jobs + 5min function timeout |
| Supabase (Free) | $0 | Free tier: 500MB DB, 50K MAU auth, 1GB storage |
| Supabase (Pro) | $25/mo | If you exceed free tier (likely at ~200+ users) |
| OpenRouter (AI) | Variable | ~$0.03-0.10 per analysis (6 AI calls) |
| Firecrawl | $0-19/mo | Free: 500 credits. Pro: $19/mo for 3K credits |
| Supadata | $0-15/mo | Free: limited. Paid for YouTube transcripts |
| Tavily | $0 | Free: 1,000 searches/month |
| Resend | $0 | Free: 100 emails/day (3,000/mo) |
| Domain | $12/yr | clarusapp.io |
| **Total fixed** | **$20-60/mo** | **Before AI costs** |

#### AI Cost Per Analysis (Estimated)

| Section | Model | Est. Cost |
|---------|-------|-----------|
| Brief overview | Claude Sonnet 4 | $0.005 |
| Triage | Claude Sonnet 4 | $0.008 |
| Key Takeaways | Claude Sonnet 4 | $0.010 |
| Truth Check | Claude Sonnet 4 | $0.015 |
| Action Items | Claude Sonnet 4 | $0.008 |
| Detailed Summary | Claude Sonnet 4 | $0.015 |
| Auto-tags | Gemini Flash | $0.001 |
| Web search (Tavily) | Tavily | $0 (free tier) |
| **Total per analysis** | | **~$0.06** |

#### Revenue Model

| Tier | Price | Users Needed for $1K MRR | Users Needed for $5K MRR |
|------|-------|--------------------------|--------------------------|
| Starter ($8/mo) | $8 | 125 | 625 |
| Pro ($16/mo) | $16 | 63 | 313 |
| **Blended (60% Starter, 40% Pro)** | ~$11.20 avg | **90** | **447** |

#### Break-Even Analysis

| Scenario | Fixed Costs | AI Cost (per user avg) | Break-Even Users |
|----------|-------------|----------------------|------------------|
| Early (Vercel Pro only) | $20/mo | ~$1.50/mo (25 analyses) | 2-3 paid users |
| Growth (Supa Pro + Firecrawl) | $64/mo | ~$1.50/mo | 7 paid users |
| Scale (500 users) | $64/mo + ~$750 AI | ~$1.50/mo | Already profitable at ~7 paid |

**Key insight**: With ~$0.06 per analysis and users averaging 25 analyses/month, AI costs per user are ~$1.50/mo. A Starter user at $8/mo leaves $6.50 margin. A Pro user at $16/mo leaves $14.50 margin. **You're profitable at 7 paying users.**

#### Realistic Revenue Timeline (Solo Dev)

| Month | Free Users | Paid Users | MRR | Notes |
|-------|-----------|------------|-----|-------|
| 1-2 | 50-100 | 0-3 | $0-24 | Launch, friends, ProductHunt |
| 3-4 | 200-500 | 10-25 | $80-280 | SEO starts ranking, word of mouth |
| 5-6 | 500-1K | 30-60 | $240-672 | Chrome extension drives signups |
| 7-12 | 1K-3K | 80-200 | $640-2,240 | Organic growth, content marketing |
| 12+ | 3K-10K | 200-500 | $2,240-5,600 | Established, SEO+AEO traffic |

**Realistic solo dev first-year target: $500-2,000 MRR by month 12.** Not life-changing, but it covers all costs and validates the product. The path to $5K+ MRR requires either viral growth, SEO dominance in the niche, or a B2B pivot.

### SEO/AEO Page Strategy

#### Pages to Create

| Page | Target Query | Content |
|------|-------------|---------|
| `/` (homepage) | "ai content analyzer" "ai article analysis" | Hero + features + CTA |
| `/features` | "ai fact checker for articles" "youtube video quality checker" | Deep feature showcase |
| `/use-cases/students` | "check if article is reliable for research" | Student-focused landing |
| `/use-cases/journalists` | "fact check article claims" "verify news sources" | Journalist-focused landing |
| `/use-cases/researchers` | "analyze research paper quality" | Researcher-focused landing |
| `/compare/chatgpt` | "chatgpt vs clarus" "better than chatgpt for articles" | Direct comparison |
| `/compare/glasp` | "glasp alternative" | Competitor comparison |
| `/compare/perplexity` | "perplexity alternative for content analysis" | Competitor comparison |
| `/blog/how-to-fact-check` | "how to fact check an article" "is this article reliable" | Educational content |
| `/blog/ai-content-analysis` | "ai content analysis tools 2026" | Listicle (Clarus featured) |
| `/tools/quality-score` | "check article quality score" "content quality analyzer" | Free tool (limited, drives signup) |
| `/tools/truth-check` | "fact check this article" "is this article true" | Free tool (limited, drives signup) |

#### AEO (Answer Engine Optimization) Strategy

For AI search engines (Perplexity, ChatGPT Search, Google AI Overviews):

1. **Structured data** — Add JSON-LD schema (SoftwareApplication, FAQPage, HowTo)
2. **FAQ sections** — Every landing page gets a FAQ that AI can quote
3. **Comparison tables** — Markdown tables that AI search engines parse well
4. **"Best X" positioning** — Blog posts targeting "best ai fact checker 2026" etc.

#### SEO Competitive Reality Check

**Can you rank for these terms as a solo dev?**

- "ai content analyzer" — **Medium difficulty**. Not dominated by giants. Clarus can rank on page 1 with good content.
- "fact check article" — **Hard**. Snopes, PolitiFact, Full Fact dominate. But "ai fact check article" is open.
- "youtube video summary" — **Hard**. Glasp, NoteGPT, Summarize.tech have head starts. Differentiate with "youtube video quality analysis" instead.
- "chatgpt alternative for article analysis" — **Low competition**. Long-tail, high intent. Easy win.
- "is this article reliable" — **Medium**. Mostly editorial content, not tools. Clarus could rank with a free tool page.

**Bottom line**: Target long-tail queries where "AI + analysis + quality + fact-check" intersect. Avoid head terms owned by big players. The comparison pages (`/compare/chatgpt`, `/compare/glasp`) are your highest-ROI SEO pages because they capture users already looking for alternatives.

### Clarus Tier Design (Final)

| Feature | Free | Starter ($8/mo) | Pro ($16/mo) |
|---------|------|-----------------|--------------|
| **Analyses per month** | 5 | 50 | Unlimited |
| **Analysis sections** | All 6 | All 6 | All 6 |
| **Chat messages per content** | 10 | Unlimited | Unlimited |
| **Library storage** | 25 items | 500 items | Unlimited |
| **Reading list (bookmarks)** | 5 items | 50 items | Unlimited |
| **Shareable links** | No | 10/month | Unlimited |
| **Claim tracking** | No | No | Full cross-referencing |
| **Weekly digest email** | No | Yes | Yes |
| **Community feed** | View only | View + post | View + post |
| **Tags / organization** | 3 tags max | Unlimited | Unlimited |
| **Export (Markdown/JSON)** | No | Yes | Yes |
| **Export (PDF)** | No | No | Yes |
| **Content types** | Articles + YouTube | + X posts, PDFs | All types |
| **Processing priority** | Standard | Standard | Priority queue |
| **Domain credibility stats** | No | Basic | Detailed |
| **Chrome extension** | 3 analyses/month | 50/month | Unlimited |
| **Support** | Community | Email | Priority email |
| **API access** | No | No | Yes (future) |

#### Annual Pricing
- **Starter**: $80/year ($6.67/mo — 17% off)
- **Pro**: $160/year ($13.33/mo — 17% off)

### Feature Gating Implementation Plan

#### Database Changes

```sql
-- Add tier column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier varchar(20) DEFAULT 'free';
-- Values: 'free', 'starter', 'pro'

-- Add monthly usage tracking
CREATE TABLE IF NOT EXISTS usage_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period varchar(7) NOT NULL, -- '2026-01' format
    analyses_count integer DEFAULT 0,
    chat_messages_count integer DEFAULT 0,
    share_links_count integer DEFAULT 0,
    exports_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, period)
);
```

#### Code Changes

| File | Change |
|------|--------|
| `lib/tier-limits.ts` | **CREATE** — Tier config: limits per tier, check functions |
| `lib/usage.ts` | **CREATE** — Usage tracking: increment, check, reset |
| `app/api/process-content/route.ts` | Add tier check before processing |
| `app/api/content/[id]/share-link/route.ts` | Add share link limit check |
| `app/api/chat/route.ts` | Add chat message limit check |
| `app/api/export/*/route.ts` | Add export permission check |
| `components/upgrade-prompt.tsx` | **CREATE** — Reusable upgrade modal |
| `types/database.types.ts` | Add `tier`, `usage_tracking` table types |
| `lib/schemas.ts` | Add tier validation |

#### Gating Middleware Pattern

```typescript
// lib/tier-limits.ts
const TIER_LIMITS = {
  free: { analyses: 5, chatMessages: 10, shareLinks: 0, bookmarks: 5, tags: 3, library: 25 },
  starter: { analyses: 50, chatMessages: Infinity, shareLinks: 10, bookmarks: 50, tags: Infinity, library: 500 },
  pro: { analyses: Infinity, chatMessages: Infinity, shareLinks: Infinity, bookmarks: Infinity, tags: Infinity, library: Infinity },
}

// Usage check in API routes:
const usage = await getUserUsage(userId, currentPeriod)
const limits = TIER_LIMITS[userTier]
if (usage.analyses_count >= limits.analyses) {
  return NextResponse.json({ error: "limit_reached", tier: userTier, limit: limits.analyses }, { status: 403 })
}
```
