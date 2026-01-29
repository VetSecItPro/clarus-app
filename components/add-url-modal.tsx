"use client"
import { useState, type FormEvent, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getYouTubeVideoId, isXUrl } from "@/lib/utils"

interface AddUrlModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function AddUrlModal({ isOpen, onOpenChange }: AddUrlModalProps) {
  const [url, setUrl] = useState("")
  const [type, setType] = useState<"article" | "youtube" | "x_post" | "">("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    if (newUrl.trim() === "") {
      setType("")
      return
    }
    if (getYouTubeVideoId(newUrl)) {
      setType("youtube")
    } else if (isXUrl(newUrl)) {
      setType("x_post")
    } else {
      setType("article") // Default to article for all other URLs
    }
  }

  // Reset form when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setUrl("")
      setType("")
      setIsLoading(false)
    }
  }, [isOpen])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!url || !type) {
      toast.error("Please enter a valid URL and select a type.")
      return
    }
    setIsLoading(true)
    toast.info("Adding URL to your list...")

    try {
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser()

      if (sessionError || !user) {
        throw new Error(sessionError?.message || "User not authenticated. Please log in.")
      }

      const submissionType = type

      const placeholderTitle = `Processing: ${url.substring(0, 50)}${url.length > 50 ? "..." : ""}`
      const { data: newContent, error: insertError } = await supabase
        .from("content")
        .insert([{ url, type: submissionType, user_id: user.id, title: placeholderTitle, full_text: null }])
        .select("id")
        .single()

      if (insertError || !newContent) {
        throw insertError || new Error("Failed to add URL to database.")
      }

      toast.success("URL added! Starting content processing in the background...")
      onOpenChange(false)

      // Dispatch a custom event to notify other components that content was added.
      window.dispatchEvent(new CustomEvent("contentAdded"))

      // Read saved language preference from localStorage
      const savedLanguage = typeof window !== "undefined"
        ? localStorage.getItem("clarus-analysis-language")
        : null

      fetch("/api/process-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: newContent.id,
          language: savedLanguage && savedLanguage !== "en" ? savedLanguage : undefined,
        }),
      })
        .then(async (apiResponse) => {
          if (!apiResponse.ok) {
            const errorData = await apiResponse.json().catch(() => ({ error: "Unknown API error" }))
            console.error("Error processing content via API:", errorData.error)
            toast.error(`Background processing failed: ${errorData.error || "Unknown API error"}`)
          } else {
            const result = await apiResponse.json().catch(() => ({ message: "Content processing complete!" }))
            toast.success(result.message || "Content processing complete!")
          }
        })
        .catch((apiError) => {
          console.error("Fetch error during API call to process-content:", apiError)
          toast.error("Failed to initiate background processing.")
        })
        .finally(() => {
          // Dispatch again when processing is complete, which might update tags.
          window.dispatchEvent(new CustomEvent("contentAdded"))
          router.refresh()
        })
    } catch (error: unknown) {
      console.error("Error adding URL:", error)
      const message = error instanceof Error ? error.message : "An unexpected error occurred."
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-gray-700 text-gray-200">
        <DialogHeader>
          <DialogTitle>Add New Content</DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter the URL and we'll auto-detect the content type.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="url" className="text-right text-gray-300">
                URL
              </Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="col-span-3 bg-gray-800 border-gray-600 text-gray-200 focus:ring-gray-500"
                placeholder="https://x.com/..."
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right text-gray-300">
                Type
              </Label>
              <Select
                value={type}
                onValueChange={(value: "article" | "youtube" | "x_post" | "") => setType(value)}
                required
              >
                <SelectTrigger className="col-span-3 bg-gray-800 border-gray-600 text-gray-200 focus:ring-gray-500">
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-gray-200">
                  <SelectItem value="article" className="hover:bg-gray-700 focus:bg-gray-700">
                    Article / PDF
                  </SelectItem>
                  <SelectItem value="youtube" className="hover:bg-gray-700 focus:bg-gray-700">
                    YouTube Video
                  </SelectItem>
                  <SelectItem value="x_post" className="hover:bg-gray-700 focus:bg-gray-700">
                    X (Twitter) Post
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="text-gray-300 border-gray-600 hover:bg-gray-700 bg-transparent"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading} className="bg-gray-700 hover:bg-gray-600 text-gray-200">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                </>
              ) : (
                "Add & Process"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
