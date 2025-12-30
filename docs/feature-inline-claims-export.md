# Feature: Inline Claim Highlighting + Export

## Overview
Add inline claim highlighting to the Full Text tab (transcripts/articles) and export functionality (PDF, Markdown).

## Architecture

### Current Flow
```
Summary Tab:
├── Overview
├── Quick Assessment
├── Truth Check (separate section) ← stays as-is
├── Key Takeaways
├── Action Items
└── Detailed Analysis

Full Text Tab:
└── Raw transcript/article text ← ADD highlighting here
```

### New Flow
```
Summary Tab:
└── (unchanged)

Full Text Tab:
└── Transcript/Article with inline claim highlights
    ├── 🟢 Verified claims (green highlight)
    ├── 🔴 False/disputed claims (red highlight)
    ├── 🟡 Unverified claims (yellow highlight)
    └── Click any highlight → tooltip with explanation + sources
```

---

## Implementation Steps

### 1. Update AI Prompt for Claim Extraction

**File:** `app/api/process-content/route.ts` (or database prompt)

Add to truth_check prompt:
```
For each issue you identify, also provide:
- "exact_text": The exact phrase/sentence from the content (for highlighting)
- "start_offset": Approximate character position (if determinable)
- "timestamp": For videos, the [M:SS] timestamp where this appears

Return claims that can be mapped back to the original text.
```

**New JSON structure:**
```json
{
  "overall_rating": "Mixed",
  "claims": [
    {
      "exact_text": "vaccines cause autism",
      "status": "false",
      "explanation": "Extensive research has debunked this claim...",
      "sources": ["cdc.gov", "who.int"],
      "timestamp": "3:45",
      "severity": "high"
    }
  ],
  "issues": [...],  // Keep existing for backward compat
  "strengths": [...]
}
```

### 2. Database Schema Update

```sql
-- Already have truth_check JSONB column in summaries table
-- No schema change needed, just different JSON structure
```

### 3. Create Highlighting Component

**File:** `components/highlighted-text.tsx`

```tsx
interface Claim {
  exact_text: string
  status: 'true' | 'false' | 'disputed' | 'unverified'
  explanation: string
  sources?: string[]
  timestamp?: string
  severity?: 'low' | 'medium' | 'high'
}

interface HighlightedTextProps {
  text: string
  claims: Claim[]
  onClaimClick?: (claim: Claim) => void
}
```

**Features:**
- Fuzzy text matching (handle slight variations)
- Hover tooltips with explanation
- Click to expand full details
- Color-coded by status
- Jump to timestamp (for videos)

### 4. Integrate into Item Page

**File:** `app/item/[id]/page.tsx`

In the Full Text tab section:
```tsx
{activeTab === "full" && (
  <div>
    {truthCheck?.claims?.length > 0 ? (
      <HighlightedText
        text={item.full_text}
        claims={truthCheck.claims}
        onTimestampClick={handleSeekTo}
      />
    ) : (
      // Fallback to regular transcript display
      <TranscriptDisplay text={item.full_text} />
    )}
  </div>
)}
```

### 5. Export Functionality

#### PDF Export
**File:** `app/api/export/pdf/route.ts`

Uses `jspdf` or `@react-pdf/renderer`:
- Title + metadata
- Truth rating badge
- Key takeaways
- Claims summary
- Formatted nicely

#### Markdown Export
**File:** `app/api/export/markdown/route.ts`

Generates clean markdown:
```markdown
# [Title]
**Source:** [URL]
**Truth Rating:** Mixed

## Key Takeaways
- Point 1
- Point 2

## Truth Check
### Issues Found
- ❌ "claim text" - Explanation

### Verified
- ✅ "claim text" - Explanation
```

#### Export UI
Add export dropdown to item page header:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <Download className="w-4 h-4" />
    Export
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={exportPDF}>
      PDF Report
    </DropdownMenuItem>
    <DropdownMenuItem onClick={exportMarkdown}>
      Markdown
    </DropdownMenuItem>
    <DropdownMenuItem onClick={copyLink}>
      Copy Link
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Files to Create/Modify

### New Files
- `components/highlighted-text.tsx` - Main highlighting component
- `components/claim-tooltip.tsx` - Tooltip for claim details
- `app/api/export/pdf/route.ts` - PDF export endpoint
- `app/api/export/markdown/route.ts` - Markdown export endpoint

### Modified Files
- `app/item/[id]/page.tsx` - Integrate highlighting + export buttons
- Database: Update `analysis_prompts` for truth_check to include exact_text

---

## Dependencies to Add

```bash
pnpm add jspdf  # For PDF generation
# OR
pnpm add @react-pdf/renderer  # Alternative PDF lib
```

---

## Effort Estimate

| Task | Time |
|------|------|
| Update AI prompt | 0.5 day |
| Highlighting component | 1.5 days |
| Integration + testing | 1 day |
| PDF export | 0.5 day |
| Markdown export | 0.25 day |
| Export UI | 0.25 day |
| **Total** | **~4 days** |

---

## Rollback Plan

If issues arise:
1. The highlighting is opt-in (only shows if claims exist)
2. Falls back to regular transcript if no claims
3. Export is separate functionality, can disable independently
4. No database migrations needed (just JSON structure change)
