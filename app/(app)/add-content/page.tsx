"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { TablesInsert, UserTier } from "@/types/database.types"
import { TIER_LIMITS } from "@/lib/tier-limits"
import { validateUrl } from "@/lib/validation"
import { getYouTubeVideoId, isXUrl, isPodcastUrl, getDomainFromUrl } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Youtube,
  FileText,
  Twitter,
  Headphones,
  Globe,
  Link2,
} from "lucide-react"

type ContentType = "youtube" | "article" | "x_post" | "podcast"

function detectContentType(url: string): ContentType {
  if (getYouTubeVideoId(url)) return "youtube"
  if (isXUrl(url)) return "x_post"
  if (isPodcastUrl(url)) return "podcast"
  return "article"
}

function getTypeIcon(type: ContentType) {
  switch (type) {
    case "youtube": return <Youtube className="w-4 h-4 text-red-400" />
    case "x_post": return <Twitter className="w-4 h-4 text-white/70" />
    case "podcast": return <Headphones className="w-4 h-4 text-purple-400" />
    default: return <FileText className="w-4 h-4 text-brand" />
  }
}

function getTypeLabel(type: ContentType) {
  switch (type) {
    case "youtube": return "YouTube Video"
    case "x_post": return "X Post"
    case "podcast": return "Podcast"
    default: return "Article"
  }
}


export default function AddContentPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [detectedType, setDetectedType] = useState<ContentType | null>(null)
  const [domain, setDomain] = useState<string | null>(null)
  const [favicon, setFavicon] = useState<string | null>(null)
  const [isFetchingTitle, setIsFetchingTitle] = useState(false)
  const [fullText, setFullText] = useState("")
  const [showFullText, setShowFullText] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [libraryCount, setLibraryCount] = useState<number | null>(null)
  const [libraryLimit, setLibraryLimit] = useState<number | null>(null)

  // Check library size on mount
  useEffect(() => {
    async function checkLibrary() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from("users")
        .select("tier, day_pass_expires_at")
        .eq("id", user.id)
        .single()

      const rawTier = userData?.tier as string | null
      let tier: UserTier = "free"
      if (rawTier === "starter" || rawTier === "pro") tier = rawTier
      else if (rawTier === "day_pass") {
        const expires = userData?.day_pass_expires_at
        tier = (expires && new Date(expires) > new Date()) ? "day_pass" : "free"
      }

      const limit = TIER_LIMITS[tier].library
      setLibraryLimit(limit)

      const { count } = await supabase
        .from("content")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
      setLibraryCount(count ?? 0)
    }
    checkLibrary()
  }, [])

  // Auto-detect URL type and fetch title
  const handleUrlChange = useCallback((value: string) => {
    setUrl(value)
    setError(null)
    setUrlError(null)

    const trimmed = value.trim()
    if (!trimmed) {
      setDetectedType(null)
      setDomain(null)
      setFavicon(null)
      setTitle("")
      return
    }

    const validation = validateUrl(trimmed)
    if (!validation.isValid || !validation.sanitized) {
      const looksLikeUrl = /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(trimmed)
      if (looksLikeUrl) setUrlError(validation.error ?? "Invalid URL")
      setDetectedType(null)
      setDomain(null)
      setFavicon(null)
      return
    }

    const validUrl = validation.sanitized
    const type = detectContentType(validUrl)
    const urlDomain = getDomainFromUrl(validUrl)

    setDetectedType(type)
    setDomain(urlDomain)
    setFavicon(`https://www.google.com/s2/favicons?domain=${urlDomain}&sz=32`)

    // Auto-fetch title
    setIsFetchingTitle(true)
    fetch("/api/fetch-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: validUrl }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.title) setTitle(data.title)
        setIsFetchingTitle(false)
      })
      .catch(() => setIsFetchingTitle(false))
  }, [])

  // Debounce URL detection
  const [debouncedUrl, setDebouncedUrl] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUrl(url), 400)
    return () => clearTimeout(timer)
  }, [url])

  useEffect(() => {
    if (debouncedUrl) handleUrlChange(debouncedUrl)
  }, [debouncedUrl, handleUrlChange])

  const isAtLibraryLimit = libraryCount !== null && libraryLimit !== null && libraryCount >= libraryLimit
  const isValidUrl = detectedType !== null && !urlError

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("User not authenticated. Please log in.")
      setIsLoading(false)
      return
    }

    // Re-check library limit
    const { count: currentCount } = await supabase
      .from("content")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (libraryLimit !== null && (currentCount ?? 0) >= libraryLimit) {
      setError(`Library limit reached (${libraryLimit} items). Upgrade your plan for more storage.`)
      setIsLoading(false)
      return
    }

    const validation = validateUrl(url.trim())
    if (!validation.isValid || !validation.sanitized) {
      setError("Please enter a valid URL.")
      setIsLoading(false)
      return
    }

    const type = detectedType || "article"

    const newContent: TablesInsert<"content"> = {
      title: title || url.trim(),
      url: validation.sanitized,
      type,
      full_text: fullText || null,
      user_id: user.id,
    }

    const { data: insertData, error: insertError } = await supabase
      .from("content")
      .insert(newContent)
      .select("id")
      .single()

    if (insertError) {
      setError(`Failed to add content. Please try again.`)
      setIsLoading(false)
      return
    }

    // Trigger analysis
    try {
      await fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: insertData.id }),
      })
    } catch {
      // Non-fatal — content was created, analysis can be retried
    }

    setSuccess("Analysis started! Redirecting...")
    setTimeout(() => router.push(`/item/${insertData.id}`), 1500)
  }

  return (
    <div className="min-h-screen bg-black">
      <main id="main-content" className="mx-auto max-w-lg px-4 py-8 pb-24 sm:pb-8">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">Add Content</h1>
            <p className="text-sm text-white/50 mt-1">Paste a URL and we&apos;ll handle the rest.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL field — primary input */}
            <div>
              <Label htmlFor="url" className="text-white/70">URL</Label>
              <div className="relative mt-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  placeholder="Paste any URL — YouTube, article, podcast..."
                  autoFocus
                  className="w-full h-10 pl-10 pr-4 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
                />
              </div>
              {urlError && (
                <p className="text-xs text-red-400 mt-1.5">{urlError}</p>
              )}
            </div>

            {/* URL preview card — shows when URL is valid */}
            {isValidUrl && detectedType && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-[fadeIn_0.2s_ease-out]">
                {favicon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={favicon} alt="" className="w-5 h-5 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  {isFetchingTitle ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-white/40" />
                      <span className="text-xs text-white/40">Fetching title...</span>
                    </div>
                  ) : title ? (
                    <p className="text-sm text-white truncate">{title}</p>
                  ) : (
                    <p className="text-sm text-white/50 truncate">{domain}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/40 flex-shrink-0">
                  {getTypeIcon(detectedType)}
                  <span>{getTypeLabel(detectedType)}</span>
                </div>
              </div>
            )}

            {/* Title override — editable, auto-filled */}
            {isValidUrl && (
              <div>
                <Label htmlFor="title" className="text-white/70">
                  Title
                  <span className="text-white/30 ml-1 font-normal">(auto-detected)</span>
                </Label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Page title will auto-fill..."
                  className="mt-1 w-full h-10 px-3 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
                />
              </div>
            )}

            {/* Optional full text toggle */}
            {isValidUrl && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowFullText(!showFullText)}
                  className="text-xs text-white/40 hover:text-white/60 transition-colors flex items-center gap-1"
                >
                  <Globe className="w-3 h-3" />
                  {showFullText ? "Hide full text field" : "Can't scrape the URL? Paste full text instead"}
                </button>
                {showFullText && (
                  <textarea
                    value={fullText}
                    onChange={(e) => setFullText(e.target.value)}
                    rows={4}
                    className="mt-2 block w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-transparent text-sm"
                    placeholder="Paste the full article text here..."
                  />
                )}
              </div>
            )}

            {isAtLibraryLimit && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Library Full</AlertTitle>
                <AlertDescription>
                  You&apos;ve reached your library limit of {libraryLimit} items. Upgrade your plan to add more content.
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}
            <Button type="submit" disabled={isLoading || isAtLibraryLimit || !isValidUrl} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Content"
              )}
            </Button>
          </form>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
