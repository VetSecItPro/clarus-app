"use client"

import { useEffect, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { Rss, Trash2, Loader2, Podcast, ExternalLink } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import withAuth, { type WithAuthInjectedProps } from "@/components/with-auth"
import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { supabase } from "@/lib/supabase"
import { normalizeTier, TIER_LIMITS, TIER_FEATURES } from "@/lib/tier-limits"
import { cn } from "@/lib/utils"
import type { UserTier } from "@/types/database.types"

// PERF: FIX-PERF-005 — lazy-load dialog and episode list to reduce initial bundle > 200kB
const AddPodcastDialog = dynamic(() => import("@/components/podcasts/add-podcast-dialog").then(m => ({ default: m.AddPodcastDialog })), { ssr: false })
const EpisodeList = dynamic(() => import("@/components/podcasts/episode-list").then(m => ({ default: m.EpisodeList })), { ssr: false })

interface Subscription {
  id: string
  feed_url: string
  podcast_name: string
  podcast_image_url: string | null
  last_checked_at: string | null
  last_episode_date: string | null
  is_active: boolean
  created_at: string | null
  latest_episode: {
    episode_title: string
    episode_date: string | null
  } | null
}

type PodcastsPageProps = WithAuthInjectedProps

function PodcastsPage({ session }: PodcastsPageProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [userTier, setUserTier] = useState<UserTier>("free")

  const fetchSubscriptions = useCallback(async () => {
    try {
      const response = await fetch("/api/podcast-subscriptions")
      const data = await response.json()
      if (response.ok) {
        setSubscriptions(data.subscriptions)
      }
    } catch {
      toast.error("Failed to load podcast subscriptions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  useEffect(() => {
    const fetchTier = async () => {
      if (!session?.user) return
      const { data } = await supabase
        .from("users")
        .select("tier, day_pass_expires_at")
        .eq("id", session.user.id)
        .single()
      if (data) {
        setUserTier(normalizeTier(data.tier, data.day_pass_expires_at))
      }
    }
    fetchTier()
  }, [session])

  const handleDelete = async (id: string, name: string) => {
    if (deletingId) return
    setDeletingId(id)

    try {
      const response = await fetch(`/api/podcast-subscriptions/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error ?? "Failed to remove subscription")
        return
      }

      setSubscriptions((prev) => prev.filter((s) => s.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast.success(`Unsubscribed from ${name}`)
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  const limit = TIER_LIMITS[userTier].podcastSubscriptions
  const hasAccess = TIER_FEATURES[userTier].podcastSubscriptions

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 sm:pb-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Podcast className="w-7 h-7 text-[#1d9bf0]" />
              Podcasts
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Subscribe to podcast feeds and never miss an episode.
            </p>
          </div>

          {hasAccess && (
            <AddPodcastDialog
              currentCount={subscriptions.length}
              limit={limit}
              onSubscribed={fetchSubscriptions}
            />
          )}
        </div>

        {/* Tier limit indicator */}
        {hasAccess && (
          <div className="mb-6 flex items-center gap-2 text-xs text-white/40">
            <span>{subscriptions.length} / {limit} subscriptions used</span>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden max-w-[120px]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  subscriptions.length >= limit
                    ? "bg-red-500"
                    : subscriptions.length >= limit - 1
                    ? "bg-amber-500"
                    : "bg-[#1d9bf0]"
                )}
                style={{ width: `${Math.min((subscriptions.length / limit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* No access state */}
        {!hasAccess && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
              <Podcast className="w-8 h-8 text-white/30" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              Podcast Monitoring
            </h2>
            <p className="text-white/50 text-sm max-w-md mx-auto mb-6">
              Subscribe to podcast RSS feeds and get notified when new episodes drop.
              Choose which episodes to analyze -- your quota is only used when you decide.
            </p>
            {/* FE: FIX-FE-002 — replaced nested Link>Button with Link styled as button */}
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Upgrade to Starter
            </Link>
          </motion.div>
        )}

        {/* Loading state */}
        {hasAccess && loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
          </div>
        )}

        {/* Empty state */}
        {hasAccess && !loading && subscriptions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
              <Rss className="w-8 h-8 text-white/30" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              No podcast subscriptions yet
            </h2>
            <p className="text-white/50 text-sm max-w-md mx-auto mb-6">
              Add your first podcast RSS feed to start monitoring for new episodes.
              You will be notified when new episodes are released -- no auto-analysis, no surprise charges.
            </p>
            <AddPodcastDialog
              currentCount={0}
              limit={limit}
              onSubscribed={fetchSubscriptions}
            />
          </motion.div>
        )}

        {/* Subscriptions list */}
        {hasAccess && !loading && subscriptions.length > 0 && (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {subscriptions.map((sub, index) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
                >
                  {/* Subscription header */}
                  <button
                    onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
                    aria-label={`Toggle episodes for ${sub.podcast_name}`}
                  >
                    {/* Podcast artwork */}
                    {/* PERF: FIX-PERF-012 — unoptimized kept: podcast artwork comes from arbitrary RSS feed domains */}
                    {sub.podcast_image_url ? (
                      <Image
                        src={sub.podcast_image_url}
                        alt={sub.podcast_name}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
                        unoptimized
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        <Podcast className="w-6 h-6 text-white/30" />
                      </div>
                    )}

                    {/* Podcast info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">
                        {sub.podcast_name}
                      </h3>
                      {sub.latest_episode ? (
                        <p className="text-white/40 text-sm truncate mt-0.5">
                          Latest: {sub.latest_episode.episode_title}
                        </p>
                      ) : (
                        <p className="text-white/30 text-sm mt-0.5">
                          No episodes found yet
                        </p>
                      )}
                      {sub.latest_episode?.episode_date && (
                        <p className="text-white/30 text-xs mt-0.5">
                          {new Date(sub.latest_episode.episode_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={sub.feed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                        aria-label={`Open RSS feed for ${sub.podcast_name}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(sub.id, sub.podcast_name)}
                        disabled={deletingId === sub.id}
                        className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        aria-label={`Unsubscribe from ${sub.podcast_name}`}
                      >
                        {deletingId === sub.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </button>

                  {/* Episode list (expanded) */}
                  <AnimatePresence>
                    {expandedId === sub.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-white/[0.06]"
                      >
                        <div className="p-4 pt-2">
                          <EpisodeList
                            subscriptionId={sub.id}
                            podcastName={sub.podcast_name}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  )
}

export default withAuth(PodcastsPage)
