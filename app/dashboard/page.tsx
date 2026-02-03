// LEGACY: This dashboard page is orphaned — it is not linked from the main app navigation.
// It only cross-references /add-content (also orphaned). Scheduled for removal (FIX-313).
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ListChecks, PlusCircle, AlertTriangle } from "lucide-react"

// PERF: FIX-205 — local type matching the partial select (only columns we display)
interface DashboardContentItem {
  id: string
  title: string | null
  url: string
  type: string | null
  thumbnail_url: string | null
  date_added: string | null
  is_bookmarked: boolean | null
}

// This component assumes it's rendered within an authenticated context
// (e.g., wrapped by a withAuth HOC or similar protection)

export default function DashboardPage() {
  const [contentItems, setContentItems] = useState<DashboardContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        // This case should ideally be handled by a route guard or HOC
        setError("User not authenticated. Please log in.")
        setLoading(false)
        return
      }

      // PERF: FIX-205 — select only needed columns and limit results
      const { data, error: fetchError } = await supabase
        .from("content")
        .select("id, title, url, type, thumbnail_url, date_added, is_bookmarked")
        .order("date_added", { ascending: false })
        .limit(20)

      if (fetchError) {
        console.error("Error fetching content:", fetchError)
        setError(
          `Failed to load content: ${fetchError.message}. Ensure RLS policies are correctly set for the 'content' table.`,
        )
      } else {
        setContentItems(data || [])
      }
      setLoading(false)
    }

    fetchContent()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <ListChecks className="h-8 w-8 animate-spin text-gray-500" />
        <p className="ml-2">Loading your content...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Saved Content</h1>
        <Button asChild>
          <Link href="/add-content">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Content
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {contentItems.length === 0 && !error && (
        <div className="text-center py-10">
          <ListChecks className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No content yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding some content.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contentItems.map((item) => (
          <ContentItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

function ContentItem({ item }: { item: DashboardContentItem }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate" title={item.title ?? undefined}>
          {item.title ?? "Untitled"}
        </CardTitle>
        <CardDescription>
          {item.type ?? "Content"} - Added {item.date_added ? new Date(item.date_added).toLocaleDateString() : "Unknown"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {item.url && (
          <a
            href={item.url.startsWith("http") ? item.url : `//${item.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline truncate block"
            title={item.url}
          >
            {item.url}
          </a>
        )}
      </CardContent>
      {/* Add more actions or details in CardFooter if needed */}
    </Card>
  )
}
