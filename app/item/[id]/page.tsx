"use client"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Play, Trash2, Share2, Loader2, FileText, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/types/database.types"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import withAuth from "@/components/with-auth"
import { formatDuration, getYouTubeVideoId, getDomainFromUrl } from "@/lib/utils"
import { YouTubeEmbed } from "@next/third-parties/google"
import type { Session } from "@supabase/supabase-js"
import { EditAIPromptsModal } from "@/components/edit-ai-prompts-modal"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { ChatPanel } from "@/components/chat-panel"
import { SIGNAL_NOISE_OPTIONS } from "@/constants"
import { toast } from "sonner"

interface ItemDetailPageProps {
  params: { id: string }
  session: Session | null
}

type ContentItem = Tables<true, "content">
type SummaryItem = Tables<true, "summaries">

interface ContentWithSummary extends ContentItem {
  summary?: SummaryItem | null
  isProcessing?: boolean
}

function ItemDetailPageContent({ params, session }: ItemDetailPageProps) {
  const [item, setItem] = useState<ContentWithSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMainTab, setActiveMainTab] = useState("summary")
  const [isEditPromptModalOpen, setIsEditPromptModalOpen] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isPdf, setIsPdf] = useState(false)
  const [currentUserContentRating, setCurrentUserContentRating] = useState<{ signal_score: number } | null>(null)

  const router = useRouter()

  const handleSignalNoiseVote = useCallback(
    async (score: number) => {
      if (!session?.user?.id || !item) return

      try {
        const { error } = await supabase.from("content_ratings").upsert(
          {
            content_id: item.id,
            user_id: session.user.id,
            signal_score: score,
          },
          { onConflict: "content_id,user_id" },
        )

        if (error) throw error

        setCurrentUserContentRating({ signal_score: score })
        toast.success("Rating saved!")
      } catch (err: any) {
        toast.error("Failed to save rating")
      }
    },
    [session, item],
  )

  const handleDelete = useCallback(async () => {
    if (!item) return

    if (!confirm("Are you sure you want to delete this item?")) return

    try {
      const { error } = await supabase.from("content").delete().eq("id", item.id)
      if (error) throw error

      toast.success("Item deleted")
      router.push("/")
    } catch (err) {
      toast.error("Failed to delete item")
    }
  }, [item, router])

  const handleRegenerate = useCallback(async () => {
    if (!item) return

    setIsRegenerating(true)
    try {
      const response = await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: item.id, force_regenerate: true }),
      })

      if (!response.ok) throw new Error("Failed to regenerate")

      toast.success("Content regenerated!")

      // Refetch content
      const { data: contentData } = await supabase.from("content").select("*").eq("id", item.id).single()

      // Refetch summary
      const { data: summaryData } = await supabase
        .from("summaries")
        .select("*")
        .eq("content_id", item.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (contentData) {
        setItem({
          ...contentData,
          summary: summaryData || null,
        })
      }
    } catch (err) {
      toast.error("Failed to regenerate content")
    } finally {
      setIsRegenerating(false)
    }
  }, [item])

  useEffect(() => {
    const fetchItem = async () => {
      const { data: contentData, error: contentError } = await supabase
        .from("content")
        .select("*")
        .eq("id", params.id)
        .single()

      if (contentError) {
        setError(contentError.message)
        setLoading(false)
        return
      }

      const { data: summaryData } = await supabase
        .from("summaries")
        .select("*")
        .eq("content_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      const combinedItem: ContentWithSummary = {
        ...contentData,
        summary: summaryData || null,
      }

      setItem(combinedItem)
      setIsPdf(contentData.url?.endsWith(".pdf") || false)

      // Check for processing failure
      if (contentData.full_text?.startsWith("PROCESSING_FAILED::")) {
        setProcessingError(contentData.full_text)
      }

      setLoading(false)
    }

    // Fetch user's rating for this content
    const fetchRating = async () => {
      if (!session?.user?.id) return

      const { data } = await supabase
        .from("content_ratings")
        .select("signal_score")
        .eq("content_id", params.id)
        .eq("user_id", session.user.id)
        .single()

      if (data) {
        setCurrentUserContentRating({ signal_score: data.signal_score })
      }
    }

    fetchItem()
    fetchRating()
  }, [params.id, session])

  const renderSignalNoiseRating = () => (
    <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/[0.08]">
      <h3 className="text-base sm:text-lg font-semibold text-white mb-4 sm:mb-6">Signal/Noise Rating</h3>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {SIGNAL_NOISE_OPTIONS.map((rating) => (
          <button
            key={rating.label}
            onClick={() => handleSignalNoiseVote(rating.score)}
            className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 rounded-xl backdrop-blur-xl transition-all border h-20 sm:h-24 ${
              currentUserContentRating?.signal_score === rating.score
                ? "bg-[#1d9bf0] border-[#1d9bf0]/50 text-white shadow-lg shadow-blue-500/20"
                : "bg-white/[0.04] border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-white hover:border-white/[0.12]"
            }`}
          >
            <span className="text-xl sm:text-2xl">{rating.emoji}</span>
            <span className="text-[10px] sm:text-xs font-medium">{rating.label}</span>
          </button>
        ))}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
        <p className="ml-2 text-white/60 text-sm">Loading...</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-lg font-medium text-white mb-4">{error || "Item not found"}</h2>
          <Link href="/">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white transition-all mx-auto">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </button>
          </Link>
        </div>
      </div>
    )
  }

  const displayDomain = getDomainFromUrl(item.url)
  const displaySavedAt = item.date_added
    ? formatDistanceToNow(new Date(item.date_added), { addSuffix: true })
    : "unknown"
  const displayDuration = item.type === "youtube" ? formatDuration(item.duration) : null
  const videoId = item.type === "youtube" ? getYouTubeVideoId(item.url) : null

  const summary = item.summary

  return (
    <div className="min-h-screen bg-black pb-24">
      <header className="bg-white/[0.03] backdrop-blur-xl border-b border-white/[0.08] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left side: Back button + Tab switcher */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08]"
                  aria-label="Back to home"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>

              <div className="flex items-center gap-1 bg-white/[0.04] backdrop-blur-xl p-1 rounded-xl border border-white/[0.08]">
                <button
                  onClick={() => setActiveMainTab("summary")}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    activeMainTab === "summary"
                      ? "bg-[#1d9bf0] text-white shadow-lg shadow-blue-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setActiveMainTab("fulltext")}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    activeMainTab === "fulltext"
                      ? "bg-[#1d9bf0] text-white shadow-lg shadow-blue-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  Full Text
                </button>
              </div>
            </div>

            {/* Right side: Action buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditPromptModalOpen(true)}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08]"
                aria-label="Edit AI Prompts"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08]"
                aria-label="Share"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/[0.04] hover:bg-red-500/10 text-red-500 hover:text-red-400 border border-white/[0.08] hover:border-red-500/30"
                onClick={handleDelete}
                aria-label="Delete item"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <article className="max-w-2xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3 sm:mb-4">
            {item.title || "Processing Title..."}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-6 sm:mb-8">
            <span className="px-2 py-1 rounded-lg bg-white/[0.04]">{displayDomain}</span>
            {item.author && <span className="px-2 py-1 rounded-lg bg-white/[0.04]">{item.author}</span>}
            <span className="px-2 py-1 rounded-lg bg-white/[0.04] flex items-center gap-1">
              {item.type === "youtube" ? (
                <>
                  <Play className="w-3 h-3" />
                  {displayDuration}
                </>
              ) : (
                <>
                  <FileText className="w-3 h-3" />
                  Article
                </>
              )}
            </span>
            <span className="px-2 py-1 rounded-lg bg-white/[0.04]">{displaySavedAt}</span>
          </div>

          {activeMainTab === "summary" ? (
            <div className="space-y-6 sm:space-y-8">
              {processingError ? (
                <div className="p-4 text-center rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                  <h3 className="text-base font-medium text-yellow-300 mb-2">Processing Failed</h3>
                  <p className="text-sm text-yellow-300/70 mb-3">We couldn't retrieve the content from the source.</p>
                  <p className="text-xs text-yellow-300/50 mb-4">{processingError}</p>
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 transition-all disabled:opacity-50 text-sm"
                  >
                    {isRegenerating ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Regenerating...
                      </span>
                    ) : (
                      "Try Regenerating"
                    )}
                  </button>
                </div>
              ) : item.isProcessing ? (
                <div className="py-6 flex items-center justify-center text-white/40 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing content...
                </div>
              ) : (
                <>
                  {summary ? (
                    <div className="py-4 sm:py-6 border-b border-white/[0.08]">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg sm:text-xl font-semibold text-white">Summary</h2>
                        <Button
                          onClick={handleRegenerate}
                          disabled={isRegenerating}
                          size="sm"
                          className="bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/[0.08] rounded-xl backdrop-blur-xl"
                        >
                          {isRegenerating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Regenerating...
                            </>
                          ) : (
                            "Regenerate"
                          )}
                        </Button>
                      </div>
                      <MarkdownRenderer>{summary.mid_length_summary}</MarkdownRenderer>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-white/40 text-sm mb-4">No summary generated yet.</p>
                      <button
                        onClick={handleRegenerate}
                        disabled={isRegenerating}
                        className="px-4 py-2 rounded-xl bg-[#1d9bf0] text-white text-sm hover:bg-[#1a8cd8] transition-all disabled:opacity-50"
                      >
                        {isRegenerating ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                          </span>
                        ) : (
                          "Generate Summary"
                        )}
                      </button>
                    </div>
                  )}
                  {renderSignalNoiseRating()}
                </>
              )}
            </div>
          ) : (
            <div>
              {loading && (
                <div className="flex items-center text-white/40 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading full text...
                </div>
              )}
              {!loading && !item.full_text && (
                <div className="flex items-center text-white/40 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Full text still processing...
                </div>
              )}
              {!loading && item.full_text && (
                <>
                  {isPdf ? (
                    <div className="mt-4">
                      <iframe
                        src={item.url}
                        title={item.title || "PDF Document"}
                        className="w-full h-[70vh] border-none rounded-2xl bg-white"
                      />
                      <p className="text-xs text-center text-white/30 mt-2">
                        PDF not loading?{" "}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-[#1d9bf0]"
                        >
                          Open in new tab
                        </a>
                      </p>
                    </div>
                  ) : (
                    <>
                      {item.type === "youtube" && videoId && (
                        <div className="aspect-video w-full rounded-2xl overflow-hidden">
                          <YouTubeEmbed videoid={videoId} style="width: 100%; height: 100%;" />
                        </div>
                      )}
                      {item.type === "article" && (
                        <>
                          {item.thumbnail_url && (
                            <Image
                              src={item.thumbnail_url || "/placeholder.svg"}
                              alt={item.title || "Content image"}
                              width={600}
                              height={300}
                              className="w-full h-auto max-h-64 object-cover rounded-2xl mb-6"
                              unoptimized
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          )}
                        </>
                      )}
                      <div className="mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <div className="prose prose-sm prose-invert max-w-none text-white/70 leading-relaxed">
                          <MarkdownRenderer>{item.full_text}</MarkdownRenderer>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </article>
      </main>

      {session && item && <ChatPanel contentId={item.id} session={session} />}
      <EditAIPromptsModal isOpen={isEditPromptModalOpen} onClose={() => setIsEditPromptModalOpen(false)} />
    </div>
  )
}

export default withAuth(ItemDetailPageContent)
