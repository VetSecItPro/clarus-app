"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  GitCompareArrows,
  ArrowLeft,
  Loader2,
  Plus,
} from "lucide-react"
import withAuth, { type WithAuthInjectedProps } from "@/components/with-auth"
import SiteHeader from "@/components/site-header"
import MobileBottomNav from "@/components/mobile-bottom-nav"
import { CompareSelector } from "@/components/compare/compare-selector"
import { CompareResults } from "@/components/compare/compare-results"

interface ComparisonSource {
  id: string
  title: string | null
  url: string
  type: string | null
}

interface ComparisonResult {
  agreements: Array<{ topic: string; detail: string }>
  disagreements: Array<{
    topic: string
    sources: Array<{ title: string; position: string }>
  }>
  unique_insights: Array<{ source_title: string; insights: string[] }>
  reliability_assessment: string
  key_takeaways: string[]
  generated_at: string
}

interface CompareState {
  comparison: ComparisonResult | null
  sources: ComparisonSource[]
}

type ComparePageProps = WithAuthInjectedProps

function ComparePageContent({ session }: ComparePageProps) {
  const router = useRouter()
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const [result, setResult] = useState<CompareState>({
    comparison: null,
    sources: [],
  })

  const handleCompare = useCallback(
    async (contentIds: string[]) => {
      setIsComparing(true)
      try {
        const response = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentIds }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error ?? "Comparison failed")
        }

        if (!data.success) {
          throw new Error(data.error ?? "Comparison failed")
        }

        setResult({
          comparison: data.comparison,
          sources: data.sources,
        })
        setSelectorOpen(false)
        toast.success("Comparison complete")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong"
        toast.error(message)
      } finally {
        setIsComparing(false)
      }
    },
    []
  )

  const handleNewComparison = () => {
    setResult({ comparison: null, sources: [] })
    setSelectorOpen(true)
  }

  const userId = session?.user?.id

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-3xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-16 sm:pb-8 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/library")}
              className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-white/50 hover:text-white"
              aria-label="Back to library"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2">
                <GitCompareArrows className="w-6 h-6 text-brand" />
                Compare
              </h1>
              <p className="text-white/50 text-xs sm:text-sm">
                Side-by-side content analysis
              </p>
            </div>
          </div>

          {result.comparison && (
            <button
              onClick={handleNewComparison}
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/[0.08] rounded-full text-sm text-white/70 hover:text-white hover:bg-white/[0.1] transition-all"
            >
              <Plus className="w-4 h-4" />
              New Comparison
            </button>
          )}
        </div>

        {/* Content */}
        {isComparing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-white text-lg font-medium mb-1">
                Analyzing sources...
              </h3>
              <p className="text-white/50 text-sm max-w-xs">
                The AI is comparing your content and identifying patterns.
                This usually takes 15-30 seconds.
              </p>
            </div>
          </motion.div>
        ) : result.comparison ? (
          <CompareResults
            comparison={result.comparison}
            sources={result.sources}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-brand/20 to-violet-500/20 rounded-full flex items-center justify-center mb-6">
              <GitCompareArrows className="w-10 h-10 text-brand" />
            </div>
            <h3 className="text-white text-lg font-medium mb-2 text-center">
              Compare your sources
            </h3>
            <p className="text-white/50 text-sm mb-6 max-w-sm text-center">
              Select 2-3 pieces of analyzed content and get an AI-powered
              comparison showing agreements, disagreements, and unique insights.
            </p>
            <button
              onClick={() => setSelectorOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand-hover text-white rounded-full transition-colors text-sm font-medium"
            >
              <GitCompareArrows className="w-4 h-4" />
              Select Content to Compare
            </button>
          </motion.div>
        )}
      </main>

      {/* Selector dialog */}
      {userId && (
        <CompareSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          userId={userId}
          onCompare={handleCompare}
          isComparing={isComparing}
        />
      )}

      <MobileBottomNav />
    </div>
  )
}

export default withAuth(ComparePageContent)
