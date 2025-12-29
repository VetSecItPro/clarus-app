"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownRendererProps {
  children: string | null | undefined
  className?: string
}

const MARKDOWN_CLASSES = `
prose prose-sm sm:prose-base max-w-none leading-relaxed overflow-hidden break-words
text-gray-300
[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-gray-100
[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-gray-100 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-white/10
[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-gray-100
[&_p]:text-gray-300 [&_p]:mb-3 [&_p]:leading-relaxed [&_p]:break-words
[&_strong]:text-gray-100 [&_strong]:font-semibold
[&_a]:text-blue-400 hover:[&_a]:underline [&_a]:break-all
[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1
[&_ul_ul]:list-['◦'] [&_ul_ul]:pl-5 [&_ul_ul]:my-2 [&_ul_ul]:space-y-1
[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1
[&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-5 [&_ol_ol]:my-2 [&_ol_ol]:space-y-1
[&_li]:text-gray-300
[&_li_p]:mb-1
[&_li::marker]:text-gray-500
[&_hr]:my-8 [&_hr]:border-gray-700
[&_blockquote]:border-l-4 [&_blockquote]:border-[#1d9bf0]/50 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:my-4 [&_blockquote]:bg-white/[0.03] [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_blockquote]:text-gray-400
[&_blockquote_p]:mb-0
[&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:text-[#1d9bf0] [&_code]:break-all
[&_pre]:overflow-x-auto [&_pre]:max-w-full
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
