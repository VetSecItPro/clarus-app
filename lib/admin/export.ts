/**
 * Client-side data export utilities for the admin dashboard.
 *
 * Supports CSV and JSON formats. Generates a Blob, creates a
 * temporary download link, and triggers the browser's native
 * file-save dialog. No server round-trip required.
 */

export type ExportFormat = "csv" | "json"

interface ExportOptions {
  /** Data rows to export */
  data: Record<string, unknown>[]
  /** Output format */
  format: ExportFormat
  /** Filename without extension */
  filename: string
  /** Column keys to include (defaults to all keys from first row) */
  columns?: string[]
}

/**
 * Export data as a downloadable file.
 */
export function exportData({ data, format, filename, columns }: ExportOptions) {
  if (data.length === 0) return

  const content = format === "csv" ? toCSV(data, columns) : toJSON(data)
  const mimeType = format === "csv" ? "text/csv;charset=utf-8" : "application/json"
  const ext = format === "csv" ? "csv" : "json"

  downloadBlob(content, `${filename}.${ext}`, mimeType)
}

function toCSV(data: Record<string, unknown>[], columns?: string[]): string {
  const keys = columns ?? Object.keys(data[0])

  const header = keys.map(escapeCSV).join(",")
  const rows = data.map((row) =>
    keys.map((key) => escapeCSV(String(row[key] ?? ""))).join(",")
  )

  return [header, ...rows].join("\n")
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toJSON(data: Record<string, unknown>[]): string {
  return JSON.stringify(data, null, 2)
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
