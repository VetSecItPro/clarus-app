"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownRendererProps {
  children: string | null | undefined
  className?: string
}

const MARKDOWN_CLASSES = `
prose prose-sm sm:prose-base max-w-none leading-relaxed
text-gray-300
[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-gray-100
[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-gray-100
[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-gray-100
[&_p]:text-gray-300 [&_p]:mb-4
[&_strong]:text-gray-100
[&_a]:text-blue-400 hover:[&_a]:underline
[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1
[&_ul_ul]:list-['◦'] [&_ul_ul]:pl-5 [&_ul_ul]:my-2 [&_ul_ul]:space-y-1
[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1
[&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-5 [&_ol_ol]:my-2 [&_ol_ol]:space-y-1
[&_li]:text-gray-300
[&_li_p]:mb-1
[&_li::marker]:text-gray-500
[&_hr]:my-8 [&_hr]:border-gray-700
`

/**
 * Preprocesses text to convert inline bullet points to proper markdown lists.
 * Handles patterns like "• Item 1 • Item 2" or "- Item 1 - Item 2" on same line.
 */
function preprocessMarkdown(text: string): string {
  // Split by lines first
  const lines = text.split('\n')
  const processedLines: string[] = []

  for (const line of lines) {
    // Check if line has multiple inline bullets (• or -)
    // Pattern: starts with bullet or has " • " or " - " mid-line
    const inlineBulletPattern = /(?:^[•\-]\s+|\s+[•\-]\s+)/

    if (inlineBulletPattern.test(line) && (line.match(/[•\-]/g) || []).length > 1) {
      // Split by bullet characters and filter empty strings
      const items = line
        .split(/\s*[•\-]\s+/)
        .map(item => item.trim())
        .filter(item => item.length > 0)

      // Convert to proper markdown list
      for (const item of items) {
        processedLines.push(`- ${item}`)
      }
    } else {
      processedLines.push(line)
    }
  }

  return processedLines.join('\n')
}

export function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  if (!children) return null

  const processedContent = preprocessMarkdown(children)

  return (
    <div className={cn(MARKDOWN_CLASSES, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{processedContent}</ReactMarkdown>
    </div>
  )
}
