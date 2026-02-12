"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { TablesInsert, UserTier } from "@/types/database.types"
import { TIER_LIMITS } from "@/lib/tier-limits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react"

// This component assumes it's rendered within an authenticated context

const CONTENT_TYPES = ["Article", "Video", "Podcast", "Link", "Other"]

export default function AddContentPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [type, setType] = useState("")
  const [fullText, setFullText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const isAtLibraryLimit = libraryCount !== null && libraryLimit !== null && libraryCount >= libraryLimit

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

    // Re-check library limit server-side
    const { count: currentCount } = await supabase
      .from("content")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (libraryLimit !== null && (currentCount ?? 0) >= libraryLimit) {
      setError(`Library limit reached (${libraryLimit} items). Upgrade your plan for more storage.`)
      setIsLoading(false)
      return
    }

    const newContent: TablesInsert<"content"> = {
      title,
      url,
      type,
      full_text: fullText || null,
      user_id: user.id,
    }

    const { error: insertError } = await supabase.from("content").insert(newContent)

    setIsLoading(false)
    if (insertError) {
      console.error("Error adding content:", insertError)
      setError(`Failed to add content: ${insertError.message}. Check RLS policies and table constraints.`)
    } else {
      setSuccess("Content added successfully! Redirecting to dashboard...")
      setTitle("")
      setUrl("")
      setType("")
      setFullText("")
      setTimeout(() => router.push("/dashboard"), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <main id="main-content" className="mx-auto max-w-lg px-4 py-8 pb-24 sm:pb-8">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">Add New Content</h1>
            <p className="text-sm text-white/50 mt-1">Save an article, video, or podcast for analysis.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-white/70">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g., The Future of AI in Healthcare"
              />
            </div>
            <div>
              <Label htmlFor="url" className="text-white/70">URL</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="e.g., https://youtube.com/watch?v=..."
              />
            </div>
            <div>
              <Label htmlFor="type" className="text-white/70">Type</Label>
              <Select onValueChange={setType} value={type} required>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((contentType) => (
                    <SelectItem key={contentType} value={contentType}>
                      {contentType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fullText" className="text-white/70">Full Text (Optional)</Label>
              <textarea
                id="fullText"
                value={fullText}
                onChange={(e) => setFullText(e.target.value)}
                rows={4}
                className="mt-1 block w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-transparent text-sm"
                placeholder="Paste full text here if the URL isn't scrapable..."
              />
            </div>
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
            <Button type="submit" disabled={isLoading || isAtLibraryLimit} className="w-full">
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
    </div>
  )
}
