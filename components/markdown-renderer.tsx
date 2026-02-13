"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownRendererProps {
  children: string | null | undefined
  className?: string
  onTimestampClick?: (seconds: number) => void
}

/**
 * Converts a timestamp string like "1:30" or "1:30:45" to seconds
 */
function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

/**
 * Converts timestamps in text to clickable markdown links
 * Handles both [0:00] format and plain 0:00 format
 * Uses #t=seconds format to prevent page navigation
 */
function convertTimestampsToLinks(text: string): string {
  // First, handle timestamps with brackets: [0:00] -> [0:00](#t=0)
  let result = text.replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, (match, timestamp) => {
    const seconds = timestampToSeconds(timestamp)
    return `[${timestamp}](#t=${seconds})`
  })

  // Then, handle plain timestamps at word boundaries (not already converted)
  // Match patterns like "0:00" or "1:30:45" that aren't already part of a link
  // Use negative lookbehind for [ and negative lookahead for ]( to avoid double-converting
  result = result.replace(/(?<!\[)(\b\d{1,2}:\d{2}(?::\d{2})?\b)(?!\]\()/g, (match, timestamp) => {
    const seconds = timestampToSeconds(timestamp)
    return `[${timestamp}](#t=${seconds})`
  })

  return result
}

const MARKDOWN_CLASSES = `
prose prose-sm sm:prose-base max-w-none overflow-hidden break-words

/* Base text styling - clean, readable */
text-[15px] text-gray-300 leading-[1.7]

/* Headers - Professional hierarchy */
[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-4 [&_h1]:text-white [&_h1]:tracking-tight

/* H2 - Section headers with timestamps like [0:00] - [1:50]: Title */
[&_h2]:text-sm [&_h2]:font-medium [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-brand [&_h2]:pt-4 [&_h2]:border-t [&_h2]:border-white/10

/* H3 - Subheadings */
[&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-white/90

/* H4 - Minor headings */
[&_h4]:text-sm [&_h4]:font-medium [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-white/70 [&_h4]:normal-case [&_h4]:tracking-normal

/* Paragraphs - Comfortable reading */
[&_p]:text-gray-300 [&_p]:mb-3 [&_p]:leading-[1.7] [&_p]:break-words

/* Emphasis */
[&_strong]:text-white [&_strong]:font-semibold
[&_em]:text-gray-200 [&_em]:italic

/* Links */
[&_a]:text-brand hover:[&_a]:text-brand-hover hover:[&_a]:underline [&_a]:break-all [&_a]:transition-colors

/* Lists - Clean and compact */
[&_ul]:list-none [&_ul]:pl-0 [&_ul]:mb-3 [&_ul]:space-y-1
[&_ul>li]:relative [&_ul>li]:pl-4 [&_ul>li]:text-sm
[&_ul>li]:before:content-['•'] [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:text-white/50
[&_ul_ul]:pl-3 [&_ul_ul]:mt-1 [&_ul_ul]:mb-0 [&_ul_ul]:space-y-1
[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1
[&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-4 [&_ol_ol]:mt-1 [&_ol_ol]:space-y-1
[&_li]:text-gray-300 [&_li]:leading-[1.6]
[&_li_p]:mb-1
[&_li::marker]:text-white/50 [&_li::marker]:font-medium

/* Section dividers - Subtle */
[&_hr]:my-5 [&_hr]:border-0 [&_hr]:h-px [&_hr]:bg-white/10

/* Blockquotes */
[&_blockquote]:border-l-2 [&_blockquote]:border-brand/50 [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:my-4 [&_blockquote]:text-gray-200
[&_blockquote_p]:mb-0 [&_blockquote_p]:leading-[1.6]

/* Code */
[&_code]:bg-white/[0.08] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:text-brand [&_code]:break-all [&_code]:font-mono
[&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:bg-white/[0.03] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-4

/* First paragraph */
[&>p:first-child]:text-white/90 [&>p:first-child]:text-[15px] [&>p:first-child]:leading-[1.7]
`

/**
 * Preprocesses text to improve markdown formatting.
 * - Cleans up excessive horizontal rules
 * - Handles inline bullet points (but NOT headers or regular text with dashes)
 */
function preprocessMarkdown(text: string): string {
  const lines = text.split('\n')
  const processedLines: string[] = []
  let lastWasHr = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Skip consecutive horizontal rules
    if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
      if (lastWasHr) continue // Skip duplicate HRs
      lastWasHr = true
      processedLines.push('---')
      continue
    }
    lastWasHr = false

    // Don't process lines that are headers (start with #)
    if (trimmedLine.startsWith('#')) {
      processedLines.push(line)
      continue
    }

    // Don't process lines that contain timestamps with ranges like [0:00] - [1:50]
    if (/\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(trimmedLine)) {
      processedLines.push(line)
      continue
    }

    // Handle inline bullet points ONLY for lines that start with bullet and have multiple bullets
    // Pattern: line starts with "• " or "- " and has more bullets mid-line
    const startsWithBullet = /^[•]\s+/.test(trimmedLine)
    const hasMidlineBullets = /\s+[•]\s+/.test(trimmedLine)

    if (startsWithBullet && hasMidlineBullets) {
      const items = trimmedLine
        .split(/\s*[•]\s+/)
        .map(item => item.trim())
        .filter(item => item.length > 0)
      for (const item of items) {
        processedLines.push(`- ${item}`)
      }
    } else {
      processedLines.push(line)
    }
  }

  return processedLines.join('\n')
}

export function MarkdownRenderer({ children, className, onTimestampClick }: MarkdownRendererProps) {
  if (!children) return null

  // First preprocess, then convert timestamps to links
  let processedContent = preprocessMarkdown(children)
  if (onTimestampClick) {
    processedContent = convertTimestampsToLinks(processedContent)
  }

  return (
    <div dir="auto" className={cn(MARKDOWN_CLASSES, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom link renderer to handle timestamp links
          a: ({ href, children }) => {
            // Check if this is a timestamp link (#t=seconds)
            if (href?.startsWith('#t=') && onTimestampClick) {
              const seconds = parseInt(href.replace('#t=', ''), 10)
              return (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onTimestampClick(seconds)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onTimestampClick(seconds)
                    }
                  }}
                  className="text-brand hover:text-brand-hover underline cursor-pointer"
                  title={`Jump to ${children}`}
                >
                  {children}
                </span>
              )
            }
            // Regular link - opens in same tab for internal, new tab for external
            const isExternal = href?.startsWith('http')
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                onClick={(e) => {
                  if (!isExternal) {
                    e.preventDefault()
                  }
                }}
              >
                {children}
              </a>
            )
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
