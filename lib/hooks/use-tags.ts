import useSWR from "swr"

interface TagCount {
  tag: string
  count: number
}

const fetcher = async (url: string): Promise<TagCount[]> => {
  const res = await fetch(url)
  const data = await res.json()
  return data.success ? data.tags : []
}

/**
 * SWR hook for fetching user's tag list with automatic deduplication.
 * Replaces bare fetch() + useState pattern — SWR deduplicates across
 * components within the 30s dedup window configured in SWRProvider.
 */
export function useTags() {
  const { data: allTags = [], mutate } = useSWR<TagCount[]>("/api/tags", fetcher)
  return { allTags, refreshTags: mutate }
}
