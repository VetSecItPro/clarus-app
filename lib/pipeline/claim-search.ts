/**
 * @module lib/pipeline/claim-search
 * @description Targeted claim verification via Tavily web search.
 * Extracts verifiable claims from content and searches for corroborating/contradicting evidence.
 */

import type { VerifiableClaim, WebSearchResult, ClaimSearchContext } from "./web-search"
import { normalizeTavilyQuery, searchTavily, extractVerifiableClaims } from "./web-search"

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const openRouterApiKey = process.env.OPENROUTER_API_KEY
const tavilyApiKey = process.env.TAVILY_API_KEY

// ============================================
// CLAIM CONTEXT FORMATTING
// ============================================

function formatClaimContext(claims: VerifiableClaim[], searches: WebSearchResult[]): string {
  const lines: string[] = [
    "\n\n---",
    "## TARGETED CLAIM VERIFICATION RESULTS",
    "CRITICAL: These search results reflect CURRENT real-time information as of today.",
    "If these web results contradict your training data, ALWAYS trust these web search results over your training data.",
    "Your training data may be outdated. The web results below are fresh and authoritative.",
    ""
  ]

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i]
    const search = searches[i]

    lines.push(`### Claim: "${claim.claim}"`)
    lines.push(`**Search Query:** "${claim.search_query}"`)

    if (search && search.results.length > 0) {
      if (search.answer) {
        lines.push(`**Web Answer:** ${search.answer}`)
      }
      for (const result of search.results) {
        lines.push(`- [${result.title}](${result.url})`)
        if (result.content) {
          lines.push(`  ${result.content.substring(0, 300)}`)
        }
      }
    } else {
      lines.push("_No web results found for this claim._")
    }
    lines.push("")
  }

  lines.push("---")
  lines.push("Use the claim verification results above to check the accuracy of ALL claims in the content.")
  lines.push("If a claim is contradicted by these web results, mark it as inaccurate and cite the web source.")
  lines.push("")

  return lines.join("\n")
}

// ============================================
// CLAIM SEARCH CONTEXT
// ============================================

export async function getClaimSearchContext(text: string, tavilyCache: Map<string, WebSearchResult>): Promise<ClaimSearchContext | null> {
  if (!tavilyApiKey || !openRouterApiKey) return null

  // S1-05: Dynamic claim count based on content length
  const maxClaims = text.length < 500 ? 0 :       // tweets: skip entirely
                    text.length < 2000 ? 2 :       // short articles
                    text.length < 8000 ? 3 :       // medium articles
                    5                               // long content
  if (maxClaims === 0) return null

  const claims = await extractVerifiableClaims(text, maxClaims)
  if (claims.length === 0) return null

  // Count cache hits BEFORE searching (accurate hit count)
  let cacheHits = 0
  for (const c of claims) {
    if (tavilyCache.has(normalizeTavilyQuery(c.search_query))) cacheHits++
  }

  const searchPromises = claims.map(c => searchTavily(c.search_query, tavilyCache))
  const results = await Promise.all(searchPromises)

  const validSearches: WebSearchResult[] = []
  const matchedClaims: VerifiableClaim[] = []

  for (let i = 0; i < claims.length; i++) {
    const search = results[i]
    if (search) {
      validSearches.push(search)
      matchedClaims.push(claims[i])
    }
  }

  if (validSearches.length === 0) return null

  const formattedContext = formatClaimContext(matchedClaims, validSearches)

  return {
    claims: matchedClaims,
    searches: validSearches,
    formattedContext,
    apiCallCount: claims.length - cacheHits,
    cacheHits,
  }
}
