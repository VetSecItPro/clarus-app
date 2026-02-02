import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getArticleBySlug, getAllSlugs, getRelatedArticles } from "@/lib/data/blog-articles"
import { ArticlePageClient } from "./ArticlePageClient"

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    return { title: "Article Not Found | Clarus" }
  }

  return {
    title: `${article.title} | Clarus`,
    description: article.description,
    keywords: article.keywords,
    openGraph: {
      title: `${article.title} | Clarus`,
      description: article.description,
      url: `https://clarusapp.io/articles/${article.slug}`,
      type: "article",
      publishedTime: article.publishedAt,
      authors: [article.author],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
    alternates: {
      canonical: `https://clarusapp.io/articles/${article.slug}`,
    },
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const related = getRelatedArticles(slug, 3)

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: article.title,
        description: article.description,
        author: { "@type": "Person", name: article.author },
        publisher: {
          "@type": "Organization",
          name: "Clarus",
          url: "https://clarusapp.io",
        },
        datePublished: article.publishedAt,
        url: `https://clarusapp.io/articles/${article.slug}`,
        keywords: article.keywords.join(", "),
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `https://clarusapp.io/articles/${article.slug}`,
        },
      },
      ...(article.faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: article.faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            },
          ]
        : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticlePageClient article={article} relatedArticles={related} />
    </>
  )
}
