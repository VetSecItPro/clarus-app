"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Sparkles, Zap, Crown, Loader2 } from "lucide-react"
import type { UserTier } from "@/types/database.types"
import { TIER_LIMITS, TIER_FEATURES } from "@/lib/tier-limits"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: string
  currentTier: UserTier
  /** Which tier unlocks this feature */
  requiredTier?: "starter" | "pro"
  /** Current usage count (if limit-based) */
  currentCount?: number
  /** Monthly limit hit (if limit-based) */
  limit?: number
}

const TIER_ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="w-5 h-5" />,
  pro: <Crown className="w-5 h-5" />,
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  starter: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-300",
    accent: "bg-blue-500 hover:bg-blue-600",
  },
  pro: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-300",
    accent: "bg-purple-500 hover:bg-purple-600",
  },
}

function TierCard({ tier, isRecommended }: { tier: "starter" | "pro"; isRecommended: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const colors = TIER_COLORS[tier]
  const limits = TIER_LIMITS[tier]
  const features = TIER_FEATURES[tier]
  const price = tier === "starter" ? "$18/mo" : "$29/mo"

  async function handleCheckout() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/polar/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval: "monthly" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Checkout failed")
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`relative rounded-xl border p-4 ${colors.bg} ${colors.border} ${isRecommended ? "ring-1 ring-blue-500/40" : ""}`}>
      {isRecommended && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-blue-500 text-[10px] font-semibold text-white uppercase tracking-wider">
          Recommended
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <span className={colors.text}>{TIER_ICONS[tier]}</span>
        <span className="text-white font-semibold capitalize">{tier}</span>
        <span className="text-white/40 text-sm ml-auto">{price}</span>
      </div>
      <ul className="space-y-1.5 text-xs text-white/60">
        <li>{limits.analyses} analyses/mo</li>
        <li>{limits.chatMessagesMonthly} chat messages/mo</li>
        <li>{limits.chatMessagesPerContent} messages/content</li>
        {features.shareLinks && <li>Shareable analysis links</li>}
        {features.exports && <li>PDF &amp; Markdown export</li>}
        {features.weeklyDigest && <li>Weekly digest email</li>}
        {features.claimTracking && <li>Cross-content claim tracking</li>}
        {features.priorityProcessing && <li>Priority processing</li>}
      </ul>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`block mt-3 w-full text-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${colors.accent}`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Redirecting...
          </span>
        ) : (
          `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)}`
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  )
}

export function UpgradeModal({
  isOpen,
  onClose,
  feature,
  currentTier,
  requiredTier,
  currentCount,
  limit,
}: UpgradeModalProps) {
  const isLimitBased = currentCount !== undefined && limit !== undefined
  const suggestedTier = requiredTier ?? "starter"

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* FIX-305: added role, aria-modal, aria-labelledby */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="upgrade-modal-title"
              className="w-full max-w-md bg-gray-900 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h2 id="upgrade-modal-title" className="text-white font-semibold text-lg">Upgrade Your Plan</h2>
                </div>
                {/* FIX-302: added aria-label for icon-only close button */}
                <button
                  onClick={onClose}
                  aria-label="Close upgrade dialog"
                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 py-4 space-y-4">
                {/* Message */}
                <div className="text-sm text-white/70">
                  {isLimitBased ? (
                    <>
                      You&apos;ve reached your monthly limit for <span className="text-white font-medium">{feature}</span>.
                      <span className="block text-white/40 text-xs mt-1">
                        Used {currentCount} of {limit} this month.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-white font-medium">{feature}</span> is available on the{" "}
                      <span className="capitalize text-white font-medium">{suggestedTier}</span> plan and above.
                    </>
                  )}
                </div>

                {/* Usage bar (for limit-based) */}
                {isLimitBased && (
                  <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: "100%" }}
                    />
                  </div>
                )}

                {/* Tier cards */}
                <div className="space-y-3">
                  {currentTier === "free" && (
                    <TierCard tier="starter" isRecommended={suggestedTier === "starter"} />
                  )}
                  <TierCard tier="pro" isRecommended={suggestedTier === "pro"} />
                </div>

                {/* Current plan note */}
                <div className="text-center text-xs text-white/30">
                  Currently on the <span className="capitalize">{currentTier}</span> plan
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
