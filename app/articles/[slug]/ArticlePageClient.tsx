"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Share2, Check, ChevronDown, ChevronUp } from "lucide-react"
import type { BlogArticle } from "@/lib/data/blog-articles"
import { categoryConfig } from "@/lib/utils/article-helpers"

interface ArticlePageClientProps {
  article: BlogArticle
  relatedArticles: BlogArticle[]
}

export function ArticlePageClient({
  article,
  relatedArticles,
}: ArticlePageClientProps) {
  const [copied, setCopied] = useState(false)
  const config = categoryConfig[article.category]
  const Icon = config.icon

  function handleShare() {
    const url = `https://clarusapp.io/articles/${article.slug}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const publishedDate = new Date(article.publishedAt).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  )

  return (
    <main className="max-w-3xl mx-auto px-4 lg:px-6 py-12">
      {/* Back link */}
      <Link
        href="/articles"
        className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-8"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Articles
      </Link>

      {/* Article header */}
      <header className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className={`inline-flex p-1.5 rounded-lg ${config.bg}`}>
            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
          </div>
          <span className="text-xs text-white/40">{config.label}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-tight">
          {article.title}
        </h1>

        <p className="text-white/50 text-base leading-relaxed mb-6">
          {article.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-white/30">
            <span>{article.author}</span>
            <span>&middot;</span>
            <span>{publishedDate}</span>
            <span>&middot;</span>
            <span>{article.readingTime}</span>
          </div>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-white/40 hover:text-white/70 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                Copied
              </>
            ) : (
              <>
                <Share2 className="w-3 h-3" />
                Share
              </>
            )}
          </button>
        </div>
      </header>

      {/* Divider */}
      <div className="border-t border-white/[0.06] mb-10" />

      {/* Article content */}
      <article
        className="article-content"
        dangerouslySetInnerHTML={{ __html: article.htmlContent }}
      />

      {/* FAQs */}
      {article.faqs.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-semibold text-white mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {article.faqs.map((faq, i) => (
              <FaqItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </section>
      )}

      {/* Inline CTA */}
      <section className="mt-14">
        <div className="rounded-xl border border-[#1d9bf0]/20 bg-[#1d9bf0]/5 p-8 text-center">
          <h2 className="text-lg font-semibold text-white mb-2">
            See What AI Content Analysis Can Do
          </h2>
          <p className="text-sm text-white/50 mb-5 max-w-md mx-auto">
            Paste any URL and get claims, evidence, bias detection, and quality
            scoring in seconds. Free to start.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-medium rounded-full transition-colors"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <section className="mt-16">
          <h2 className="text-lg font-semibold text-white mb-6">
            Related Articles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedArticles.map((related) => {
              const relConfig = categoryConfig[related.category]
              const RelIcon = relConfig.icon
              return (
                <Link
                  key={related.slug}
                  href={`/articles/${related.slug}`}
                  className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`inline-flex p-1 rounded-md ${relConfig.bg}`}
                    >
                      <RelIcon
                        className={`w-3 h-3 ${relConfig.color}`}
                      />
                    </div>
                    <span className="text-[11px] text-white/30">
                      {relConfig.label}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-white group-hover:text-[#1d9bf0] transition-colors line-clamp-2 mb-1">
                    {related.title}
                  </h3>
                  <span className="text-[11px] text-white/30">
                    {related.readingTime}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="text-sm font-medium text-white/80 pr-4">
          {question}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-white/30 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-sm text-white/50 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}
