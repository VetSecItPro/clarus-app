# Vajra Truth Checker - Features & Optimization Proposals
**Date:** December 21, 2025

---

## 1. Core Fact-Checking Enhancements

### Claim Detection & Source Verification
- **Auto-extract claims** from content (like [ClaimBuster](https://journaliststoolbox.ai/ai-fact-checking-tools/))
- **Cross-reference with fact-check databases** via [Google Fact Check Explorer API](https://newsinitiative.withgoogle.com/resources/trainings/google-fact-check-tools/)
- **Source credibility scoring** - rate sources based on historical accuracy
- **Claim-by-claim breakdown** with evidence links (like [Originality.AI](https://originality.ai/automated-fact-checker))

### Visual Content Verification
- Image reverse search integration (like [InVID-WeVerify](https://ijnet.org/en/story/tracking-disinformation-these-ai-tools-can-help))
- Detect manipulated images/deepfakes
- Check images against "Database of Known Fakes"

---

## 2. AI Summarization Upgrades

### Multi-Format Summaries (inspired by [NoteGPT](https://notegpt.io/youtube-video-summarizer), [Eightify](https://eightify.app/))
- **Bullet points** - key takeaways
- **Mind maps** - visual content structure
- **Timestamped summaries** - click to jump to video section
- **TL;DR** - one-sentence summary
- **FAQ generation** - auto-generate Q&A from content

### Summary Customization
- Adjustable length (brief/detailed)
- Focus areas (facts only, opinions, statistics)
- Custom prompts per user
- Multiple AI model options (GPT-4, Claude, Gemini)

---

## 3. Gamification System

### XP & Progression (based on [Duolingo model](https://trophy.so/blog/when-your-app-needs-xp-system))
| Action | XP |
|--------|-----|
| Add content | +10 |
| Rate content | +5 |
| Correct rating (matches consensus) | +15 |
| Daily login | +5 |
| 7-day streak | +50 bonus |

### Streaks & Milestones ([40-60% higher DAU](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps))
- Daily check-in streaks
- Streak multipliers (7-day = 1.5x XP, 30-day = 2x)
- Streak freeze (1 free per week)
- Milestone badges (10, 50, 100 content verified)

### Reputation System (like [Stack Overflow](https://trophy.so/blog/points-feature-gamification-examples))
- Earn reputation from accurate ratings
- Lose reputation for consistently wrong ratings
- Unlock privileges at thresholds:
  - 100 rep: Edit prompts
  - 500 rep: Flag content
  - 1000 rep: Trusted rater badge

### Badges & Achievements
- "Truth Seeker" - verified 50 items
- "Myth Buster" - caught 10 false claims
- "Consistency King" - 30-day streak
- "Deep Diver" - read 100 full articles

### Gamification Implementation TODO

#### Database Changes
- [ ] Create `user_streaks` table:
  ```sql
  id, user_id, current_streak, longest_streak, last_activity_date, streak_frozen_until
  ```
- [ ] Create `badges` table:
  ```sql
  id, name, description, icon, requirement_type, requirement_value, tier (bronze/silver/gold)
  ```
- [ ] Create `user_badges` table:
  ```sql
  id, user_id, badge_id, earned_at
  ```
- [ ] Create `xp_transactions` table (audit trail):
  ```sql
  id, user_id, amount, action_type, reference_id, created_at
  ```
- [ ] Add indexes on `users.xp`, `users.reputation` for leaderboard queries

#### Backend Logic (API Routes)
- [ ] `POST /api/xp/award` - Award XP for actions:
  - +10 add content
  - +5 rate content
  - +15 rating matches consensus
  - +5 daily login
  - +50 7-day streak bonus
- [ ] `GET /api/leaderboard` - Fetch top users by XP/reputation
- [ ] `POST /api/streaks/check-in` - Update daily streak
- [ ] `GET /api/badges/check` - Check & award earned badges
- [ ] `GET /api/user/stats` - Fetch user's XP, level, badges, streak

#### XP & Level Calculation
- [ ] Implement level thresholds:
  ```
  Level 1: 0 XP
  Level 2: 100 XP
  Level 3: 300 XP
  Level 4: 600 XP
  Level 5: 1000 XP
  ... (exponential curve)
  ```
- [ ] Calculate level from XP on the fly or store in DB
- [ ] Add level-up celebration trigger

#### Streak System
- [ ] Track `last_activity_date` per user
- [ ] Increment streak if activity within 24-48 hours
- [ ] Reset streak if gap > 48 hours (unless frozen)
- [ ] Award streak freeze: 1 free per week
- [ ] Apply streak multipliers to XP gains

#### Reputation System
- [ ] +5 rep when your rating matches final consensus
- [ ] -2 rep when your rating is outlier (>2 std dev from mean)
- [ ] Unlock privileges at thresholds:
  - 100 rep: Edit AI prompts
  - 500 rep: Flag misleading content
  - 1000 rep: Trusted Rater badge (shown on ratings)

#### UI Components to Build
- [ ] **XP Bar** - Progress bar showing XP to next level
- [ ] **Level Badge** - Display current level with icon
- [ ] **Streak Counter** - Fire icon with day count 🔥7
- [ ] **Streak Calendar** - Visual grid of active days (like GitHub)
- [ ] **Badge Showcase** - Grid of earned badges on profile
- [ ] **Badge Detail Modal** - Click badge to see how you earned it
- [ ] **Leaderboard Page** - Top 100 users, filterable by time period
- [ ] **User Profile Page** - Public profile with stats, badges, history
- [ ] **XP Toast** - "+10 XP!" notification on actions
- [ ] **Level Up Modal** - Celebration when leveling up
- [ ] **Daily Check-in Button** - Claim daily XP bonus

#### Integration Points
- [ ] Award XP after `process-content` API succeeds
- [ ] Award XP after `content_ratings` insert
- [ ] Check streak on every authenticated page load
- [ ] Show XP/level in header or profile dropdown
- [ ] Add badges to community feed (show rater's level/badges)

#### Anti-Gaming Measures
- [ ] Rate limit content additions (max 20/day for XP)
- [ ] Require minimum content quality for XP (e.g., successful scrape)
- [ ] Detect and penalize self-rating loops
- [ ] Require verified email for leaderboard eligibility
- [ ] Manual review for top 10 leaderboard positions

---

## 4. Social & Community Features

### Content Sharing
- Share verified content with "Vajra Verified" badge
- Generate shareable summary cards
- Export to Twitter/X with fact-check overlay

### Community Ratings (like [eLearning Tags](https://raccoongang.com/blog/top-7-content-curation-tools-education/))
- Aggregate signal scores from all users
- Show rating distribution (not just average)
- "Community consensus" label when >80% agree
- Highlight controversial content (split ratings)

### Tribes/Groups (inspired by [Triberr](https://nealschaffer.com/content-curation-tools/))
- Create topic-focused groups
- Shared libraries within groups
- Group leaderboards
- Collaborative fact-checking

### Follow System
- Follow other truth-checkers
- See friends' recent verifications
- "Trusted by people you follow" indicator

---

## 5. UX/UI Polish

### Onboarding
- Interactive tutorial (3-4 screens max)
- Sample content to practice with
- Explain scoring system clearly

### Content Cards
- Credibility meter (visual gauge)
- Source diversity indicator
- "Verified by X users" badge
- Quick actions (rate, share, save)

### Navigation
- Swipe gestures for rating
- Pull-to-refresh
- Infinite scroll with skeleton loaders
- Bottom sheet for details (not new page)

### Dark Mode (already has)
- Ensure WCAG contrast compliance
- Reduce eye strain with proper blacks (#121212 ✓)

---

## 6. Performance Optimizations

### Speed
- Lazy load content cards
- Prefetch next page
- Cache summaries locally
- Use React Server Components where possible

### Offline Support
- Service worker for PWA
- Cache recent library items
- Queue ratings for sync when online

### Database
- Add indexes on `content.user_id`, `content.date_added`
- Paginate queries (not fetching all)
- Consider read replicas for scale

---

## 7. Monetization Enhancements

### Free Tier Limits
- 10 content items/month
- Basic summaries only
- Ads between content

### Pro Tier ($9.99/mo)
- Unlimited content
- Advanced summaries (mind maps, timestamps)
- No ads
- Priority AI processing
- Export features

### Team/Enterprise
- Shared workspaces
- Admin dashboard
- API access
- Custom integrations

---

## 8. New Feature Ideas

### Browser Extension
- One-click verify from any page
- Highlight claims on page
- Show Vajra score overlay

### Mobile App (React Native)
- Push notifications for trending misinformation
- Share sheet integration
- Widget for quick add

### API for Developers
- Verify content programmatically
- Embed Vajra scores on websites
- Webhook for new verifications

### Email Digest
- Weekly summary of checked content
- Trending misinformation alerts
- Personal stats recap

---

## 9. Priority Implementation Order

### Phase 1 (Quick Wins)
1. Timestamped summaries for YouTube
2. Streak system with visual counter
3. Basic badges (5-10 achievements)
4. Share cards with summary

### Phase 2 (Core Value)
5. Claim extraction from content
6. Source credibility database
7. Community consensus indicator
8. Browser extension MVP

### Phase 3 (Growth)
9. Follow system
10. Groups/Tribes
11. Mobile app
12. API launch

---

## 10. Current AI Infrastructure (What Exists)

### Models Available in UI
```typescript
// components/edit-ai-prompts-modal.tsx
const modelOptions = [
  "openai/gpt-5-chat",
  "anthropic/claude-sonnet-4",
  "x-ai/grok-4",
  "google/gemini-2.5-pro"
]
```

### Current Config (in DB)
| Feature | Model | Temp | Max Tokens |
|---------|-------|------|------------|
| Chat | `openai/gpt-5-chat` | 0.70 | 2048 |
| Summarizer | `anthropic/claude-sonnet-4` | 0.50 | 4096 |

### Existing System Prompts
- **Summarizer**: Generic JSON output (title + mid_length_summary)
- **Chat**: "Answer questions about content, use knowledge beyond text"

### UI for Editing (Already Built)
- [x] Model selector dropdown
- [x] System prompt textarea
- [x] User template (summarizer only)
- [x] Temperature, Top P, Max Tokens inputs
- [x] Saves to DB, takes effect immediately

---

## 11. AI Truth-Checking Enhancements TODO

### New Prompts Needed
- [ ] **Claim Extraction Prompt** - "Extract all factual claims as JSON array"
- [ ] **Bias Detection Prompt** - "Analyze emotional language, loaded terms, logical fallacies"
- [ ] **Source Analysis Prompt** - "List sources cited, rate credibility, check for circular sourcing"
- [ ] **Contradiction Detector** - "Compare claims against known facts"

### New DB Tables Needed
- [ ] `claim_extractions` - store extracted claims per content
- [ ] `source_credibility` - database of source trust scores
- [ ] `fact_check_results` - external fact-check API results

### AI Pipeline Enhancements
- [ ] Multi-step processing: Extract → Verify → Score
- [ ] Model routing by task (cheap for extraction, expensive for analysis)
- [ ] Caching fact-check results to reduce API calls
- [ ] Confidence scoring per claim

### OpenRouter Optimization
- [ ] Use Llama 3.1 70B for simple extraction (cheap)
- [ ] Use Claude for nuanced analysis (accurate)
- [ ] Implement fallback routing if model fails
- [ ] Track token usage per user for billing

---

## 12. Market Validation Summary

### The Problem (Stats)
- 62% of online content is false
- 86% of people exposed to misinformation
- $78B/year global economic cost
- 72% say fake news is "major threat"
- 58% worry about real vs fake online

### Competitor Landscape
| Tool | What It Does | Gap Vajra Fills |
|------|--------------|-----------------|
| NewsGuard | Rates news sites | Doesn't verify individual content |
| Google Fact Check | Searches existing fact-checks | Passive, not proactive |
| Snopes | Manual fact-checks | Slow, limited coverage |
| Ground News | Shows political bias | Doesn't verify truth |

### Vajra's Differentiation
- Personal truth-checking on ANY content (YouTube, articles, tweets)
- AI-powered claim extraction + summarization
- Gamification makes verification engaging
- Community consensus on ratings

### Revenue Potential
- NewsGuard: Profitable since 2022, $5/mo premium
- Mobile app market: $150B consumer spending (2025)
- Users willing to pay for trust/verification tools

---

## 13. Technical Debt & Quick Fixes TODO

### Code Quality
- [ ] Add TypeScript strict mode
- [ ] Add error boundaries to all pages
- [ ] Implement proper loading states
- [ ] Add retry logic for failed API calls (partially done)

### Security
- [ ] Rate limiting on API routes
- [ ] Input sanitization on all forms
- [ ] RLS policies review on Supabase tables
- [ ] API key rotation strategy

### Testing
- [ ] Add unit tests for utility functions
- [ ] Add integration tests for API routes
- [ ] Add E2E tests for critical flows (add content, rate, chat)

### DevOps
- [ ] Set up staging environment
- [ ] Add error monitoring (Sentry)
- [ ] Add analytics (Posthog/Mixpanel)
- [ ] CI/CD pipeline for automated deploys

---

## 14. UI Polish & Output Quality Enhancements TODO

### Summary Presentation
- [ ] **Timestamped Summaries** - Clickable timestamps that jump to video position
- [ ] **TL;DR Card** - One-sentence summary at top with accent border
- [ ] **Collapsible Sections** - Expand/collapse for detailed vs brief view
- [ ] **Reading Time Estimate** - "3 min read" badge on summaries
- [ ] **Key Takeaways Pills** - Highlighted bullet chips at top

### Claim Verification Display
- [ ] **Claim Cards** - Each claim in its own card with:
  - Claim text
  - Verdict badge (Verified ✓ / Disputed ✗ / Unverified ?)
  - Confidence percentage bar
  - Evidence links expandable
- [ ] **Claim Timeline** - Visual timeline of claims in order of appearance
- [ ] **Fact-Check Overlay** - Inline annotations on original text

### Credibility Indicators
- [ ] **Credibility Meter** - Radial gauge (0-100) with color gradient
  - 0-30: Red (Low credibility)
  - 31-60: Yellow (Mixed)
  - 61-100: Green (High credibility)
- [ ] **Source Trust Pills** - Clickable chips showing source ratings
- [ ] **Bias Indicator** - Left/Right spectrum bar with dot position
- [ ] **"Vajra Verified" Badge** - Trust seal for high-confidence content

### Visual Hierarchy
- [ ] **Card Shadows** - Subtle elevation for content cards
- [ ] **Color-Coded Borders** - Left border color based on credibility
- [ ] **Icon System** - Consistent iconography (Lucide icons)
- [ ] **Typography Scale** - Clear heading hierarchy (24/20/16/14px)
- [ ] **Whitespace Balance** - Generous padding, 16px/24px grid

### Interactive Elements
- [ ] **Copy Button** - One-click copy summary to clipboard
- [ ] **Export Options** - PDF, Markdown, plain text download
- [ ] **Share Card Generator** - Beautiful social media cards with:
  - Content title
  - Key verdict
  - Credibility score
  - Vajra branding
- [ ] **Quick Actions Bar** - Floating actions (rate, share, chat, save)

### Data Visualization
- [ ] **Mind Map View** - Visual content structure (react-flow or d3)
- [ ] **Rating Distribution Chart** - Bar chart of community ratings
- [ ] **Source Network Graph** - Show how sources interconnect
- [ ] **Claim Breakdown Pie** - Visual split of verified/disputed/unknown

### Animations & Micro-interactions
- [ ] **Skeleton Loaders** - Pulse animation while loading
- [ ] **Fade-in Content** - Smooth content appearance
- [ ] **Button Hover States** - Scale + shadow on hover
- [ ] **Progress Indicators** - Linear progress for AI processing
- [ ] **Confetti on Milestones** - Celebration for achievements

### Accessibility & Polish
- [ ] **WCAG AA Compliance** - Contrast ratios, focus states
- [ ] **Keyboard Navigation** - Tab through all interactive elements
- [ ] **Screen Reader Labels** - Proper ARIA attributes
- [ ] **Responsive Breakpoints** - Mobile-first design (sm/md/lg/xl)
- [ ] **Error States** - Friendly error messages with retry buttons

### Output Quality Improvements
- [ ] **Markdown Formatting** - Headers, lists, bold, links rendered properly
- [ ] **Code Block Styling** - Syntax highlighting for any code snippets
- [ ] **Quote Styling** - Indented with accent bar for citations
- [ ] **Table Support** - Clean table rendering for structured data
- [ ] **Link Previews** - Show favicon + domain for external links

### Premium Feel Components
- [ ] **Glass Morphism Cards** - Frosted glass effect on overlays
- [ ] **Gradient Accents** - Subtle gradients on CTAs and headers
- [ ] **Smooth Transitions** - 200-300ms ease-out on all state changes
- [ ] **Empty States** - Illustrated placeholders when no content
- [ ] **Success Toasts** - Subtle notifications for completed actions

---

## Sources
- [Sider AI - Best Fact-Checking Tools 2025](https://sider.ai/blog/ai-tools/best-ai-fact-checking-tools-to-trust-in-2025)
- [Originality.AI - Automated Fact Checker](https://originality.ai/automated-fact-checker)
- [Trophy - XP Systems](https://trophy.so/blog/when-your-app-needs-xp-system)
- [Plotline - Streaks & Milestones](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps)
- [NoteGPT - YouTube Summarizer](https://notegpt.io/youtube-video-summarizer)
- [Eightify - Video Summarizer](https://eightify.app/)
- [Neal Schaffer - Content Curation Guide](https://nealschaffer.com/content-curation-tools/)
