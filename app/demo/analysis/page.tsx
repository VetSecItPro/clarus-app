"use client"

import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  Play,
  Eye,
  Sparkles,
  Lightbulb,
  Shield,
  Target,
  BookOpen,
  ChevronDown,
  Tag,
  BookmarkCheck,
  Mail,
  Download,
  RefreshCw,
} from "lucide-react"
import { SectionCard } from "@/components/ui/section-card"
import { TriageCard } from "@/components/ui/triage-card"
import { TruthCheckCard } from "@/components/ui/truth-check-card"
import { ActionItemsCard } from "@/components/ui/action-items-card"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import type { TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"

// =============================================
// MOCK DATA — YouTube analysis demo
// =============================================

const MOCK_TITLE = "How AI Is Reshaping Investigative Journalism — And Why It Matters"
const MOCK_DOMAIN = "youtube.com"
const MOCK_AUTHOR = "The Signal"
const MOCK_DURATION = "28:14"
const MOCK_THUMBNAIL = "https://img.youtube.com/vi/aircAruvnKk/maxresdefault.jpg"

const MOCK_OVERVIEW =
  "This video by The Signal explores how newsrooms are integrating AI tools into investigative workflows — from document analysis to pattern recognition across large datasets. Host Marcus Chen interviews ProPublica's data team lead, Sarah Kessler, and Columbia Journalism School professor James Hamilton about the promise and risks of AI-assisted reporting. The conversation covers real-world examples including the Panama Papers follow-up investigations, local news resource constraints, and the ethical concerns around algorithmic bias in source evaluation. Chen argues that AI won't replace journalists but will fundamentally change what a single reporter can accomplish."

const MOCK_TRIAGE: TriageData = {
  quality_score: 8.2,
  worth_your_time: "Yes — A well-sourced exploration of AI in journalism with expert interviews and concrete examples. Goes beyond surface-level hype to address real workflow changes and ethical concerns.",
  target_audience: ["Journalists", "Media professionals", "AI practitioners", "News consumers"],
  content_density: "High — Dense with specific examples, named tools, and expert analysis. Minimal filler or repetition.",
  estimated_value: "Strong understanding of how AI is actually being used in newsrooms today, with balanced coverage of benefits and risks.",
  signal_noise_score: 2,
  content_category: "documentary",
}

const MOCK_KEY_TAKEAWAYS = `## Key Points

### AI as a Force Multiplier for Reporters
- **Sarah Kessler** explains that ProPublica's data team used AI document classifiers to process 11.5 million files in the Pandora Papers investigation — work that would have taken 50 reporters several years manually.
- Local newsrooms with 3-5 reporters can now tackle investigations previously only possible at outlets like the NYT or Washington Post.
- The key shift: AI handles volume, humans handle judgment.

### Real Tools Being Used Today
- **Document classification** (NLP models sorting leaked files by relevance)
- **Entity extraction** (identifying people, companies, and relationships across thousands of documents)
- **Pattern recognition** (flagging unusual financial transactions or regulatory filings)
- **Transcript analysis** (processing hours of public meeting recordings to find newsworthy statements)

### The Ethics Conversation
- **James Hamilton** warns that AI tools can embed bias in source evaluation — models trained on mainstream media may systematically undervalue sources from marginalized communities.
- Hamilton proposes a "transparency standard" where newsrooms disclose AI tool usage in published stories.
- Both guests agree that the biggest risk isn't AI making errors — it's journalists over-trusting AI outputs and skipping verification steps.

### The Local News Angle
- Resource-constrained local newsrooms stand to benefit most from AI tools.
- Chen highlights three local papers that broke major stories using AI-assisted document analysis.
- The cost barrier is dropping: open-source NLP tools are increasingly competitive with commercial offerings.

## Bottom Line
A substantive, well-balanced look at AI in journalism that avoids both uncritical hype and dismissive skepticism. The expert interviews add credibility, and the concrete examples ground the discussion in reality rather than speculation.`

const MOCK_TRUTH_CHECK: TruthCheckData = {
  overall_rating: "Mostly Accurate",
  issues: [
    {
      type: "missing_context",
      claim_or_issue: "Sarah Kessler states that ProPublica processed 11.5 million files using AI classifiers in the Pandora Papers investigation.",
      assessment: "The 11.5 million figure is correct for ICIJ's overall Pandora Papers dataset, but ProPublica was one of many partner organizations. The claim slightly overstates ProPublica's individual role, though they did use AI classification tools extensively.",
      severity: "low",
      timestamp: "4:32",
    },
    {
      type: "unjustified_certainty",
      claim_or_issue: "Marcus Chen claims that open-source NLP tools are 'now competitive with' commercial AI offerings for newsroom use.",
      assessment: "This is partially true for specific tasks like entity extraction and classification, but commercial tools from companies like Palantir and Relativity still significantly outperform open-source alternatives for complex document review. The claim overgeneralizes.",
      severity: "medium",
      timestamp: "18:47",
    },
    {
      type: "bias",
      claim_or_issue: "The video presents AI adoption in newsrooms as largely positive, with risks framed as manageable.",
      assessment: "While the video does address ethical concerns, it gives significantly more airtime to success stories than to failures or ongoing problems. Job displacement concerns are mentioned only briefly at 24:10.",
      severity: "low",
    },
  ],
  strengths: [
    "Expert sources are clearly identified with their credentials and institutional affiliations",
    "Specific, verifiable examples are used rather than vague claims (Pandora Papers, named local newsrooms)",
    "Both opportunities and risks are addressed, even if the balance slightly favors optimism",
    "Technical concepts are explained accurately without oversimplification",
    "Hamilton's ethical framework adds academic rigor to the discussion",
  ],
  sources_quality: "Strong. Two named expert sources with relevant credentials (ProPublica data team lead, Columbia J-School professor). Specific investigations and tools are named. Primary source material is referenced. One claim about open-source tools lacks a specific citation.",
}

const MOCK_ACTION_ITEMS: ActionItemsData = [
  {
    title: "Explore open-source NLP tools for document analysis",
    description: "Tools like spaCy, Hugging Face transformers, and Apache Tika were mentioned as newsroom-accessible options for entity extraction and document classification.",
    priority: "high",
    category: "Research",
  },
  {
    title: "Read the ICIJ methodology paper on the Pandora Papers",
    description: "The ICIJ published a detailed methodology paper explaining how AI tools were used in the Pandora Papers investigation. Worth reading for concrete implementation details.",
    priority: "high",
    category: "Reading",
  },
  {
    title: "Review Hamilton's proposed transparency standard",
    description: "James Hamilton's framework for disclosing AI tool usage in published journalism could be relevant for any newsroom beginning to adopt these tools.",
    priority: "medium",
    category: "Policy",
  },
  {
    title: "Consider AI-assisted transcript analysis for public meetings",
    description: "The video highlights this as one of the lowest-barrier AI applications for local newsrooms — processing city council and school board meeting transcripts to surface newsworthy statements.",
    priority: "medium",
    category: "Workflow",
  },
  {
    title: "Watch for AI bias in source evaluation",
    description: "Hamilton's warning about models systematically undervaluing non-mainstream sources is worth keeping in mind when using AI tools that rank or prioritize information.",
    priority: "low",
    category: "Ethics",
  },
]

const MOCK_DETAILED = `## Detailed Analysis

### Production Quality
The video is well-produced with clean graphics, relevant B-roll footage of newsrooms and data visualizations, and professional-quality remote interviews. Chen's hosting style is conversational but focused — he steers the conversation efficiently and asks follow-up questions that deepen the discussion rather than redirecting it. The 28-minute runtime is appropriate for the depth of content; there's very little padding.

### Argument Structure
The video follows a clear three-part structure:

1. **The case for AI in journalism** (0:00–10:30) — Chen establishes the scale of modern investigative data and introduces Kessler's ProPublica examples.
2. **Real-world applications** (10:30–20:00) — Specific tools and workflows are discussed, with Kessler providing practitioner insight and Hamilton providing academic context.
3. **Ethics and risks** (20:00–28:14) — The conversation shifts to concerns about bias, over-reliance, job displacement, and the need for transparency standards.

This structure works well because it builds from concrete examples to broader implications, keeping the viewer grounded in reality before addressing more abstract concerns.

### Expert Credibility
**Sarah Kessler** brings direct practitioner experience. Her examples are specific and verifiable — she names tools, datasets, and investigation timelines. She's careful to distinguish between what AI does well (volume processing) and what still requires human judgment (editorial decisions, source evaluation).

**James Hamilton** provides the academic counterweight. His concerns about algorithmic bias in source evaluation are grounded in published research on NLP training data biases. His proposed transparency standard is practical rather than theoretical.

### What's Missing
- **Job displacement data**: The video briefly acknowledges concerns about AI replacing journalism jobs but doesn't cite any studies or projections on this topic.
- **Failed implementations**: All examples are success stories. A more balanced treatment would include cases where AI tools produced misleading results or were abandoned by newsrooms.
- **Cost analysis**: While the video mentions that costs are dropping, no specific figures are provided for implementing AI tools in a newsroom.
- **International perspective**: All examples are from U.S. newsrooms. AI adoption in journalism varies significantly by country and press freedom context.

### Recommendation
Worth watching for anyone interested in the intersection of AI and media. The expert interviews and specific examples make this more valuable than most coverage of this topic. View the claims about open-source tool competitiveness with appropriate skepticism, and supplement with reporting on AI failures in journalism for a more complete picture.`

export default function DemoAnalysisPage() {
  return (
    <>
      {/* Secondary nav bar */}
      <div className="sticky top-14 z-20 bg-black/90 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/demo/library">
              <button className="h-10 w-10 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08] flex items-center justify-center transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>

            <div className="flex items-center gap-1 bg-white/[0.06] p-1 rounded-full border border-white/[0.08]">
              <button className="px-5 py-2 text-sm font-medium rounded-full bg-[#1d9bf0] text-white shadow-md shadow-blue-500/25">
                Summary
              </button>
              <button className="px-5 py-2 text-sm font-medium rounded-full text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all">
                Full Text
              </button>
            </div>

            <button className="h-9 px-3 flex items-center gap-1.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto lg:px-6 py-8 flex-1">
        <div className="lg:flex lg:gap-8 min-w-0 lg:h-[calc(100vh-100px)]">
          {/* LEFT PANEL */}
          <aside className="w-full lg:w-[480px] lg:flex-shrink-0 lg:overflow-y-auto subtle-scrollbar">
            {/* Video thumbnail */}
            <div className="mb-3">
              <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-black w-full relative">
                <Image
                  src={MOCK_THUMBNAIL}
                  alt={MOCK_TITLE}
                  width={480}
                  height={270}
                  className="w-full h-auto aspect-video object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center border border-white/20">
                    <Play className="w-7 h-7 text-white ml-1" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Content info card */}
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <h1 className="text-base font-semibold text-white leading-tight mb-2">
                  {MOCK_TITLE}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{MOCK_DOMAIN}</span>
                  <span className="px-2 py-1 rounded-lg bg-white/[0.06]">{MOCK_AUTHOR}</span>
                  <span className="px-2 py-1 rounded-lg bg-white/[0.06] flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    {MOCK_DURATION}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/[0.06]">Analyzed 2 hours ago</span>
                </div>
              </div>

              {/* Tags */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">Tags</h3>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["ai", "journalism", "media", "investigations", "ethics"].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300 capitalize"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Source History */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Source History</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">
                    <span className="text-white font-medium">youtube.com</span> has been analyzed{" "}
                    <span className="text-white font-medium">47</span> times
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 shrink-0">Avg Quality:</span>
                    <div className="flex-1 h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                        style={{ width: "72%" }}
                      />
                    </div>
                    <span className="text-xs font-medium text-white shrink-0">7.2/10</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                      18 Accurate
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      21 Mostly Accurate
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      6 Mixed
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      2 Questionable
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button className="flex items-center justify-center gap-2 py-2 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-md transition-all">
                  <BookmarkCheck className="w-4 h-4" />
                  Saved
                </button>
                <button className="flex items-center justify-center gap-2 py-2 text-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-md transition-all">
                  <Mail className="w-4 h-4" />
                  Share
                </button>
                <button className="flex items-center justify-center gap-2 py-2 text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-md transition-all">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              {/* Mock chat */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                <div className="p-3 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-white">Chat with this content</h3>
                </div>
                <div className="p-3 space-y-3">
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1d9bf0] to-purple-500 shrink-0 flex items-center justify-center text-[10px] text-white font-semibold">J</div>
                    <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-white/80 max-w-[85%]">
                      What specific AI tools did ProPublica use?
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#1d9bf0]/20 shrink-0 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-[#1d9bf0]" />
                    </div>
                    <div className="bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-white/70 max-w-[85%]">
                      According to Sarah Kessler in the video, ProPublica used NLP-based document classifiers to categorize files from the Pandora Papers leak. She specifically mentioned entity extraction tools for identifying people and companies across the 11.5M document dataset...
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white/30">
                    Ask about this content...
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT PANEL — Analysis Cards */}
          <div className="flex-1 min-w-0 lg:overflow-y-auto lg:pr-2 px-4 lg:px-0 subtle-scrollbar">
            <div className="space-y-8">
              {/* 1. Overview */}
              <SectionCard
                title="Overview"
                icon={<Eye className="w-4 h-4" />}
                headerColor="blue"
              >
                <p className="text-white/90 text-base leading-relaxed">
                  {MOCK_OVERVIEW}
                </p>
              </SectionCard>

              {/* 2. Quick Assessment */}
              <SectionCard
                title="Quick Assessment"
                icon={<Sparkles className="w-4 h-4" />}
                headerColor="amber"
              >
                <TriageCard triage={MOCK_TRIAGE} />
              </SectionCard>

              {/* 3. Key Takeaways */}
              <SectionCard
                title="Key Takeaways"
                icon={<Lightbulb className="w-4 h-4" />}
                headerColor="cyan"
              >
                <div className="prose prose-sm prose-invert max-w-none">
                  <MarkdownRenderer>{MOCK_KEY_TAKEAWAYS}</MarkdownRenderer>
                </div>
              </SectionCard>

              {/* 4. Accuracy Analysis */}
              <SectionCard
                title="Accuracy Analysis"
                icon={<Shield className="w-4 h-4" />}
                headerColor="emerald"
              >
                <TruthCheckCard truthCheck={MOCK_TRUTH_CHECK} />
              </SectionCard>

              {/* 5. Action Items */}
              <SectionCard
                title="Action Items"
                icon={<Target className="w-4 h-4" />}
                headerColor="orange"
              >
                <ActionItemsCard actionItems={MOCK_ACTION_ITEMS} />
              </SectionCard>

              {/* 6. Detailed Analysis */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                <div className="w-full px-5 py-4 flex items-center justify-between bg-violet-500/15 border-b border-violet-500/20">
                  <h3 className="text-sm font-semibold text-violet-300 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Detailed Analysis
                  </h3>
                  <ChevronDown className="w-5 h-5 text-white/50 rotate-180" />
                </div>
                <div className="px-5 py-5 border-t border-white/[0.06] prose prose-sm prose-invert max-w-none">
                  <MarkdownRenderer>{MOCK_DETAILED}</MarkdownRenderer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
