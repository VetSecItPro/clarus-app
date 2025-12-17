"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { Database } from "@/types/database.types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from 'lucide-react'

type SummarizerPrompt = Database["public"]["Tables"]["active_summarizer_prompt"]["Row"]
type ChatPrompt = Database["public"]["Tables"]["active_chat_prompt"]["Row"]

interface EditAIPromptsModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const modelOptions = ["openai/gpt-5-chat", "anthropic/claude-sonnet-4", "x-ai/grok-4", "google/gemini-2.5-pro"]
const MODEL_MAP: Record<string, string> = {
  "openai/gpt-4.1": "openai/gpt-5-chat",
}

export function EditAIPromptsModal({ isOpen, onOpenChange }: EditAIPromptsModalProps) {
  const [summarizerPrompt, setSummarizerPrompt] = useState<Partial<SummarizerPrompt>>({})
  const [chatPrompt, setChatPrompt] = useState<Partial<ChatPrompt>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchPrompts()
    }
  }, [isOpen])

  const fetchPrompts = async () => {
    setIsLoading(true)
    try {
      const [summarizerRes, chatRes] = await Promise.all([
        supabase.from("active_summarizer_prompt").select("*").eq("id", 1).single(),
        supabase.from("active_chat_prompt").select("*").eq("id", 1).single(),
      ])

      if (summarizerRes.error) throw summarizerRes.error
      if (chatRes.error) throw chatRes.error

      const sData = summarizerRes.data as SummarizerPrompt
      const cData = chatRes.data as ChatPrompt
      setSummarizerPrompt({
        ...sData,
        model_name: sData?.model_name ? MODEL_MAP[sData.model_name] ?? sData.model_name : sData?.model_name,
      })
      setChatPrompt({
        ...cData,
        model_name: cData?.model_name ? MODEL_MAP[cData.model_name] ?? cData.model_name : cData?.model_name,
      })
    } catch (error: any) {
      toast.error("Failed to fetch AI prompts.", { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (activeTab: "summarizer" | "chat") => {
    setIsSaving(true)
    try {
      if (activeTab === "summarizer") {
        const { error } = await supabase
          .from("active_summarizer_prompt")
          .update({
            system_content: summarizerPrompt.system_content,
            user_content_template: summarizerPrompt.user_content_template,
            model_name: summarizerPrompt.model_name,
            temperature: summarizerPrompt.temperature,
            top_p: summarizerPrompt.top_p,
            max_tokens: summarizerPrompt.max_tokens,
          })
          .eq("id", 1)
        if (error) throw error
        toast.success("Summarizer prompt updated successfully.")
      } else if (activeTab === "chat") {
        const { error } = await supabase
          .from("active_chat_prompt")
          .update({
            system_content: chatPrompt.system_content,
            model_name: chatPrompt.model_name,
            temperature: chatPrompt.temperature,
            top_p: chatPrompt.top_p,
            max_tokens: chatPrompt.max_tokens,
          })
          .eq("id", 1)
        if (error) throw error
        toast.success("Chat prompt updated successfully.")
      }
      onOpenChange(false)
    } catch (error: any) {
      toast.error("Failed to update prompt.", { description: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSummarizerChange = (field: keyof SummarizerPrompt, value: string | number | null) => {
    setSummarizerPrompt((prev) => ({ ...prev, [field]: value }))
  }

  const handleChatChange = (field: keyof ChatPrompt, value: string | number | null) => {
    setChatPrompt((prev) => ({ ...prev, [field]: value }))
  }

  const renderNumberInput = (
    id: string,
    label: string,
    value: number | null | undefined,
    onChange: (value: number | null) => void,
    step: number,
  ) => (
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor={id} className="text-right">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="col-span-3 bg-gray-800 border-gray-600 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle>Edit AI Prompts</DialogTitle>
          <DialogDescription>
            Manage the prompts and settings for the AI models used for summarization and chat.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-96">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="summarizer" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summarizer">Summarizer</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
            </TabsList>
            <TabsContent value="summarizer">
              <div className="grid gap-4 py-4 max-h-[60vh] md:max-h-none overflow-y-auto pr-4">
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="system_content" className="text-right pt-2">
                    System Content
                  </Label>
                  <Textarea
                    id="system_content"
                    value={summarizerPrompt.system_content || ""}
                    onChange={(e) => handleSummarizerChange("system_content", e.target.value)}
                    className="col-span-3 bg-gray-800 border-gray-600 focus:ring-blue-500"
                    rows={6}
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="user_content_template" className="text-right pt-2">
                    User Template
                  </Label>
                  <Textarea
                    id="user_content_template"
                    value={summarizerPrompt.user_content_template || ""}
                    onChange={(e) => handleSummarizerChange("user_content_template", e.target.value)}
                    className="col-span-3 bg-gray-800 border-gray-600 focus:ring-blue-500"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="model_name_summarizer" className="text-right">
                    Model Name
                  </Label>
                  <Select
                    value={summarizerPrompt.model_name || ""}
                    onValueChange={(value) => handleSummarizerChange("model_name", value)}
                  >
                    <SelectTrigger
                      id="model_name_summarizer"
                      className="col-span-3 bg-gray-800 border-gray-600 focus:ring-blue-500"
                    >
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700">
                      {modelOptions.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {renderNumberInput(
                  "temperature_summarizer",
                  "Temperature",
                  summarizerPrompt.temperature,
                  (v) => handleSummarizerChange("temperature", v),
                  0.1,
                )}
                {renderNumberInput(
                  "top_p_summarizer",
                  "Top P",
                  summarizerPrompt.top_p,
                  (v) => handleSummarizerChange("top_p", v),
                  0.1,
                )}
                {renderNumberInput(
                  "max_tokens_summarizer",
                  "Max Tokens",
                  summarizerPrompt.max_tokens,
                  (v) => handleSummarizerChange("max_tokens", v),
                  1,
                )}
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isSaving}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={() => handleSave("summarizer")} disabled={isSaving || isLoading}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Summarizer
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="chat">
              <div className="grid gap-4 py-4 max-h-[60vh] md:max-h-none overflow-y-auto pr-4">
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="system_content_chat" className="text-right pt-2">
                    System Content
                  </Label>
                  <Textarea
                    id="system_content_chat"
                    value={chatPrompt.system_content || ""}
                    onChange={(e) => handleChatChange("system_content", e.target.value)}
                    className="col-span-3 bg-gray-800 border-gray-600 focus:ring-blue-500"
                    rows={8}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="model_name_chat" className="text-right">
                    Model Name
                  </Label>
                  <Select
                    value={chatPrompt.model_name || ""}
                    onValueChange={(value) => handleChatChange("model_name", value)}
                  >
                    <SelectTrigger
                      id="model_name_chat"
                      className="col-span-3 bg-gray-800 border-gray-600 focus:ring-blue-500"
                    >
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700">
                      {modelOptions.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {renderNumberInput(
                  "temperature_chat",
                  "Temperature",
                  chatPrompt.temperature,
                  (v) => handleChatChange("temperature", v),
                  0.1,
                )}
                {renderNumberInput("top_p_chat", "Top P", chatPrompt.top_p, (v) => handleChatChange("top_p", v), 0.1)}
                {renderNumberInput(
                  "max_tokens_chat",
                  "Max Tokens",
                  chatPrompt.max_tokens,
                  (v) => handleChatChange("max_tokens", v),
                  1,
                )}
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isSaving}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={() => handleSave("chat")} disabled={isSaving || isLoading}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Chat
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
