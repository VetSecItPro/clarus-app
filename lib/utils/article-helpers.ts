import { Youtube, ShieldCheck, Zap, Sparkles, BookOpen } from "lucide-react"

export type ArticleCategory =
  | "content-analysis"
  | "fact-checking"
  | "productivity"
  | "ai-tools"
  | "research"

export const categoryConfig: Record<
  ArticleCategory,
  { label: string; icon: typeof Youtube; color: string; bg: string }
> = {
  "content-analysis": {
    label: "Content Analysis",
    icon: Youtube,
    color: "text-[#1d9bf0]",
    bg: "bg-[#1d9bf0]/10",
  },
  "fact-checking": {
    label: "Fact-Checking",
    icon: ShieldCheck,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  productivity: {
    label: "Productivity",
    icon: Zap,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
  "ai-tools": {
    label: "AI Tools",
    icon: Sparkles,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  research: {
    label: "Research",
    icon: BookOpen,
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
}

export const allCategories: ArticleCategory[] = [
  "content-analysis",
  "fact-checking",
  "productivity",
  "ai-tools",
  "research",
]
