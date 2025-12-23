"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { TablesInsert } from "@/types/database.types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react"

// This component assumes it's rendered within an authenticated context

const CONTENT_TYPES = ["Article", "Video", "Podcast", "Link", "Other"]

export default function AddContentPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [type, setType] = useState("")
  const [fullText, setFullText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("User not authenticated. Please log in.")
      setIsLoading(false)
      return
    }

    const newContent: TablesInsert<"content"> = {
      title,
      url,
      type,
      full_text: fullText || null,
      user_id: user.id,
    }

    // RLS: "Users can insert their own content"
    // The `date_added` and `id` will be handled by the DB or Supabase defaults.
    const { error: insertError } = await supabase.from("content").insert(newContent)

    setIsLoading(false)
    if (insertError) {
      console.error("Error adding content:", insertError)
      setError(`Failed to add content: ${insertError.message}. Check RLS policies and table constraints.`)
    } else {
      setSuccess("Content added successfully! Redirecting to dashboard...")
      setTitle("")
      setUrl("")
      setType("")
      setFullText("")
      setTimeout(() => router.push("/dashboard"), 2000)
    }
  }

  return (
    <div className="container mx-auto p-4 flex justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Add New Content</CardTitle>
          <CardDescription>Save something new to your reading list.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g., How to learn Next.js"
              />
            </div>
            <div>
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="e.g., https://example.com/article"
              />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select onValueChange={setType} value={type} required>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((contentType) => (
                    <SelectItem key={contentType} value={contentType}>
                      {contentType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fullText">Full Text (Optional)</Label>
              <textarea
                id="fullText"
                value={fullText}
                onChange={(e) => setFullText(e.target.value)}
                rows={4}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Paste full text here if available..."
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert
                variant="default"
                className="bg-green-50 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300"
              >
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Content"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
