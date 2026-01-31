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

  return <ArticlePageClient article={article} relatedArticles={related} />
}
