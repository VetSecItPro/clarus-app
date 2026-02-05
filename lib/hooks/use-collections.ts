/**
 * @module hooks/use-collections
 * @description Client-side hook for fetching and managing collections.
 *
 * Uses SWR for cached data fetching with optimistic updates for
 * add/remove operations.
 */

import useSWR from "swr"
import { useCallback, useMemo } from "react"

/** Shape of a collection returned by the API */
export interface Collection {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  is_default: boolean
  item_count: number
  created_at: string
  updated_at: string
}

/** Shape of a collection item returned by the API */
export interface CollectionItem {
  id: string
  collection_id: string
  content_id: string
  added_at: string
  sort_order: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(data.error || "Request failed")
  }
  const data = await res.json()
  return data.collections as Collection[]
}

/**
 * Hook for managing user collections.
 *
 * @returns Collections data, loading state, and CRUD operations
 */
export function useCollections() {
  const { data: collections, error, isLoading, mutate } = useSWR(
    "/api/collections",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const createCollection = useCallback(
    async (data: {
      name: string
      description?: string | null
      color?: string | null
      icon?: string | null
    }): Promise<Collection> => {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || "Failed to create collection")
      }

      // Revalidate the collections list
      await mutate()
      return result.collection as Collection
    },
    [mutate]
  )

  const updateCollection = useCallback(
    async (
      collectionId: string,
      data: {
        name?: string
        description?: string | null
        color?: string | null
        icon?: string | null
      }
    ): Promise<Collection> => {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || "Failed to update collection")
      }

      await mutate()
      return result.collection as Collection
    },
    [mutate]
  )

  const deleteCollection = useCallback(
    async (collectionId: string): Promise<void> => {
      // Optimistic update
      const previousCollections = collections
      await mutate(
        collections?.filter((c) => c.id !== collectionId),
        false
      )

      try {
        const res = await fetch(`/api/collections/${collectionId}`, {
          method: "DELETE",
        })

        if (!res.ok) {
          const result = await res.json()
          throw new Error(result.error || "Failed to delete collection")
        }

        await mutate()
      } catch (err) {
        // Rollback on error
        await mutate(previousCollections, false)
        throw err
      }
    },
    [collections, mutate]
  )

  const addItemToCollection = useCallback(
    async (collectionId: string, contentId: string): Promise<CollectionItem> => {
      // Optimistic update: increment item_count
      const previousCollections = collections
      await mutate(
        collections?.map((c) =>
          c.id === collectionId ? { ...c, item_count: c.item_count + 1 } : c
        ),
        false
      )

      try {
        const res = await fetch(`/api/collections/${collectionId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content_id: contentId }),
        })

        const result = await res.json()
        if (!res.ok) {
          throw new Error(result.error || "Failed to add item to collection")
        }

        await mutate()
        return result.item as CollectionItem
      } catch (err) {
        // Rollback on error
        await mutate(previousCollections, false)
        throw err
      }
    },
    [collections, mutate]
  )

  const removeItemFromCollection = useCallback(
    async (collectionId: string, contentId: string): Promise<void> => {
      // Optimistic update: decrement item_count
      const previousCollections = collections
      await mutate(
        collections?.map((c) =>
          c.id === collectionId
            ? { ...c, item_count: Math.max(0, c.item_count - 1) }
            : c
        ),
        false
      )

      try {
        const res = await fetch(
          `/api/collections/${collectionId}/items/${contentId}`,
          { method: "DELETE" }
        )

        if (!res.ok) {
          const result = await res.json()
          throw new Error(result.error || "Failed to remove item from collection")
        }

        await mutate()
      } catch (err) {
        // Rollback on error
        await mutate(previousCollections, false)
        throw err
      }
    },
    [collections, mutate]
  )

  return {
    collections: collections ?? [],
    isLoading,
    error,
    refresh: mutate,
    createCollection,
    updateCollection,
    deleteCollection,
    addItemToCollection,
    removeItemFromCollection,
  }
}

/**
 * Hook to fetch the content IDs that belong to a specific collection.
 * Used for client-side filtering and for showing which collections
 * a content item belongs to.
 */
export function useCollectionItems(collectionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<string[]>(
    collectionId ? `/api/collections/${collectionId}/content-ids` : null,
    async () => {
      // Fetch collection items directly from Supabase on the client
      // since we don't have a dedicated API endpoint for content IDs
      const { supabase } = await import("@/lib/supabase")
      const { data: items, error: fetchError } = await supabase
        .from("collection_items")
        .select("content_id")
        .eq("collection_id", collectionId!)
        .limit(5000)

      if (fetchError) throw fetchError
      return (items ?? []).map((item: { content_id: string }) => item.content_id)
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  return {
    contentIds: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  }
}

/**
 * Hook to fetch which collections a specific content item belongs to.
 * Used by AddToCollectionButton to show check marks.
 */
export function useContentCollections(contentId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<string[]>(
    contentId ? `content-collections:${contentId}` : null,
    async () => {
      if (!contentId) return []
      const { supabase } = await import("@/lib/supabase")
      const { data: items, error: fetchError } = await supabase
        .from("collection_items")
        .select("collection_id")
        .eq("content_id", contentId)
        .limit(200)

      if (fetchError) throw fetchError
      return (items ?? []).map(
        (item: { collection_id: string }) => item.collection_id
      )
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const collectionIds = useMemo(() => data ?? [], [data])

  return {
    collectionIds,
    isLoading,
    error,
    refresh: mutate,
  }
}
