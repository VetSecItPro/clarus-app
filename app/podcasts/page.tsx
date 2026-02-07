import { redirect } from "next/navigation"

/**
 * Legacy /podcasts route — redirects to unified /feeds page.
 * Preserves bookmarks and external links.
 */
export default function PodcastsRedirect() {
  redirect("/feeds?tab=podcasts")
}
