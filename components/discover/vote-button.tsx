"use client"

import { useState, useCallback } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface VoteButtonProps {
  contentId: string
  initialVoteScore: number
  initialUserVote: number | null
  onVoteChange?: (newScore: number, newUserVote: number | null) => void
}

export function VoteButton({ contentId, initialVoteScore, initialUserVote, onVoteChange }: VoteButtonProps) {
  const [voteScore, setVoteScore] = useState(initialVoteScore)
  const [userVote, setUserVote] = useState<number | null>(initialUserVote)
  const [isVoting, setIsVoting] = useState(false)

  const handleVote = useCallback(async (vote: 1 | -1) => {
    if (isVoting) return

    // Optimistic update
    const prevScore = voteScore
    const prevUserVote = userVote

    let newScore: number
    let newUserVote: number | null

    if (userVote === vote) {
      // Toggle off
      newScore = voteScore - vote
      newUserVote = null
    } else if (userVote !== null) {
      // Changing vote direction
      newScore = voteScore - userVote + vote
      newUserVote = vote
    } else {
      // New vote
      newScore = voteScore + vote
      newUserVote = vote
    }

    setVoteScore(newScore)
    setUserVote(newUserVote)
    setIsVoting(true)

    try {
      const response = await fetch("/api/discover/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, vote }),
      })

      if (!response.ok) {
        // Revert on error
        setVoteScore(prevScore)
        setUserVote(prevUserVote)
        return
      }

      const data = await response.json() as { voteScore: number; userVote: number | null }
      setVoteScore(data.voteScore)
      setUserVote(data.userVote)
      onVoteChange?.(data.voteScore, data.userVote)
    } catch {
      // Revert on error
      setVoteScore(prevScore)
      setUserVote(prevUserVote)
    } finally {
      setIsVoting(false)
    }
  }, [contentId, voteScore, userVote, isVoting, onVoteChange])

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={() => handleVote(1)}
        disabled={isVoting}
        className={cn(
          "w-7 h-7 flex items-center justify-center rounded-md transition-all duration-200",
          userVote === 1
            ? "bg-brand/20 text-brand border border-brand/30"
            : "text-white/30 hover:text-white/60 hover:bg-white/[0.06]"
        )}
        aria-label="Upvote"
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      <AnimatePresence mode="popLayout">
        <motion.span
          key={voteScore}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "text-xs font-semibold tabular-nums min-w-[20px] text-center",
            voteScore > 0 ? "text-brand" : voteScore < 0 ? "text-red-400" : "text-white/40"
          )}
        >
          {voteScore}
        </motion.span>
      </AnimatePresence>

      <button
        onClick={() => handleVote(-1)}
        disabled={isVoting}
        className={cn(
          "w-7 h-7 flex items-center justify-center rounded-md transition-all duration-200",
          userVote === -1
            ? "bg-red-500/20 text-red-400 border border-red-500/30"
            : "text-white/30 hover:text-white/60 hover:bg-white/[0.06]"
        )}
        aria-label="Downvote"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  )
}
