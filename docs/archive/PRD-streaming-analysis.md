# PRD: Real-Time Streaming Analysis

**Date:** December 22, 2025
**Priority:** High
**Status:** Draft

---

## 1. Problem Statement

### Current Flow (Broken)
```
User pastes URL
    ↓
Processing Screen (10-30+ seconds)
  - Reading clipboard
  - Creating entry
  - Fetching content
  - Generating summary
  - Complete
    ↓
Redirect to /item/[id]
    ↓
Show single "mid_length_summary"
```

### Issues
| Problem | Impact |
|---------|--------|
| Blocking processing screen | Users wait 10-30s staring at spinner |
| No streaming | Must wait for entire summary before seeing anything |
| Single summary type | No depth - just one generic summary |
| No truth-checking | Core value prop missing |
| No quality triage | Users can't quickly assess content worth |

---

## 2. Proposed Solution

### New Flow
```
User pastes URL
    ↓
Immediately redirect to /item/[id]
    ↓
Sections populate in real-time as AI generates them:
  1. Brief Overview (first, ~5 seconds)
  2. Triage Score (quality, audience, worth-it rating)
  3. Truth Check (bias, misinformation, certainty issues)
  4. Short Summary (key points)
  5. Detailed Summary (comprehensive analysis)
```

### UX Improvement
- **Before:** Wait 30s → See content
- **After:** Wait 0s → Watch content appear piece by piece

---

## 3. New Summary Sections

### Section 1: Brief Overview
**Purpose:** Quick answer to "What can I expect to learn?"
```
Example:
"This 2-hour podcast covers the future of AI regulation,
featuring debates on open-source vs closed models,
government oversight proposals, and industry responses."
```
- **Length:** 2-3 sentences
- **Tone:** Informative, neutral
- **Generate first:** Yes (fastest to produce)

### Section 2: Triage
**Purpose:** Should I consume this? Is it worth my time?
```json
{
  "quality_score": 7.5,
  "worth_your_time": "Yes, if interested in AI policy",
  "target_audience": ["Tech professionals", "Policy makers", "AI researchers"],
  "content_density": "High - packed with insights",
  "time_investment": "2 hours (or 15 min with summary)"
}
```
- **Display:** Visual cards/badges
- **Quick scan:** User decides in <5 seconds

### Section 3: Truth Check
**Purpose:** Objective analysis of content reliability
```json
{
  "overall_rating": "Mostly Accurate",
  "issues_found": [
    {
      "type": "unverified_claim",
      "claim": "AI will replace 80% of jobs by 2030",
      "assessment": "No credible source cited",
      "severity": "medium"
    },
    {
      "type": "bias",
      "description": "Heavy pro-regulation stance",
      "severity": "low"
    }
  ],
  "certainty_issues": ["Speaker presents predictions as facts"],
  "sources_quality": "Mixed - some peer-reviewed, some anecdotal"
}
```
- **Categories:**
  - Misinformation / False claims
  - Misleading framing
  - Bias (political, commercial, ideological)
  - Unjustified certainty
  - Missing context
  - Source quality

### Section 4: Short Summary
**Purpose:** Key takeaways (similar to current `mid_length_summary`)
- **Length:** 3-5 bullet points or 2-3 paragraphs
- **Focus:** Main arguments and conclusions

### Section 5: Detailed Summary
**Purpose:** Comprehensive analysis of every argument
- **Length:** Long-form, no limit
- **Structure:**
  - For podcasts/videos: Topic-by-topic breakdown with timestamps
  - For articles: Section-by-section analysis
  - Include: What was said, context, implications
- **Example for 2-hour podcast:**
  ```
  ## Topic 1: Open Source AI (0:00 - 0:25)
  The guests debated whether open-source AI models pose security risks...
  - Guest A argued: [detailed position]
  - Guest B countered: [detailed response]
  - Key tension: [summary of disagreement]

  ## Topic 2: Government Regulation (0:25 - 0:55)
  ...
  ```

---

## 4. Database Changes

### New `summaries` Table Schema
```sql
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS brief_overview TEXT;
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS triage JSONB;
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS truth_check JSONB;
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS short_summary TEXT;
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS detailed_summary TEXT;
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Rename existing column for clarity
ALTER TABLE summaries RENAME COLUMN mid_length_summary TO short_summary;

-- Add index for real-time updates
CREATE INDEX IF NOT EXISTS idx_summaries_content_id_updated
ON summaries(content_id, updated_at DESC);
```

### Processing Status Values
- `pending` - Not started
- `overview_complete` - Brief overview done
- `triage_complete` - Triage done
- `truth_check_complete` - Truth check done
- `short_summary_complete` - Short summary done
- `complete` - All sections done
- `error` - Processing failed

---

## 5. API Changes

### Option A: Streaming API (Recommended)
New endpoint: `POST /api/process-content-stream`

```typescript
// Returns Server-Sent Events (SSE)
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Process sections sequentially, emit as each completes
  async function processAndStream() {
    // 1. Brief Overview (fastest)
    const overview = await generateOverview(content);
    await saveSection('brief_overview', overview);
    await writer.write(encoder.encode(`data: ${JSON.stringify({ section: 'brief_overview', content: overview })}\n\n`));

    // 2. Triage
    const triage = await generateTriage(content);
    await saveSection('triage', triage);
    await writer.write(encoder.encode(`data: ${JSON.stringify({ section: 'triage', content: triage })}\n\n`));

    // 3. Truth Check
    const truthCheck = await generateTruthCheck(content);
    await saveSection('truth_check', truthCheck);
    await writer.write(encoder.encode(`data: ${JSON.stringify({ section: 'truth_check', content: truthCheck })}\n\n`));

    // 4. Short Summary
    const shortSummary = await generateShortSummary(content);
    await saveSection('short_summary', shortSummary);
    await writer.write(encoder.encode(`data: ${JSON.stringify({ section: 'short_summary', content: shortSummary })}\n\n`));

    // 5. Detailed Summary (slowest)
    const detailedSummary = await generateDetailedSummary(content);
    await saveSection('detailed_summary', detailedSummary);
    await writer.write(encoder.encode(`data: ${JSON.stringify({ section: 'detailed_summary', content: detailedSummary })}\n\n`));

    await writer.write(encoder.encode(`data: ${JSON.stringify({ section: 'complete' })}\n\n`));
    await writer.close();
  }

  processAndStream();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Option B: Polling + Supabase Realtime
- Client subscribes to `summaries` table changes
- API updates sections one by one
- Client receives real-time updates via Supabase Realtime

```typescript
// Client-side
const channel = supabase
  .channel('summary-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'summaries',
    filter: `content_id=eq.${contentId}`
  }, (payload) => {
    setSummary(payload.new);
  })
  .subscribe();
```

---

## 6. AI Prompts

### Brief Overview Prompt
```
You are analyzing content for a truth-checking app. Generate a brief overview.

Content: {{CONTENT}}

Respond with 2-3 sentences answering: "What can I expect to learn if I consume this content?"

Keep it factual, neutral, and informative. No opinions.
```

### Triage Prompt
```
Analyze this content and provide a triage assessment.

Content: {{CONTENT}}

Return JSON:
{
  "quality_score": <1-10>,
  "worth_your_time": "<Yes/No/Maybe> - <brief reason>",
  "target_audience": ["<audience 1>", "<audience 2>"],
  "content_density": "<Low/Medium/High> - <description>",
  "estimated_value": "<what you'll gain from consuming this>"
}
```

### Truth Check Prompt
```
You are a fact-checker. Analyze this content for accuracy and bias.

Content: {{CONTENT}}

Return JSON:
{
  "overall_rating": "<Accurate/Mostly Accurate/Mixed/Questionable/Unreliable>",
  "issues": [
    {
      "type": "<misinformation|misleading|bias|unjustified_certainty|missing_context>",
      "claim_or_issue": "<the problematic content>",
      "assessment": "<why it's problematic>",
      "severity": "<low|medium|high>"
    }
  ],
  "strengths": ["<what the content does well>"],
  "sources_quality": "<assessment of cited sources>"
}

Be objective. Flag genuine issues, not minor imperfections.
```

### Short Summary Prompt
```
Summarize the key points of this content.

Content: {{CONTENT}}

Provide 3-5 bullet points or 2-3 paragraphs covering:
- Main thesis/argument
- Key supporting points
- Notable conclusions or takeaways
```

### Detailed Summary Prompt
```
Provide a comprehensive analysis of this content.

Content: {{CONTENT}}
Type: {{TYPE}} (youtube/article/x_post)
Duration: {{DURATION}} (if video)

For videos/podcasts:
- Break down by topic/segment
- Include approximate timestamps
- Explain what was discussed, not just what topics were mentioned
- Capture the nuance of different viewpoints

For articles:
- Analyze section by section
- Include key quotes where relevant
- Explain the author's reasoning

Be thorough. For a 2-hour podcast, this summary should be 2000+ words.
```

---

## 7. Frontend Changes

### Remove Processing Screen
Delete the processing UI in `app/page.tsx` (lines 183-249).

### New Item Page Layout
```
┌─────────────────────────────────────────┐
│ [Back] [Summary] [Full Text]   [Actions]│
├─────────────────────────────────────────┤
│ Title                                   │
│ metadata (domain, author, duration)     │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 📋 Brief Overview                   │ │
│ │ Loading... / Content appears here   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📊 Triage                           │ │
│ │ Quality: ████████░░ 8/10            │ │
│ │ Worth it: Yes, for tech enthusiasts │ │
│ │ Audience: [Dev] [PM] [Founder]      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ✓ Truth Check                       │ │
│ │ Overall: Mostly Accurate            │ │
│ │ ⚠️ 2 issues found                   │ │
│ │   - Unverified claim about...       │ │
│ │   - Slight bias toward...           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📝 Short Summary                    │ │
│ │ • Key point 1                       │ │
│ │ • Key point 2                       │ │
│ │ • Key point 3                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📖 Detailed Summary          [▼]    │ │
│ │ ## Topic 1 (0:00-15:00)             │ │
│ │ Full analysis of first topic...     │ │
│ │                                     │ │
│ │ ## Topic 2 (15:00-45:00)            │ │
│ │ Full analysis of second topic...    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Signal/Noise Rating]                   │
└─────────────────────────────────────────┘
```

### Loading States
Each section shows skeleton loader until populated:
```tsx
{summary.brief_overview ? (
  <MarkdownRenderer>{summary.brief_overview}</MarkdownRenderer>
) : (
  <Skeleton className="h-20 w-full" />
)}
```

---

## 8. Caching Strategy

### Content Cache
```typescript
// Cache scraped content to avoid re-fetching
const CONTENT_CACHE_KEY = `content:${contentId}:full_text`;
const cached = await redis.get(CONTENT_CACHE_KEY);
if (cached) return cached;

const content = await scrapeContent(url);
await redis.setex(CONTENT_CACHE_KEY, 86400, content); // 24hr cache
```

### Summary Cache
- Summaries stored in DB (already cached)
- Don't regenerate unless user explicitly requests

### API Response Cache
```typescript
// Cache API responses for identical content
const SUMMARY_CACHE_KEY = `summary:${contentHash}:${section}`;
```

---

## 9. Implementation Phases

### Phase 1: Database + Basic Streaming (Day 1-2)
- [ ] Run migration to add new columns
- [ ] Create streaming API endpoint
- [ ] Update item page to show multiple sections
- [ ] Add skeleton loaders

### Phase 2: AI Prompts + Generation (Day 2-3)
- [ ] Create 5 new AI prompts in DB
- [ ] Implement section-by-section generation
- [ ] Test with YouTube videos
- [ ] Test with articles

### Phase 3: Remove Processing Screen (Day 3)
- [ ] Remove processing UI from home page
- [ ] Redirect immediately to item page
- [ ] Add Supabase Realtime subscription
- [ ] Polish loading states

### Phase 4: UI Polish (Day 4)
- [ ] Design triage cards
- [ ] Design truth check display
- [ ] Add collapsible detailed summary
- [ ] Mobile responsive testing

### Phase 5: Performance (Day 5)
- [ ] Add Redis caching
- [ ] Optimize AI calls (parallel where possible)
- [ ] Add error recovery
- [ ] Load testing

---

## 10. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to first content | 10-30s | <3s |
| Time to full summary | 30-60s | 30-60s (same, but user sees progress) |
| User perceived wait | 30s blocked | 0s (immediate redirect) |
| Summary sections | 1 | 5 |
| Truth-checking | None | Full analysis |

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI costs increase (5x more prompts) | Use cheaper models for simpler sections (overview, triage) |
| Long content = slow detailed summary | Stream detailed summary in chunks, show progress |
| Streaming fails mid-way | Save each section immediately, allow partial display |
| User leaves before complete | Sections persist in DB, available on return |

---

## 12. Open Questions

1. **Model routing:** Should we use different models per section?
   - Overview/Triage: GPT-4 Mini (fast, cheap)
   - Truth Check: Claude (nuanced reasoning)
   - Detailed: GPT-4 (long context)

2. **Parallel vs Sequential:** Can we generate sections in parallel?
   - Overview + Triage + Short Summary: Parallel (independent)
   - Truth Check: Needs full content analysis
   - Detailed: Needs full content analysis

3. **Caching granularity:** Cache per-section or full summary?

---

## Appendix: Current Code References

- Processing screen: `app/page.tsx:183-249`
- Process API: `app/api/process-content/route.ts`
- Item page: `app/item/[id]/page.tsx`
- Summary display: `app/item/[id]/page.tsx:369-389`
- Current prompt fetch: `app/api/process-content/route.ts:284-294`
