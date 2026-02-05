/**
 * @module use-media-query
 * @description Responsive breakpoint hooks using the `matchMedia` API.
 *
 * Provides reactive access to CSS media queries in React components.
 * The hook subscribes to the browser's `change` event so the return
 * value updates instantly when the viewport crosses a breakpoint
 * (e.g., resizing from mobile to desktop).
 *
 * @see {@link useIsDesktop} for the most commonly used preset
 */

"use client"

import { useState, useEffect } from "react"

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 *
 * @param query - A CSS media query string (e.g., `"(min-width: 1024px)"`)
 * @returns `true` if the viewport matches the query, `false` otherwise
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery("(max-width: 768px)")
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }
    const listener = () => setMatches(media.matches)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [matches, query])

  return matches
}

/**
 * Returns `true` when the viewport is at least 1024px wide (Tailwind `lg` breakpoint).
 * Convenience wrapper around {@link useMediaQuery} for the most common responsive check.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)")
}
