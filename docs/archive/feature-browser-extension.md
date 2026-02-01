# Feature: Browser Extension

## Overview
Chrome/Firefox extension that lets users analyze any content (YouTube, X, Instagram, articles) directly from the page without visiting the main app.

## Supported Platforms

| Platform | Content Type | Detection |
|----------|--------------|-----------|
| YouTube | Videos | `/watch?v=` URL pattern |
| X/Twitter | Posts/Tweets | `/status/` URL pattern |
| Instagram | Posts/Reels | `/p/` or `/reel/` pattern |
| TikTok | Videos | `/video/` pattern |
| Any website | Articles | Generic article detection |

---

## Architecture

```
extension/
├── manifest.json           # Extension config (Manifest V3)
├── popup/
│   ├── index.html         # Popup UI
│   ├── popup.css          # Styles
│   └── popup.js           # Logic
├── content-scripts/
│   ├── detector.js        # Detect content type
│   ├── injector.js        # Inject UI elements
│   └── styles.css         # Injected styles
├── background/
│   └── service-worker.js  # Background tasks
├── utils/
│   ├── api.js             # API calls
│   └── storage.js         # Chrome storage helpers
└── icons/
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

---

## User Flows

### Flow 1: Popup Analysis (Any Page)
```
1. User clicks extension icon
2. Popup shows current page URL
3. User clicks "Analyze"
4. Loading state while API processes
5. Results show in popup:
   - Truth Rating badge
   - Quick summary
   - "View Full Report" link to main app
```

### Flow 2: Injected Button (Platform-Specific)
```
YouTube:
1. Extension detects YouTube video page
2. Injects "Truth Check" button near video actions
3. User clicks button
4. Slide-in panel shows results
5. Can expand to full report

X/Twitter:
1. Extension detects tweet page
2. Adds small shield icon to tweet actions
3. Click shows quick fact-check popup
4. Link to full analysis
```

### Flow 3: Context Menu
```
1. User right-clicks on any page
2. Context menu shows "Analyze with Truth Checker"
3. Opens popup or new tab with analysis
```

---

## Implementation

### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Truth Checker",
  "version": "1.0.0",
  "description": "AI-powered fact-checking for YouTube, X, and articles",

  "permissions": [
    "activeTab",
    "storage",
    "contextMenus"
  ],

  "host_permissions": [
    "https://infosecops.io/*"
  ],

  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "background": {
    "service_worker": "background/service-worker.js"
  },

  "content_scripts": [
    {
      "matches": [
        "*://*.youtube.com/*",
        "*://*.twitter.com/*",
        "*://*.x.com/*"
      ],
      "js": ["content-scripts/detector.js", "content-scripts/injector.js"],
      "css": ["content-scripts/styles.css"],
      "run_at": "document_idle"
    }
  ],

  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

### API Endpoint for Extension
**File:** `app/api/extension/analyze/route.ts`

```typescript
export async function POST(req: Request) {
  const { url } = await req.json()

  // Check if URL already analyzed
  const { data: existing } = await supabase
    .from('content')
    .select('id, title, summaries(brief_overview, truth_check, triage)')
    .eq('url', url)
    .single()

  if (existing?.summaries?.length > 0) {
    const summary = existing.summaries[0]
    return Response.json({
      cached: true,
      contentId: existing.id,
      title: existing.title,
      rating: summary.truth_check?.overall_rating || 'Unknown',
      qualityScore: summary.triage?.quality_score,
      overview: summary.brief_overview,
      appUrl: `https://infosecops.io/item/${existing.id}`
    })
  }

  // Not cached - trigger analysis
  // Option 1: Start async and return immediately
  // Option 2: Wait for quick analysis

  // For v1, just return "not analyzed" and link to main app
  return Response.json({
    cached: false,
    analyzed: false,
    analyzeUrl: `https://infosecops.io/?url=${encodeURIComponent(url)}`
  })
}
```

### Quick Analysis Endpoint (Optional v2)
For instant results without full processing:
```typescript
// app/api/extension/quick-check/route.ts
// Does lightweight analysis:
// - Domain reputation lookup
// - Known claims database check
// - Basic content type detection
// Returns in <2 seconds
```

---

## Phased Rollout

### Phase 1: Minimal Viable Extension (MVP)
- Popup with "Analyze" button
- Shows results for cached content
- Links to main app for full analysis
- **Time: 3-4 days**

### Phase 2: Platform Integration
- Inject buttons on YouTube
- Inject on X/Twitter
- Context menu support
- **Time: 3-4 days**

### Phase 3: Enhanced Features
- Inline results (no popup needed)
- Quick analysis without full processing
- User accounts / sync
- **Time: 4-5 days**

---

## Chrome Web Store Submission

### Requirements
1. **Privacy Policy** - Required, explain data handling
2. **Screenshots** - 1280x800 or 640x400
3. **Promotional images** - 440x280 (small), 920x680 (large)
4. **Description** - Clear, no keyword stuffing
5. **Category** - Productivity or News

### Common Rejection Reasons
- Too many permissions requested
- Misleading description
- Poor user experience
- No clear privacy policy

### Submission Checklist
- [ ] Create Chrome Developer account ($5 one-time fee)
- [ ] Write privacy policy
- [ ] Create screenshots
- [ ] Test thoroughly
- [ ] Submit for review (1-3 days)

---

## Files in Main App to Add

```
app/api/extension/
├── analyze/route.ts       # Main analysis endpoint
├── quick-check/route.ts   # Quick cached lookup
└── auth/route.ts          # Optional: user auth for extension
```

---

## Effort Estimate

| Phase | Tasks | Time |
|-------|-------|------|
| **MVP** | Popup, API, basic flow | 3-4 days |
| **Platform** | YouTube/X injection | 3-4 days |
| **Polish** | Icons, store listing | 1 day |
| **Submission** | Review process | 1-3 days |
| **Total** | | **~10 days** |

---

## Development Setup

```bash
# In extension/ folder
# No build step needed for basic extension

# Load in Chrome:
1. Go to chrome://extensions
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select extension/ folder

# Test:
1. Navigate to YouTube video
2. Click extension icon
3. Verify popup works
```

---

## Rollback / Disable

If issues arise:
1. Extension is separate from main app
2. Can unpublish from Chrome Web Store
3. API endpoints can be disabled independently
4. No database changes required
