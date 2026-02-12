"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Rss, Trash2, Loader2, Podcast, Youtube, ExternalLink } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import withAuth, { type WithAuthInjectedProps } from "@/components/with-auth"
import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { TIER_LIMITS, TIER_FEATURES } from "@/lib/tier-limits"
import { cn } from "@/lib/utils"
import { useUserTier } from "@/lib/hooks/use-user-tier"

// Lazy-load dialogs and lists
const AddPodcastDialog = dynamic(() => import("@/components/podcasts/add-podcast-dialog").then(m => ({ default: m.AddPodcastDialog })), { ssr: false })
const EpisodeList = dynamic(() => import("@/components/podcasts/episode-list").then(m => ({ default: m.EpisodeList })), { ssr: false })
const AddYouTubeDialog = dynamic(() => import("@/components/youtube/add-youtube-dialog").then(m => ({ default: m.AddYouTubeDialog })), { ssr: false })
const VideoList = dynamic(() => import("@/components/youtube/video-list").then(m => ({ default: m.VideoList })), { ssr: false })

interface PodcastSubscription {
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

interface YouTubeSubscription {
  id: string
  channel_id: string
  channel_name: string
  channel_image_url: string | null
  feed_url: string
  last_checked_at: string | null
  last_video_date: string | null
  is_active: boolean
  created_at: string | null
  latest_video: {
    video_title: string
    published_date: string | null
  } | null
}

type FeedTab = "podcasts" | "youtube"

function FeedsPage({ session }: WithAuthInjectedProps) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "youtube" ? "youtube" : "podcasts"

  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab)
  const [podcastSubs, setPodcastSubs] = useState<PodcastSubscription[]>([])
  const [youtubeSubs, setYoutubeSubs] = useState<YouTubeSubscription[]>([])
  const [podcastLoading, setPodcastLoading] = useState(true)
  const [youtubeLoading, setYoutubeLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { tier: userTier } = useUserTier(session?.user?.id ?? null)

  const fetchPodcastSubs = useCallback(async () => {
    try {
      const response = await fetch("/api/podcast-subscriptions")
      const data = await response.json()
      if (response.ok) setPodcastSubs(data.subscriptions)
    } catch {
      toast.error("Failed to load podcast subscriptions")
    } finally {
      setPodcastLoading(false)
    }
  }, [])

  const fetchYoutubeSubs = useCallback(async () => {
    try {
      const response = await fetch("/api/youtube-subscriptions")
      const data = await response.json()
      if (response.ok) setYoutubeSubs(data.subscriptions)
    } catch {
      toast.error("Failed to load YouTube subscriptions")
    } finally {
      setYoutubeLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPodcastSubs()
    fetchYoutubeSubs()
  }, [fetchPodcastSubs, fetchYoutubeSubs])

  const handleDeletePodcast = async (id: string, name: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      const response = await fetch(`/api/podcast-subscriptions/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error ?? "Failed to remove subscription")
        return
      }
      setPodcastSubs((prev) => prev.filter((s) => s.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast.success(`Unsubscribed from ${name}`)
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteYouTube = async (id: string, name: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      const response = await fetch(`/api/youtube-subscriptions/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error ?? "Failed to remove subscription")
        return
      }
      setYoutubeSubs((prev) => prev.filter((s) => s.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast.success(`Unsubscribed from ${name}`)
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  const podcastLimit = TIER_LIMITS[userTier].podcastSubscriptions
  const youtubeLimit = TIER_LIMITS[userTier].youtubeSubscriptions
  const hasPodcastAccess = TIER_FEATURES[userTier].podcastSubscriptions
  const hasYoutubeAccess = TIER_FEATURES[userTier].youtubeSubscriptions

  const tabs: { id: FeedTab; label: string; icon: typeof Podcast; count: number }[] = [
    { id: "podcasts", label: "Podcasts", icon: Podcast, count: podcastSubs.length },
    { id: "youtube", label: "YouTube", icon: Youtube, count: youtubeSubs.length },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 sm:pb-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Rss className="w-7 h-7 text-[#1d9bf0]" />
              Feeds
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Subscribe to channels and never miss new content.
            </p>
          </div>

          {/* Add button changes based on active tab */}
          {activeTab === "podcasts" && hasPodcastAccess && (
            <AddPodcastDialog
              currentCount={podcastSubs.length}
              limit={podcastLimit}
              onSubscribed={fetchPodcastSubs}
            />
          )}
          {activeTab === "youtube" && hasYoutubeAccess && (
            <AddYouTubeDialog
              currentCount={youtubeSubs.length}
              limit={youtubeLimit}
              onSubscribed={fetchYoutubeSubs}
            />
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setExpandedId(null)
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative focus-visible:ring-2 focus-visible:ring-[#1d9bf0]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-black focus-visible:outline-none active:opacity-80",
                activeTab === tab.id
                  ? "text-white"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "ml-1 text-xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-white/10" : "bg-white/5 text-white/30"
                )}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="feeds-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#1d9bf0] rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* === PODCASTS TAB === */}
        {activeTab === "podcasts" && (
          <>
            {/* Tier limit indicator */}
            {hasPodcastAccess && (
              <div className="mb-6 flex items-center gap-2 text-xs text-white/40">
                <span>{podcastSubs.length} / {podcastLimit} subscriptions used</span>
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden max-w-[120px]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      podcastSubs.length >= podcastLimit ? "bg-red-500"
                        : podcastSubs.length >= podcastLimit - 1 ? "bg-amber-500"
                        : "bg-[#1d9bf0]"
                    )}
                    style={{ width: `${Math.min((podcastSubs.length / podcastLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* No access */}
            {!hasPodcastAccess && (
              <NoAccessState
                icon={Podcast}
                title="Podcast Monitoring"
                description="Subscribe to podcast RSS feeds and get notified when new episodes drop. Choose which episodes to analyze."
              />
            )}

            {/* Loading */}
            {hasPodcastAccess && podcastLoading && <LoadingSpinner />}

            {/* Empty */}
            {hasPodcastAccess && !podcastLoading && podcastSubs.length === 0 && (
              <EmptyState
                icon={Rss}
                title="No podcast subscriptions yet"
                description="Add your first podcast RSS feed to start monitoring for new episodes."
              >
                <AddPodcastDialog
                  currentCount={0}
                  limit={podcastLimit}
                  onSubscribed={fetchPodcastSubs}
                />
              </EmptyState>
            )}

            {/* Subscription list */}
            {hasPodcastAccess && !podcastLoading && podcastSubs.length > 0 && (
              <SubscriptionList>
                {podcastSubs.map((sub, index) => (
                  <SubscriptionCard
                    key={sub.id}
                    index={index}
                    id={sub.id}
                    name={sub.podcast_name}
                    imageUrl={sub.podcast_image_url}
                    feedUrl={sub.feed_url}
                    latestTitle={sub.latest_episode?.episode_title ?? null}
                    latestDate={sub.latest_episode?.episode_date ?? null}
                    icon={Podcast}
                    isExpanded={expandedId === sub.id}
                    isDeleting={deletingId === sub.id}
                    onToggle={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                    onDelete={() => handleDeletePodcast(sub.id, sub.podcast_name)}
                  >
                    <EpisodeList subscriptionId={sub.id} podcastName={sub.podcast_name} />
                  </SubscriptionCard>
                ))}
              </SubscriptionList>
            )}
          </>
        )}

        {/* === YOUTUBE TAB === */}
        {activeTab === "youtube" && (
          <>
            {/* Tier limit indicator */}
            {hasYoutubeAccess && (
              <div className="mb-6 flex items-center gap-2 text-xs text-white/40">
                <span>{youtubeSubs.length} / {youtubeLimit} subscriptions used</span>
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden max-w-[120px]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      youtubeSubs.length >= youtubeLimit ? "bg-red-500"
                        : youtubeSubs.length >= youtubeLimit - 1 ? "bg-amber-500"
                        : "bg-red-500/70"
                    )}
                    style={{ width: `${Math.min((youtubeSubs.length / youtubeLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* No access */}
            {!hasYoutubeAccess && (
              <NoAccessState
                icon={Youtube}
                title="YouTube Channel Monitoring"
                description="Subscribe to YouTube channels and get notified when new videos are posted. Analyze any video with one click."
              />
            )}

            {/* Loading */}
            {hasYoutubeAccess && youtubeLoading && <LoadingSpinner />}

            {/* Empty */}
            {hasYoutubeAccess && !youtubeLoading && youtubeSubs.length === 0 && (
              <EmptyState
                icon={Youtube}
                title="No YouTube subscriptions yet"
                description="Add your first YouTube channel to start monitoring for new videos."
              >
                <AddYouTubeDialog
                  currentCount={0}
                  limit={youtubeLimit}
                  onSubscribed={fetchYoutubeSubs}
                />
              </EmptyState>
            )}

            {/* Subscription list */}
            {hasYoutubeAccess && !youtubeLoading && youtubeSubs.length > 0 && (
              <SubscriptionList>
                {youtubeSubs.map((sub, index) => (
                  <SubscriptionCard
                    key={sub.id}
                    index={index}
                    id={sub.id}
                    name={sub.channel_name}
                    imageUrl={sub.channel_image_url}
                    feedUrl={sub.feed_url}
                    latestTitle={sub.latest_video?.video_title ?? null}
                    latestDate={sub.latest_video?.published_date ?? null}
                    icon={Youtube}
                    isExpanded={expandedId === sub.id}
                    isDeleting={deletingId === sub.id}
                    onToggle={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                    onDelete={() => handleDeleteYouTube(sub.id, sub.channel_name)}
                  >
                    <VideoList subscriptionId={sub.id} channelName={sub.channel_name} />
                  </SubscriptionCard>
                ))}
              </SubscriptionList>
            )}
          </>
        )}
      </main>

      <MobileBottomNav />
    </div>
  )
}

// === Shared sub-components ===

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-white/40" />
    </div>
  )
}

function NoAccessState({ icon: Icon, title, description }: { icon: typeof Podcast; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 px-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
        <Icon className="w-8 h-8 text-white/30" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
      <p className="text-white/50 text-sm max-w-md mx-auto mb-6">{description}</p>
      <Link
        href="/pricing"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
      >
        Upgrade to Starter
      </Link>
    </motion.div>
  )
}

function EmptyState({ icon: Icon, title, description, children }: { icon: typeof Podcast; title: string; description: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 px-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
        <Icon className="w-8 h-8 text-white/30" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
      <p className="text-white/50 text-sm max-w-md mx-auto mb-6">{description}</p>
      {children}
    </motion.div>
  )
}

function SubscriptionList({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <AnimatePresence initial={false}>
        {children}
      </AnimatePresence>
    </div>
  )
}

interface SubscriptionCardProps {
  index: number
  id: string
  name: string
  imageUrl: string | null
  feedUrl: string
  latestTitle: string | null
  latestDate: string | null
  icon: typeof Podcast
  isExpanded: boolean
  isDeleting: boolean
  onToggle: () => void
  onDelete: () => void
  children: React.ReactNode
}

function SubscriptionCard({
  index, name, imageUrl, feedUrl, latestTitle, latestDate,
  icon: Icon, isExpanded, isDeleting, onToggle, onDelete, children,
}: SubscriptionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
        aria-label={`Toggle details for ${name}`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={56}
            height={56}
            sizes="56px"
            className="w-14 h-14 rounded-xl object-cover shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-white/30" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{name}</h3>
          {latestTitle ? (
            <p className="text-white/40 text-sm truncate mt-0.5">Latest: {latestTitle}</p>
          ) : (
            <p className="text-white/30 text-sm mt-0.5">No content found yet</p>
          )}
          {latestDate && (
            <p className="text-white/30 text-xs mt-0.5">
              {new Date(latestDate).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <a
            href={feedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            aria-label={`Open feed for ${name}`}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            aria-label={`Unsubscribe from ${name}`}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="p-4 pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default withAuth(FeedsPage)
