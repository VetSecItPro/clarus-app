# Clarus Financial Model & Unit Economics

> **Document Purpose:** Acquisition readiness -- provides potential buyers with a clear understanding of Clarus's business economics, unit costs, margins, and path to profitability.
>
> **Last Updated:** February 2026

---

## Table of Contents

1. [Revenue Model](#1-revenue-model)
2. [Cost Per Analysis by Content Type](#2-cost-per-analysis-by-content-type)
3. [Monthly Infrastructure Costs](#3-monthly-infrastructure-costs)
4. [Unit Economics](#4-unit-economics)
5. [Break-Even Analysis](#5-break-even-analysis)
6. [Scaling Projections](#6-scaling-projections)
7. [Risk Factors](#7-risk-factors)
8. [Competitive Pricing Position](#8-competitive-pricing-position)

---

## 1. Revenue Model

### 1.1 Pricing Tiers

| Tier | Monthly | Annual | Annual Savings | Effective Monthly (Annual) |
|------|---------|--------|----------------|---------------------------|
| Free | $0 | $0 | -- | $0 |
| Starter | $18/mo | $144/yr | $72 (33% off) | $12.00/mo |
| Pro | $29/mo | $279/yr | $69 (20% off) | $23.25/mo |
| Day Pass | $10 (one-time) | -- | -- | -- |

Payment processing is handled through Polar. All tiers enforce hard caps on every feature -- there is no "unlimited" tier.

### 1.2 Annual Discount Breakdown

| Tier | Monthly x12 | Annual Price | Savings | Discount % |
|------|-------------|-------------|---------|------------|
| Starter | $216 | $144 | $72 | 33.3% |
| Pro | $348 | $279 | $69 | 19.8% |

Annual plans improve cash flow predictability and reduce churn. The Starter tier offers the steepest discount to incentivize conversion from Free.

### 1.3 Expected Tier Distribution

Based on SaaS industry benchmarks for freemium products (Lenny Rachitsky, OpenView Partners data):

| Tier | % of Users | Rationale |
|------|-----------|-----------|
| Free | ~95.0% | Standard freemium conversion rate (2-5% paid) |
| Starter | ~3.0% | Largest paid cohort; casual power users |
| Pro | ~1.5% | Researchers, journalists, content professionals |
| Day Pass | ~0.5% | Occasional users, one-off research needs |

Assumption: 60% of paying subscribers choose monthly billing; 40% choose annual (industry average for B2C SaaS).

### 1.4 MRR Calculations at Various User Counts

The following assumes the tier distribution above and a 60/40 monthly/annual billing split.

**Weighted ARPU (Average Revenue Per Paying User):**

| Tier | % of Paid | Monthly ARPU | Annual ARPU (monthly equiv.) | Blended ARPU |
|------|-----------|-------------|------------------------------|-------------|
| Starter | 60% | $18.00 | $12.00 | $15.60 |
| Pro | 30% | $29.00 | $23.25 | $26.70 |
| Day Pass | 10% | $10.00 (one-time) | -- | $10.00 |

Day Pass revenue is modeled as $10 per purchase with an estimated 1 purchase per user per quarter (monthly equivalent: ~$3.33).

**Blended monthly ARPU across all paid tiers:** ~$18.12

| Total Users | Paid Users (5%) | Est. MRR | Est. ARR |
|-------------|----------------|----------|----------|
| 100 | 5 | $91 | $1,087 |
| 1,000 | 50 | $906 | $10,872 |
| 5,000 | 250 | $4,530 | $54,360 |
| 10,000 | 500 | $9,060 | $108,720 |
| 50,000 | 2,500 | $45,300 | $543,600 |
| 100,000 | 5,000 | $90,600 | $1,087,200 |

---

## 2. Cost Per Analysis by Content Type

### 2.1 AI Analysis Pipeline

Each content analysis runs a pipeline of 9 AI calls plus up to 3 web searches:

**Pre-Processing Phase (2 parallel calls):**

| # | Call | Model | Est. Cost |
|---|------|-------|-----------|
| 1 | Tone Detection | Gemini 2.5 Flash Lite | ~$0.000045 |
| 2 | Web Search Topic Extraction | Gemini 2.5 Flash Lite | ~$0.000060 |

**Main Analysis Phase (6 parallel calls + 1 post-processing):**

| # | Call | Model | Est. Cost |
|---|------|-------|-----------|
| 3 | Brief Overview | Gemini 2.5 Flash | ~$0.00215 |
| 4 | Triage / Content Classification | Gemini 2.5 Flash | ~$0.00275 |
| 5 | Truth Check / Accuracy Analysis | Gemini 2.5 Flash | ~$0.00510 |
| 6 | Action Items | Gemini 2.5 Flash | ~$0.00215 |
| 7 | Mid-Length Summary | Gemini 2.5 Flash | ~$0.00215 |
| 8 | Detailed Summary | Gemini 2.5 Flash | ~$0.00560 |
| 9 | Auto-Tags | Gemini 2.5 Flash Lite | ~$0.000045 |

**Total AI cost per analysis:** $0.020 (typical)

**Web Search (Tavily):**
- Up to 3 searches per analysis (optimized from 5 via deduplication)
- $0.01 per search = $0.03 max per analysis
- Searches are shared across all sections (not per-section)

### 2.2 External API Costs by Service

| API | Operation | Cost Per Call | When Used |
|-----|-----------|-------------|-----------|
| Supadata | YouTube metadata | $0.0005 | YouTube content |
| Supadata | YouTube transcript | $0.001 | YouTube content |
| Firecrawl | Web scraping | $0.001 | Articles, PDFs, X/Twitter posts |
| Tavily | Web search | $0.01 | All analyses (up to 3 per analysis) |
| AssemblyAI | Transcription | $0.17/hr ($0.15 + $0.02 speaker diarization) | Podcasts only |

### 2.3 Total Cost Per Analysis by Content Type

| Content Type | AI Cost | External APIs | Web Search (Tavily) | Total Cost |
|-------------|---------|---------------|---------------------|------------|
| **YouTube video** | $0.020 | $0.0015 (Supadata) | $0.030 | **~$0.052** |
| **Article** | $0.020 | $0.001 (Firecrawl) | $0.030 | **~$0.051** |
| **PDF** | $0.020 | $0.001 (Firecrawl) | $0.030 | **~$0.051** |
| **X/Twitter post** | $0.020 | $0.001 (Firecrawl) | $0.030 | **~$0.051** |
| **Podcast (30 min)** | $0.020 | $0.085 (AssemblyAI) | $0.030 | **~$0.135** |
| **Podcast (60 min)** | $0.020 | $0.170 (AssemblyAI) | $0.030 | **~$0.220** |

**Note on X/Twitter posts:** For very short content (<280 chars), fewer topics are extracted, so Tavily calls may be 1-2 instead of 3, reducing total cost to ~$0.031-$0.041.

### 2.4 Chat Message Cost

Each chat message uses Gemini 2.5 Flash via OpenRouter:
- Input: $0.30 per 1M tokens
- Output: $2.50 per 1M tokens
- Typical chat exchange: ~2,000 input tokens + ~500 output tokens = ~$0.002 per message

---

## 3. Monthly Infrastructure Costs

### 3.1 Fixed Infrastructure by Scale

| Service | Early Stage (0-1K users) | Growth (1K-10K) | Scale (10K-100K) |
|---------|------------------------|-----------------|-------------------|
| Supabase | $0 (Free tier) | $25/mo (Pro) | $75-$150/mo |
| Vercel | $0 (Free tier) | $20/mo (Pro) | $150-$400/mo |
| Domain (clarusapp.io) | $15/yr (~$1.25/mo) | $15/yr (~$1.25/mo) | $15/yr (~$1.25/mo) |
| Resend (email) | $0 (Free tier) | $0-$20/mo | $20-$50/mo |
| Polar (payments) | Transaction fees only | Transaction fees only | Transaction fees only |
| **Total Fixed** | **~$1/mo** | **~$66/mo** | **~$276-$601/mo** |

### 3.2 Variable API Costs by Scale

Variable costs scale linearly with usage. Assumptions:
- Free users average 3 analyses/month (of 5 allowed)
- Starter users average 25 analyses/month (of 50 allowed)
- Pro users average 75 analyses/month (of 150 allowed)
- Day Pass users use 10 analyses per pass
- Content type mix: 50% articles/YouTube, 5% podcasts (avg 30 min), 45% other (articles, PDFs, X posts)
- Weighted average cost per analysis: ~$0.055 (includes podcast premium)

| Scale | Free Users | Paid Users | Total Analyses/mo | API Variable Cost/mo |
|-------|-----------|-----------|-------------------|---------------------|
| 100 users | 95 | 5 | 410 | ~$23 |
| 1,000 users | 950 | 50 | 3,850 | ~$212 |
| 5,000 users | 4,750 | 250 | 18,500 | ~$1,018 |
| 10,000 users | 9,500 | 500 | 36,250 | ~$1,994 |
| 50,000 users | 47,500 | 2,500 | 178,750 | ~$9,831 |
| 100,000 users | 95,000 | 5,000 | 356,250 | ~$19,594 |

### 3.3 Chat API Costs

Assumptions:
- Free users: ~20 messages/month (of 50 allowed)
- Starter users: ~100 messages/month (of 300 allowed)
- Pro users: ~300 messages/month (of 1,000 allowed)
- Cost per message: ~$0.002

| Scale | Total Chat Messages/mo | Chat API Cost/mo |
|-------|----------------------|-----------------|
| 100 users | 2,400 | ~$5 |
| 1,000 users | 23,500 | ~$47 |
| 5,000 users | 115,000 | ~$230 |
| 10,000 users | 227,500 | ~$455 |
| 50,000 users | 1,125,000 | ~$2,250 |
| 100,000 users | 2,237,500 | ~$4,475 |

---

## 4. Unit Economics

### 4.1 COGS Per Analysis (Weighted Average)

Based on the content type mix (50% article/YouTube, 5% podcast, 45% other):

| Component | Cost |
|-----------|------|
| AI calls (9 OpenRouter) | $0.020 |
| Web search (3 Tavily) | $0.030 |
| Content extraction (weighted avg) | $0.005 |
| **Weighted COGS per analysis** | **$0.055** |

Podcast analyses increase COGS significantly (~$0.135-$0.220), but they are capped at lower limits (10/mo Starter, 30/mo Pro) and represent only ~5% of total analyses.

### 4.2 Gross Margin Per Tier

Revenue per user assumes average utilization rates (not max allowed).

| Tier | Monthly Revenue | Avg Analyses/mo | Analysis COGS | Chat COGS (~$0.002/msg) | Gross Margin | Margin % |
|------|----------------|----------------|---------------|------------------------|-------------|----------|
| Free | $0.00 | 3 | $0.17 | $0.04 | -$0.21 | N/A |
| Starter (monthly) | $18.00 | 25 | $1.38 | $0.20 | $16.43 | 91.3% |
| Starter (annual) | $12.00 | 25 | $1.38 | $0.20 | $10.43 | 86.9% |
| Pro (monthly) | $29.00 | 75 | $4.13 | $0.60 | $24.28 | 83.7% |
| Pro (annual) | $23.25 | 75 | $4.13 | $0.60 | $18.53 | 79.7% |
| Day Pass | $10.00 | 10 | $0.55 | $0.05 | $9.40 | 94.0% |

**Key insight:** Even at aggressive utilization, gross margins exceed 79% across all paid tiers. The Day Pass has the highest margin because users rarely exhaust all 15 analyses in 24 hours.

### 4.3 Blended Gross Margin (Including Free Users)

Free users are a cost center. At the expected 95/5 free-to-paid ratio:

| Scale | Revenue/mo | Total COGS/mo | Blended Gross Margin | Margin % |
|-------|-----------|--------------|---------------------|----------|
| 1,000 users | $906 | $259 | $647 | 71.4% |
| 10,000 users | $9,060 | $2,449 | $6,611 | 73.0% |
| 100,000 users | $90,600 | $24,069 | $66,531 | 73.4% |

Blended margin improves slightly at scale because fixed infrastructure costs are amortized across more users.

### 4.4 Customer Acquisition Cost (CAC)

**Organic (current model):**
- SEO, content marketing, word-of-mouth, social media
- Estimated CAC: $0-$5 per registered user
- Estimated CAC for paid conversion: $0-$100 per paying customer (at 5% conversion)

**Paid acquisition (future):**
- Google Ads, social ads, influencer partnerships
- Estimated CAC: $15-$50 per registered user
- Estimated CAC for paid conversion: $300-$1,000 per paying customer (at 5% conversion)

**Blended target CAC:** <$200 per paying customer

### 4.5 Lifetime Value (LTV)

Churn assumptions based on B2C SaaS benchmarks:
- Monthly churn rate: 8% (typical for B2C SaaS)
- Average customer lifetime: 1/0.08 = 12.5 months
- Annual subscribers churn at 30% per year (lower due to annual lock-in)

| Tier | Monthly ARPU | Avg Lifetime | LTV | LTV (after COGS) |
|------|-------------|-------------|-----|-------------------|
| Starter (monthly) | $18.00 | 12.5 months | $225 | $205 |
| Starter (annual) | $12.00 | 20 months | $240 | $208 |
| Pro (monthly) | $29.00 | 12.5 months | $363 | $297 |
| Pro (annual) | $23.25 | 20 months | $465 | $372 |

**Blended LTV (after COGS):** ~$250

### 4.6 LTV:CAC Ratio

| Acquisition Channel | CAC | Blended LTV | LTV:CAC Ratio |
|---------------------|-----|-------------|---------------|
| Organic | ~$50 | $250 | **5.0x** |
| Paid (conservative) | ~$500 | $250 | **0.5x** |
| Blended (80% organic / 20% paid) | ~$140 | $250 | **1.8x** |

**Healthy benchmark:** LTV:CAC > 3x. Clarus achieves this through organic channels. Paid acquisition alone is not viable at current conversion rates -- the product must grow primarily through organic/viral channels until paid conversion rates improve (target: >10% free-to-paid).

---

## 5. Break-Even Analysis

### 5.1 Monthly Burn Rate by Stage

| Stage | Users | MRR | Total Costs/mo | Net Margin |
|-------|-------|-----|----------------|------------|
| Pre-launch | 0 | $0 | ~$1 | -$1 |
| Launch (100 users) | 100 | $91 | ~$29 | +$62 |
| Early growth (1K users) | 1,000 | $906 | ~$325 | +$581 |
| Growth (5K users) | 5,000 | $4,530 | ~$1,414 | +$3,116 |
| Scale (10K users) | 10,000 | $9,060 | ~$2,715 | +$6,345 |
| Large scale (50K users) | 50,000 | $45,300 | ~$12,681 | +$32,619 |

Total costs include: fixed infrastructure + variable API costs (analysis + chat).

### 5.2 Break-Even Point

Clarus reaches cash-flow break-even at approximately **15-20 total users** (assuming at least 1 paid subscriber). This is because:

1. Fixed infrastructure costs are near-zero on free tiers ($1/mo)
2. Variable costs only accrue when users actually analyze content
3. A single Starter subscriber ($18/mo) covers the variable cost of ~327 analyses

**Operational break-even** (covering a single founder's modest salary of $5,000/mo):
- Requires ~$5,500 MRR (to cover salary + costs)
- Achieved at approximately **600 total users** (30 paid) or **350 users** at a 8.5% paid conversion rate

### 5.3 Path to Profitability Timeline

| Milestone | Users | MRR | Timeline (est.) |
|-----------|-------|-----|-----------------|
| Launch | 100 | $91 | Month 0 |
| Cash-flow positive | 20 | $18 | Month 0 (day 1) |
| Covers infrastructure | 200 | $182 | Month 1-2 |
| Covers founder salary | 600 | $5,500 | Month 6-9 |
| $10K MRR | 1,100 | $10,000 | Month 12-18 |
| $50K MRR | 5,500 | $50,000 | Month 24-36 |

---

## 6. Scaling Projections

### 6.1 Comprehensive Scaling Table

| Metric | 100 | 1K | 5K | 10K | 50K | 100K |
|--------|-----|------|------|-------|--------|---------|
| **Total Users** | 100 | 1,000 | 5,000 | 10,000 | 50,000 | 100,000 |
| **Free Users** | 95 | 950 | 4,750 | 9,500 | 47,500 | 95,000 |
| **Starter Users** | 3 | 30 | 150 | 300 | 1,500 | 3,000 |
| **Pro Users** | 1.5 | 15 | 75 | 150 | 750 | 1,500 |
| **Day Pass Users** | 0.5 | 5 | 25 | 50 | 250 | 500 |
| | | | | | | |
| **MRR** | $91 | $906 | $4,530 | $9,060 | $45,300 | $90,600 |
| **ARR** | $1,087 | $10,872 | $54,360 | $108,720 | $543,600 | $1,087,200 |
| | | | | | | |
| **Analyses/month** | 410 | 3,850 | 18,500 | 36,250 | 178,750 | 356,250 |
| **Chat Messages/month** | 2,400 | 23,500 | 115,000 | 227,500 | 1,125,000 | 2,237,500 |
| | | | | | | |
| **API Costs (analysis)** | $23 | $212 | $1,018 | $1,994 | $9,831 | $19,594 |
| **API Costs (chat)** | $5 | $47 | $230 | $455 | $2,250 | $4,475 |
| **Infrastructure** | $1 | $66 | $166 | $266 | $601 | $601 |
| **Total Costs** | $29 | $325 | $1,414 | $2,715 | $12,682 | $24,670 |
| | | | | | | |
| **Gross Profit** | $62 | $581 | $3,116 | $6,345 | $32,618 | $65,930 |
| **Gross Margin %** | 68.1% | 64.1% | 68.8% | 70.0% | 72.0% | 72.8% |

### 6.2 Revenue Per Analysis (Efficiency Metric)

| Scale | Revenue/Analysis | COGS/Analysis | Margin/Analysis |
|-------|-----------------|---------------|-----------------|
| 1K users | $0.235 | $0.067 | $0.168 |
| 10K users | $0.250 | $0.068 | $0.182 |
| 100K users | $0.254 | $0.068 | $0.186 |

Revenue per analysis improves slightly at scale because infrastructure costs are fixed while analyses scale linearly.

---

## 7. Risk Factors

### 7.1 API Price Changes

| Provider | Current Cost | Risk Level | Mitigation |
|----------|-------------|-----------|------------|
| OpenRouter (Gemini 2.5 Flash) | $0.30/$2.50 per 1M tokens | **Medium** | Multi-model support in codebase; can switch to cheaper models |
| Tavily | $0.01/search | **Low** | Can reduce searches per analysis (currently 3, was 5); can substitute with Brave Search API |
| Supadata | $0.001/request | **Low** | YouTube transcript alternatives exist (yt-dlp for self-hosting) |
| Firecrawl | $0.001/scrape | **Low** | Can self-host scraping; Cheerio/Puppeteer alternatives |
| AssemblyAI | $0.17/hr | **Medium** | Whisper self-hosting is possible but adds infrastructure complexity |

**Historical trend:** AI API costs have decreased 80-90% over the past 2 years. The current cost basis is likely to improve, not worsen.

### 7.2 Free Tier Abuse

| Threat | Mitigation |
|--------|-----------|
| Bot sign-ups burning analysis quota | Rate limiting (per-IP and per-user), email verification required |
| Account farming (many free accounts) | Google OAuth prioritized; email verification; device fingerprinting (future) |
| Scraping analyzed content | Auth required for all data access; no public API |

**Structural protection:** Free tier is capped at 5 analyses/month and 50 chat messages/month. Even if 1,000 bot accounts each use all 5 analyses, the total API cost is only ~$275/month -- less than the revenue from 15 Starter subscribers.

### 7.3 Churn Rate Sensitivity

| Monthly Churn | Avg Lifetime | Blended LTV | LTV:CAC (Organic) |
|--------------|-------------|-------------|-------------------|
| 5% (optimistic) | 20 months | $362 | 7.2x |
| 8% (baseline) | 12.5 months | $250 | 5.0x |
| 12% (pessimistic) | 8.3 months | $151 | 3.0x |
| 15% (crisis) | 6.7 months | $121 | 2.4x |

The business remains viable (LTV:CAC > 2x) even at a 15% monthly churn rate, though growth would require significantly more investment in retention.

### 7.4 Currency & International Considerations

- All pricing is in USD; international users pay through Polar which handles currency conversion
- No VAT/GST collection is currently implemented (potential compliance risk at scale in EU/UK/AU)
- Polar handles payment processing compliance (PCI DSS)

### 7.5 Concentration Risk

| Risk | Exposure | Mitigation |
|------|----------|-----------|
| OpenRouter dependency | 100% of AI calls route through OpenRouter | OpenRouter itself is a multi-provider proxy; if it fails, direct model API access is possible |
| Google Gemini model dependency | ~100% of AI calls use Gemini models | Codebase supports model switching via database config; Claude, GPT-4o supported |
| Supabase dependency | 100% of data storage + auth | Standard Postgres; can migrate to any Postgres host |
| Vercel dependency | 100% of hosting + serverless | Standard Next.js; can deploy to AWS, Railway, Fly.io |

---

## 8. Competitive Pricing Position

### 8.1 Competitive Landscape

| Product | Price | What You Get |
|---------|-------|-------------|
| **Clarus Free** | $0/mo | 5 analyses: 6-section deep analysis with truth-checking |
| **Clarus Starter** | $18/mo | 50 analyses: full analysis + sharing + exports |
| **Clarus Pro** | $29/mo | 150 analyses: everything + claim tracking + priority |
| Eightify | $9.99/mo | YouTube summary only (single section, no truth-checking) |
| ChatGPT Plus | $20/mo | General-purpose AI; no structured analysis framework |
| Perplexity Pro | $20/mo | Search + summary; no multi-section analysis |
| NoteGPT | $9.99/mo | YouTube/article summary; basic output |
| Summarize.tech | Free/limited | YouTube-only, basic summary |

### 8.2 Value Proposition Differentiation

**Clarus vs. simple summarizers (Eightify, NoteGPT, Summarize.tech):**
- 6 structured analysis sections vs. 1 generic summary
- Real-time web search verification (truth-checking) -- no competitor offers this
- Cross-content claim tracking (Pro tier)
- Multi-format support (YouTube, articles, podcasts, PDFs, X/Twitter)

**Clarus vs. general AI (ChatGPT, Perplexity):**
- Purpose-built analysis framework -- consistent output structure every time
- No prompt engineering required from the user
- Persistent library with searchable history
- Tone-aware output that matches the content's voice

### 8.3 Cost Advantage

Clarus has a structural cost advantage over general-purpose AI tools:

| Metric | Clarus (Starter) | ChatGPT Plus | Perplexity Pro |
|--------|-----------------|-------------|----------------|
| Monthly price | $18 | $20 | $20 |
| Analyses per $ | 2.78 analyses/$ | N/A (manual work) | N/A (manual work) |
| Time per analysis | ~30 seconds (automated) | ~5-10 min (manual prompting) | ~3-5 min (manual) |
| Structured output | Yes (6 sections) | No (free-form) | No (free-form) |
| Truth-checking | Automated (Tavily-backed) | Manual | Built-in (search) |

**Cost per analysis to the user:**
- Clarus Starter: $0.36/analysis (at $18/mo, 50 analyses)
- Clarus Pro: $0.19/analysis (at $29/mo, 150 analyses)
- ChatGPT Plus: ~$2-5/analysis (factoring in user time at $50/hr)

### 8.4 Pricing Power Assessment

Current pricing is **conservatively positioned**. Evidence:

1. **High gross margins (80-94%)** leave room for cost absorption if API prices rise
2. **Below market rate** vs. ChatGPT/Perplexity ($20/mo) while delivering more structured value
3. **Day Pass** captures price-sensitive users who won't subscribe but will pay $10 for a day of access
4. **Annual discounts** (up to 33%) are competitive with industry norms (typically 15-20%)

**Potential future pricing actions:**
- Team/Enterprise tier ($49-$99/mo) once collaboration features are built
- API access tier for developers ($99/mo)
- Increase Pro from $29 to $39/mo after establishing market position (test with new cohorts)

---

## Appendix A: Key Assumptions

| Assumption | Value | Source |
|-----------|-------|--------|
| Free-to-paid conversion rate | 5% | Industry benchmark (Lenny Rachitsky) |
| Monthly churn (paid) | 8% | B2C SaaS benchmark |
| Annual churn | 30% | Typical annual plan retention |
| Monthly/annual billing split | 60/40 | Industry average |
| Free tier avg utilization | 60% (3 of 5 analyses) | Conservative estimate |
| Starter avg utilization | 50% (25 of 50 analyses) | Conservative estimate |
| Pro avg utilization | 50% (75 of 150 analyses) | Conservative estimate |
| Content type mix | 50% article/YouTube, 5% podcast, 45% other | Conservative estimate |
| Weighted avg cost per analysis | $0.055 | Calculated from pipeline costs |
| Chat messages per month per user | Varies by tier | Conservative estimates |

## Appendix B: API Pricing Reference (as of February 2026)

| API | Model/Service | Input Price | Output Price | Unit |
|-----|--------------|------------|-------------|------|
| OpenRouter | Gemini 2.5 Flash | $0.30 | $2.50 | per 1M tokens |
| OpenRouter | Gemini 2.5 Flash Lite | $0.10 | $0.40 | per 1M tokens |
| OpenRouter | Gemini 2.5 Pro | $1.25 | $10.00 | per 1M tokens |
| Tavily | Web search | $0.01 | -- | per request |
| Supadata | YouTube transcript | $0.001 | -- | per request |
| Supadata | YouTube metadata | $0.0005 | -- | per request |
| Firecrawl | Web scraping | $0.001 | -- | per request |
| AssemblyAI | Transcription + diarization | $0.17 | -- | per hour |

## Appendix C: Model Configuration

All AI model assignments are stored in the database (not hardcoded). This enables model switching without code deployment:

| Table | Controls |
|-------|---------|
| `analysis_prompts` | 6 analysis sections + keyword extraction + tone detection |
| `active_chat_prompt` | Chat model and system prompt |
| `active_summarizer_prompt` | Mid-length summarizer model and prompt |

This architecture means AI costs can be adjusted in real-time by switching models (e.g., from Gemini 2.5 Flash to a cheaper/better model) without any code changes or deployments.
