"use client"

import { motion } from "framer-motion"
import {
  FileText,
  ListChecks,
  AlertTriangle,
  Music,
  Mic,
  Clock,
  Target,
  Lightbulb,
  Users,
  TrendingUp,
  Scale,
  BookOpen,
  Sparkles,
  Quote,
  Heart
} from "lucide-react"
import type { ContentCategory } from "@/types/database.types"

export type SuggestionAction =
  | "executive_summary"
  | "full_analysis"
  | "truth_check"
  | "ask_questions"
  | "custom_prompt"

interface SuggestionButtonsProps {
  onSelect: (action: SuggestionAction) => void
  onCustomPrompt?: (prompt: string) => void
  contentCategory?: ContentCategory
  contentType?: "youtube" | "article" | "x_post" | "podcast"
  disabled?: boolean
}

// Contextual quick prompts based on content category
const CATEGORY_PROMPTS: Record<ContentCategory, { label: string; prompt: string; icon: typeof FileText }[]> = {
  music: [
    { label: "Lyrics meaning", prompt: "What are the lyrics about? Explain the meaning and themes.", icon: Music },
    { label: "Artist background", prompt: "Tell me about the artist and their musical style.", icon: Mic },
    { label: "Similar songs", prompt: "What other songs or artists are similar to this?", icon: Heart },
  ],
  podcast: [
    { label: "Key takeaways", prompt: "What are the main takeaways from this podcast?", icon: Lightbulb },
    { label: "Guest info", prompt: "Who is the guest and what's their background?", icon: Users },
    { label: "Timestamps", prompt: "Give me timestamps for the main topics discussed.", icon: Clock },
    { label: "Action items", prompt: "What actionable advice was given?", icon: Target },
  ],
  news: [
    { label: "Source check", prompt: "How reliable are the sources cited in this article?", icon: AlertTriangle },
    { label: "Context", prompt: "What's the broader context behind this story?", icon: BookOpen },
    { label: "Both sides", prompt: "What are the different perspectives on this issue?", icon: Scale },
    { label: "What's next", prompt: "What are the likely next developments in this story?", icon: TrendingUp },
  ],
  opinion: [
    { label: "Main argument", prompt: "What's the author's main argument?", icon: Quote },
    { label: "Counter-arguments", prompt: "What are the strongest counter-arguments?", icon: Scale },
    { label: "Evidence check", prompt: "How well-supported are the claims made?", icon: AlertTriangle },
    { label: "Bias analysis", prompt: "What biases might be influencing this opinion piece?", icon: Target },
  ],
  educational: [
    { label: "Key concepts", prompt: "What are the key concepts I should understand?", icon: Lightbulb },
    { label: "Prerequisites", prompt: "What should I know before diving into this?", icon: BookOpen },
    { label: "Practice exercises", prompt: "Give me exercises to practice what's taught here.", icon: Target },
    { label: "Further learning", prompt: "What should I learn next after this?", icon: TrendingUp },
  ],
  entertainment: [
    { label: "Highlights", prompt: "What are the best moments or highlights?", icon: Sparkles },
    { label: "Context", prompt: "Is there any background context I should know?", icon: BookOpen },
    { label: "Similar content", prompt: "What similar content would I enjoy?", icon: Heart },
  ],
  documentary: [
    { label: "Verify claims", prompt: "How accurate are the claims in this documentary?", icon: AlertTriangle },
    { label: "Key points", prompt: "What are the main points and conclusions?", icon: Lightbulb },
    { label: "Sources", prompt: "What sources and evidence are presented?", icon: BookOpen },
    { label: "Perspectives", prompt: "What perspectives might be missing?", icon: Scale },
  ],
  product_review: [
    { label: "Pros & cons", prompt: "Summarize the main pros and cons mentioned.", icon: Scale },
    { label: "Key specs", prompt: "What are the key specifications discussed?", icon: ListChecks },
    { label: "Alternatives", prompt: "What alternatives are mentioned or should I consider?", icon: Target },
    { label: "Bias check", prompt: "Does the reviewer seem biased? Are there sponsorship concerns?", icon: AlertTriangle },
  ],
  tech: [
    { label: "Key points", prompt: "What are the main technical points?", icon: Lightbulb },
    { label: "Implications", prompt: "What are the implications of this for the industry?", icon: TrendingUp },
    { label: "Accuracy", prompt: "Are the technical claims accurate?", icon: AlertTriangle },
    { label: "Action items", prompt: "What should I do based on this information?", icon: Target },
  ],
  finance: [
    { label: "Key insights", prompt: "What are the main financial insights?", icon: Lightbulb },
    { label: "Risk analysis", prompt: "What risks should I be aware of?", icon: AlertTriangle },
    { label: "Action items", prompt: "What actionable steps are recommended?", icon: Target },
    { label: "Bias check", prompt: "Is there any bias or conflict of interest?", icon: Scale },
  ],
  health: [
    { label: "Key claims", prompt: "What are the main health claims made?", icon: Lightbulb },
    { label: "Evidence", prompt: "Is this backed by scientific evidence?", icon: AlertTriangle },
    { label: "Consult disclaimer", prompt: "Should I consult a professional before acting on this?", icon: Users },
    { label: "Action items", prompt: "What practical steps are recommended?", icon: Target },
  ],
  other: [
    { label: "Main points", prompt: "What are the main points of this content?", icon: Lightbulb },
    { label: "Key takeaways", prompt: "What should I take away from this?", icon: Target },
    { label: "More context", prompt: "Give me more context about this topic.", icon: BookOpen },
  ],
}

// Default prompts if category not matched
const DEFAULT_PROMPTS = [
  { label: "Key takeaways", prompt: "What are the main takeaways?", icon: Lightbulb },
  { label: "Accuracy check", prompt: "How accurate is the information presented?", icon: AlertTriangle },
  { label: "Action items", prompt: "What actionable advice is given?", icon: Target },
]

// Core action buttons (always shown first)
const CORE_ACTIONS: { action: SuggestionAction; label: string; icon: typeof FileText }[] = [
  { action: "executive_summary", label: "Summary", icon: FileText },
  { action: "truth_check", label: "Accuracy", icon: AlertTriangle },
  { action: "full_analysis", label: "Deep Dive", icon: ListChecks },
]

// Categories that don't need accuracy analysis
const NO_ACCURACY_CHECK_CATEGORIES: ContentCategory[] = ["music", "entertainment"]

export function SuggestionButtons({
  onSelect,
  onCustomPrompt,
  contentCategory,
  contentType: _contentType,
  disabled = false,
}: SuggestionButtonsProps) {
  // Filter core actions based on category
  const filteredCoreActions = CORE_ACTIONS.filter((action) => {
    if (action.action === "truth_check" && contentCategory && NO_ACCURACY_CHECK_CATEGORIES.includes(contentCategory)) {
      return false
    }
    return true
  })

  // Get contextual prompts
  const contextualPrompts = contentCategory
    ? (CATEGORY_PROMPTS[contentCategory] || DEFAULT_PROMPTS)
    : DEFAULT_PROMPTS

  const handleContextualPrompt = (prompt: string) => {
    if (onCustomPrompt) {
      onCustomPrompt(prompt)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3 ml-9"
    >
      {/* Core action buttons */}
      <div className="flex flex-wrap gap-2">
        {filteredCoreActions.map((action, index) => {
          const Icon = action.icon
          return (
            <motion.button
              key={action.action}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              onClick={() => onSelect(action.action)}
              disabled={disabled}
              className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 hover:border-brand/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon className="w-4 h-4 text-brand" />
              <span className="text-sm font-medium text-brand">
                {action.label}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Contextual prompt chips */}
      {onCustomPrompt && contextualPrompts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {contextualPrompts.slice(0, 4).map((prompt, index) => {
            const Icon = prompt.icon
            return (
              <motion.button
                key={prompt.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.15 + index * 0.03 }}
                onClick={() => handleContextualPrompt(prompt.prompt)}
                disabled={disabled}
                className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon className="w-3 h-3 text-white/50 group-hover:text-white/70" />
                <span className="text-xs text-white/70 group-hover:text-white">
                  {prompt.label}
                </span>
              </motion.button>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

// Compact version for inline use
export function SuggestionChips({
  onSelect,
  suggestions,
  disabled = false,
}: {
  onSelect: (text: string) => void
  suggestions: string[]
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={suggestion}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-white/70 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {suggestion}
        </motion.button>
      ))}
    </div>
  )
}
