"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search, ArrowRight } from "lucide-react"
import type { BlogArticle } from "@/lib/data/blog-articles"
import {
  type ArticleCategory,
  categoryConfig,
  allCategories,
} from "@/lib/utils/article-helpers"

interface ArticlesPageClientProps {
  articles: BlogArticle[]
  featuredArticles: BlogArticle[]
}

export function ArticlesPageClient({
  articles,
  featuredArticles,
}: ArticlesPageClientProps) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<ArticleCategory | null>(null)

  const filtered = useMemo(() => {
    let result = articles
    if (activeCategory) {
      result = result.filter((a) => a.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.keywords.some((k) => k.toLowerCase().includes(q))
      )
    }
    return result
  }, [articles, search, activeCategory])

  const showFeatured = !search.trim() && !activeCategory

  return (
    <main className="max-w-5xl mx-auto px-4 lg:px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Articles
        </h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">
          Insights on content analysis, fact-checking, AI tools, and smarter
          ways to consume information online.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-full text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-brand/40 transition-colors"
        />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2 mb-12">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeCategory === null
              ? "bg-brand text-white"
              : "bg-white/[0.03] text-white/50 hover:text-white/70 border border-white/[0.06]"
          }`}
        >
          All
        </button>
        {allCategories.map((cat) => {
          const config = categoryConfig[cat]
          return (
            <button
              key={cat}
              onClick={() =>
                setActiveCategory(activeCategory === cat ? null : cat)
              }
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-brand text-white"
                  : "bg-white/[0.03] text-white/50 hover:text-white/70 border border-white/[0.06]"
              }`}
            >
              {config.label}
            </button>
          )
        })}
      </div>

      {/* Featured Articles */}
      {showFeatured && featuredArticles.length > 0 && (
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-white mb-6">Featured</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredArticles.map((article) => (
              <FeaturedCard key={article.slug} article={article} />
            ))}
          </div>
        </section>
      )}

      {/* All Articles */}
      <section>
        {showFeatured && (
          <h2 className="text-lg font-semibold text-white mb-6">
            All Articles
          </h2>
        )}
        {filtered.length === 0 ? (
          <p className="text-center text-white/50 py-12">
            No articles found. Try a different search term.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="mt-20">
        <div className="rounded-2xl bg-brand/10 border border-brand/20 p-10 text-center">
          <h2 className="text-xl font-semibold text-white mb-3">
            Ready to analyze content with AI?
          </h2>
          <p className="text-white/50 text-sm mb-6 max-w-lg mx-auto">
            Paste any URL and get structured analysis — claims, evidence, bias
            detection, and quality scoring — in seconds.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand-hover text-white font-medium rounded-full transition-colors"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}

function FeaturedCard({ article }: { article: BlogArticle }) {
  const config = categoryConfig[article.category]
  const Icon = config.icon

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group bg-white/[0.03] border border-brand/20 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-brand/30 transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`inline-flex p-1.5 rounded-lg ${config.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        </div>
        <span className="text-xs text-white/50">{config.label}</span>
      </div>
      <h3 className="text-base font-semibold text-white group-hover:text-brand transition-colors mb-2 line-clamp-2">
        {article.title}
      </h3>
      <p className="text-sm text-white/50 leading-relaxed line-clamp-3 mb-3">
        {article.description}
      </p>
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>{article.readingTime}</span>
        <span>{formatDate(article.publishedAt)}</span>
      </div>
    </Link>
  )
}

function ArticleCard({ article }: { article: BlogArticle }) {
  const config = categoryConfig[article.category]
  const Icon = config.icon

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`inline-flex p-1.5 rounded-lg ${config.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        </div>
        <span className="text-xs text-white/50">{config.label}</span>
      </div>
      <h3 className="text-base font-semibold text-white group-hover:text-brand transition-colors mb-2 line-clamp-2">
        {article.title}
      </h3>
      <p className="text-sm text-white/50 leading-relaxed line-clamp-3 mb-3">
        {article.description}
      </p>
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>{article.readingTime}</span>
        <span>{formatDate(article.publishedAt)}</span>
      </div>
    </Link>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
