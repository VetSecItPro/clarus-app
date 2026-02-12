import type { TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"

// Demo analysis based on a well-known TED talk by Johann Hari
// "Everything you think you know about addiction is wrong"
// This is hardcoded data — no API calls needed

export const DEMO_CONTENT = {
  title: "Everything You Think You Know About Addiction Is Wrong",
  author: "Johann Hari",
  type: "youtube" as const,
  domain: "youtube.com",
  duration: "14:43",
  thumbnail: null,
  url: "https://www.youtube.com/watch?v=PY9DcIMGxMs",
  detectedTone: "persuasive",
} as const

export const DEMO_OVERVIEW = `Johann Hari challenges the conventional understanding of addiction, arguing that it is not primarily caused by chemical hooks in drugs but by disconnection and lack of meaningful bonds. Drawing on research from rat experiments ("Rat Park") and real-world examples like Portugal's decriminalization policy, Hari makes the case that the opposite of addiction is not sobriety, but human connection.

The talk is well-structured and emotionally engaging, using personal anecdotes alongside academic research. Hari references Professor Bruce Alexander's work and the Vietnam War heroin statistics to build his argument, though some claims warrant additional context.`

export const DEMO_TRIAGE: TriageData = {
  quality_score: 8,
  worth_your_time: "Yes, a compelling reframing of addiction that challenges widely held assumptions. Even if you disagree with some conclusions, the research cited is worth knowing about.",
  target_audience: ["Psychology enthusiasts", "Public health professionals", "Educators", "Policy makers", "Anyone affected by addiction"],
  content_density: "High. Packs multiple research studies, historical examples, and a policy case study into under 15 minutes. No filler.",
  estimated_value: "A new mental model for understanding addiction that may change how you think about drug policy, personal relationships, and social isolation.",
  signal_noise_score: 2,
  content_category: "educational",
}

export const DEMO_TRUTH_CHECK: TruthCheckData = {
  overall_rating: "Mostly Accurate",
  claims: [
    {
      exact_text: "almost everything we think we know about addiction is wrong",
      status: "opinion",
      explanation: "This is a rhetorical framing device. While Hari presents valid counterpoints to the chemical-hook model, mainstream addiction science recognizes both biological and social factors.",
      severity: "low",
      timestamp: "0:15",
    },
    {
      exact_text: "Rat Park experiment showed rats with social bonds largely avoided morphine water",
      status: "verified",
      explanation: "Bruce Alexander's Rat Park experiment (1978-1981) did show dramatically reduced morphine consumption in enriched environments. The study has been replicated with variations.",
      sources: ["https://doi.org/10.1016/0091-3057(81)90149-2"],
      severity: "low",
      timestamp: "4:22",
    },
    {
      exact_text: "95% of Vietnam veterans who used heroin stopped when they returned home",
      status: "verified",
      explanation: "The Robins study (1974, Archives of General Psychiatry) found that approximately 95% of heroin-addicted Vietnam veterans did not relapse after returning to the US. This is one of the most cited findings in addiction research.",
      sources: ["https://doi.org/10.1001/archpsyc.1974.01760150005001"],
      severity: "low",
      timestamp: "6:30",
    },
    {
      exact_text: "Portugal decriminalized all drugs and saw injection drug use fall by 50%",
      status: "disputed",
      explanation: "Portugal decriminalized personal possession (not all drug activity) in 2001. Drug use metrics did improve significantly, but the 50% figure specifically for injection drug use is contested. Different studies cite different figures depending on timeframe and methodology.",
      sources: ["https://doi.org/10.1111/j.1360-0443.2010.02956.x"],
      severity: "medium",
      timestamp: "10:15",
    },
    {
      exact_text: "the opposite of addiction is not sobriety, it is human connection",
      status: "opinion",
      explanation: "This is a powerful rhetorical conclusion, not a scientific claim. While social connection is a recognized protective factor against addiction, addiction treatment typically involves multiple dimensions including medical, psychological, and social interventions.",
      severity: "low",
      timestamp: "13:30",
    },
  ],
  issues: [
    {
      type: "missing_context",
      claim_or_issue: "Chemical hooks are dismissed too broadly",
      assessment: "While Hari correctly highlights the social dimension of addiction, he understates the role of neurochemistry. Modern addiction science recognizes both biological vulnerability and environmental factors. It is not either/or.",
      severity: "medium",
      timestamp: "2:10",
      sources: [
        { url: "https://www.nature.com/articles/nrn3469", title: "Nature Reviews Neuroscience: Drug addiction" },
      ],
    },
    {
      type: "misleading",
      claim_or_issue: "Portugal's 50% reduction in injection drug use",
      assessment: "The specific statistic is difficult to verify precisely. Portugal's policy did lead to significant improvements in multiple drug-related outcomes, but the exact figures vary by source and time period measured.",
      severity: "low",
      timestamp: "10:15",
      sources: [
        { url: "https://doi.org/10.1111/j.1360-0443.2010.02956.x", title: "Drug policy in Portugal (Addiction, 2010)" },
        { url: "https://www.emcdda.europa.eu/countries/drug-reports/2023/portugal_en", title: "EMCDDA Portugal Country Report" },
      ],
    },
    {
      type: "unjustified_certainty",
      claim_or_issue: "Rat Park presented as definitive proof",
      assessment: "While Rat Park is an important study, Hari presents it with more certainty than the scientific community affords it. The original study had methodological limitations and some replication attempts had mixed results.",
      severity: "low",
      timestamp: "4:22",
      sources: [
        { url: "https://doi.org/10.1016/0091-3057(81)90149-2", title: "Alexander et al. (1981): Rat Park Study" },
      ],
    },
  ],
  strengths: [
    "Uses named, verifiable research studies rather than vague appeals to authority",
    "The Vietnam veteran statistic is well-documented and directly challenges the chemical-hook model",
    "Acknowledges that his argument does not mean drugs are harmless",
    "Personal disclosure about family members with addiction adds authenticity",
    "Portugal case study provides a real-world policy example with measurable outcomes",
  ],
  sources_quality: "Good. Primary sources include peer-reviewed research (Bruce Alexander's Rat Park, Lee Robins' Vietnam study) and national policy data from Portugal. However, the talk is a popular summary; some nuance from the original studies is lost in translation.",
}

export const DEMO_ACTION_ITEMS: ActionItemsData = [
  {
    title: "Read the original Rat Park study by Bruce Alexander",
    description: "Access the 1981 paper 'The effect of housing and gender on morphine self-administration in rats' to understand the methodology and limitations Hari does not mention.",
    priority: "high",
    category: "Research",
  },
  {
    title: "Review Portugal's drug policy outcomes (2001-present)",
    description: "Look at the European Monitoring Centre for Drugs and Drug Addiction (EMCDDA) reports for verified statistics rather than relying on the simplified figures in the talk.",
    priority: "high",
    category: "Research",
  },
  {
    title: "Explore the biopsychosocial model of addiction",
    description: "Hari focuses on the social dimension. The biopsychosocial model integrates biological, psychological, and social factors for a more complete picture.",
    priority: "medium",
    category: "Learning",
  },
  {
    title: "Consider how isolation affects your own community",
    description: "Hari's core argument about disconnection applies beyond addiction. Reflect on how social bonds and community engagement function as protective factors in your environment.",
    priority: "medium",
    category: "Reflection",
  },
  {
    title: "Read Hari's book 'Chasing the Scream' for the full argument",
    description: "The TED talk is a 15-minute summary. The book covers the War on Drugs history, additional case studies, and more nuanced arguments.",
    priority: "low",
    category: "Further Reading",
  },
]

export const DEMO_DETAILED_ANALYSIS = `## The Core Argument

Hari structures his talk around a single thesis: **addiction is an adaptation to environment, not a response to chemical hooks.** He builds this argument in three moves:

1. **Dismantling the chemical-hook model.** He points out that hospital patients routinely receive diamorphine (medical heroin) for pain management but rarely become addicted, which contradicts the idea that exposure alone causes addiction.

2. **Introducing environmental evidence.** The Rat Park experiment and Vietnam veteran data both suggest that environment and social connection dramatically influence addictive behavior.

3. **Proposing a policy solution.** Portugal's decriminalization is presented as proof that treating addiction as a health issue rather than a criminal one produces better outcomes.

## What Works Well

The talk is effective because it uses **concrete, verifiable examples** rather than abstract theorizing. The progression from rat experiments to human data to national policy gives the argument escalating credibility. Hari's personal connection to the topic (family members with addiction) grounds what could otherwise feel like a detached academic exercise.

The central metaphor, "the opposite of addiction is connection," is memorable and directionally correct, even if it oversimplifies the clinical reality.

## Where It Falls Short

The main weakness is **false dichotomy**. Hari frames the debate as "chemical hooks vs. social bonds" when modern addiction science recognizes both factors operating simultaneously. Genetic predisposition, trauma history, and neurochemistry all play documented roles that are not addressed here.

The Portugal statistics, while directionally accurate, lack the precision that a policy discussion demands. Different metrics (drug use rates, overdose deaths, HIV transmission, treatment uptake) tell somewhat different stories about Portugal's success.

## Speaker Style and Persuasion Techniques

Hari employs several effective rhetorical techniques: **personal vulnerability** (sharing about family addiction), **authority by association** (citing named professors and published studies), and **narrative escalation** (building from rats to veterans to national policy). His delivery is confident and emotionally engaging, which may lead viewers to accept claims with less scrutiny than they warrant.`

// Tab configuration for the demo — matches the real analysis sections
export interface DemoTab {
  id: string
  label: string
  shortLabel: string
  color: "blue" | "amber" | "emerald" | "cyan" | "orange" | "violet"
}

export const DEMO_TABS: DemoTab[] = [
  { id: "overview", label: "Overview", shortLabel: "Overview", color: "blue" },
  { id: "assessment", label: "Quick Assessment", shortLabel: "Assessment", color: "amber" },
  { id: "truth-check", label: "Truth Check", shortLabel: "Truth Check", color: "emerald" },
  { id: "action-items", label: "Action Items", shortLabel: "Actions", color: "orange" },
  { id: "deep-dive", label: "Deep Dive", shortLabel: "Deep Dive", color: "violet" },
]
