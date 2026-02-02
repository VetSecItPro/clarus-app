import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Database, TriageData, TruthCheckData, ActionItemsData } from "@/types/database.types"
import { SharePageContent } from "./share-page-content"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ token: string }>
}

function getAdminClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "clarus" } }
  )
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params

  // Validate token format (10-16 alphanumeric chars)
  if (!/^[a-zA-Z0-9]{10,16}$/.test(token)) {
    notFound()
  }

  const supabase = getAdminClient()

  // Look up content by share token
  const { data: content, error: contentError } = await supabase
    .from("content")
    .select("id, title, url, type, author, duration, thumbnail_url, date_added")
    .eq("share_token", token)
    .single()

  if (contentError || !content) {
    notFound()
  }

  // Fetch the latest summary
  const { data: summary } = await supabase
    .from("summaries")
    .select("brief_overview, triage, truth_check, action_items, mid_length_summary, detailed_summary, processing_status")
    .eq("content_id", content.id)
    .eq("language", "en")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <SharePageContent
      content={{
        title: content.title,
        url: content.url,
        type: content.type,
        author: content.author,
        duration: content.duration,
        thumbnailUrl: content.thumbnail_url,
        dateAdded: content.date_added,
      }}
      summary={summary ? {
        briefOverview: summary.brief_overview,
        triage: summary.triage as unknown as TriageData | null,
        truthCheck: summary.truth_check as unknown as TruthCheckData | null,
        actionItems: summary.action_items as unknown as ActionItemsData | null,
        midLengthSummary: summary.mid_length_summary,
        detailedSummary: summary.detailed_summary,
        processingStatus: summary.processing_status,
      } : null}
    />
  )
}

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params

  if (!/^[a-zA-Z0-9]{10,16}$/.test(token)) {
    return { title: "Not Found" }
  }

  const supabase = getAdminClient()
  const { data: content } = await supabase
    .from("content")
    .select("title")
    .eq("share_token", token)
    .single()

  return {
    title: content?.title ? `${content.title} - Clarus Analysis` : "Shared Analysis - Clarus",
    description: "AI-powered content analysis shared via Clarus",
  }
}
