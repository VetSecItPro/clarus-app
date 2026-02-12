/**
 * @module article-helpers
 * @description Blog article category configuration for the `/blog` section.
 *
 * Maps each article category to its display label, icon component,
 * and color scheme. Used by the blog index, article cards, and
 * category filter chips.
 *
 * @see {@link lib/data/blog-articles.ts} for the article content data
 */

import { Youtube, ShieldCheck, Zap, Sparkles, BookOpen } from "lucide-react"

/** The five blog article categories. */
export type ArticleCategory =
  | "content-analysis"
  | "fact-checking"
  | "productivity"
  | "ai-tools"
  | "research"

/** Display configuration for each article category (label, icon, colors). */
export const categoryConfig: Record<
  ArticleCategory,
  { label: string; icon: typeof Youtube; color: string; bg: string }
> = {
  "content-analysis": {
    label: "Content Analysis",
    icon: Youtube,
    color: "text-brand",
    bg: "bg-brand/10",
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

/** All category values in display order, used for filter chip rendering. */
export const allCategories: ArticleCategory[] = [
  "content-analysis",
  "fact-checking",
  "productivity",
  "ai-tools",
  "research",
]
