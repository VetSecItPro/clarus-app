"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Sparkles, Globe } from 'lucide-react'
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface AnalysisPrompt {
  id: string
  prompt_type: string
  name: string
  description: string | null
  system_content: string
  user_content_template: string
  model_name: string
  temperature: number | null
  max_tokens: number | null
  expect_json: boolean | null
  is_active: boolean | null
  use_web_search: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface EditAIPromptsModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const modelOptions = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
  "anthropic/claude-sonnet-4",
  "openai/gpt-4o",
]

const PROMPT_LABELS: Record<string, { label: string; icon: string; step: number }> = {
  brief_overview: { label: "Overview", icon: "1️⃣", step: 1 },
  triage: { label: "Quick Assessment", icon: "2️⃣", step: 2 },
  short_summary: { label: "Key Takeaways", icon: "3️⃣", step: 3 },
  truth_check: { label: "Accuracy Analysis", icon: "4️⃣", step: 4 },
  action_items: { label: "Action Items", icon: "5️⃣", step: 5 },
  detailed_summary: { label: "Detailed Analysis", icon: "6️⃣", step: 6 },
}

export function EditAIPromptsModal({ isOpen, onOpenChange }: EditAIPromptsModalProps) {
  const [prompts, setPrompts] = useState<AnalysisPrompt[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState<AnalysisPrompt | null>(null)
  const [editedPrompt, setEditedPrompt] = useState<Partial<AnalysisPrompt>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchPrompts()
    }
  }, [isOpen])

  const fetchPrompts = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("analysis_prompts")
        .select("id, prompt_type, name, description, system_content, user_content_template, model_name, temperature, max_tokens, expect_json, is_active, use_web_search, created_at, updated_at")
        .eq("is_active", true)

      if (error) throw error

      // Sort by step number from PROMPT_LABELS
      const sorted = (data || []).sort((a, b) => {
        const stepA = PROMPT_LABELS[a.prompt_type]?.step ?? 999
        const stepB = PROMPT_LABELS[b.prompt_type]?.step ?? 999
        return stepA - stepB
      }) as AnalysisPrompt[]

      setPrompts(sorted)
      if (sorted.length > 0) {
        setSelectedPrompt(sorted[0] as AnalysisPrompt)
        setEditedPrompt(sorted[0] as AnalysisPrompt)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error("Failed to fetch prompts", { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectPrompt = (prompt: AnalysisPrompt) => {
    if (hasChanges) {
      const confirm = window.confirm("You have unsaved changes. Discard them?")
      if (!confirm) return
    }
    setSelectedPrompt(prompt)
    setEditedPrompt(prompt)
    setHasChanges(false)
  }

  const handleChange = (field: keyof AnalysisPrompt, value: string | number | boolean | null) => {
    setEditedPrompt((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!selectedPrompt || !editedPrompt.id) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from("analysis_prompts")
        .update({
          system_content: editedPrompt.system_content,
          user_content_template: editedPrompt.user_content_template,
          model_name: editedPrompt.model_name,
          temperature: editedPrompt.temperature,
          max_tokens: editedPrompt.max_tokens,
          use_web_search: editedPrompt.use_web_search,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editedPrompt.id)

      if (error) throw error

      setPrompts((prev) =>
        prev.map((p) => (p.id === editedPrompt.id ? { ...p, ...editedPrompt } : p))
      )
      setSelectedPrompt({ ...selectedPrompt, ...editedPrompt } as AnalysisPrompt)
      setHasChanges(false)
      toast.success(`${PROMPT_LABELS[editedPrompt.prompt_type || ""]?.label || "Prompt"} updated`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error("Failed to save", { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  const inputClassName = "bg-black/40 border-white/10 text-white text-sm placeholder-white/30 focus:border-brand/50 focus:ring-0 rounded-lg"

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[90vw] !max-w-[580px] bg-neutral-900 text-white border border-white/10 rounded-2xl shadow-2xl p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand" />
            AI Analysis Prompts
          </DialogTitle>
          <DialogDescription className="text-sm text-white/50">
            Configure how AI analyzes and summarizes your content
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Prompt selector tabs */}
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <div className="flex flex-wrap gap-2">
                {prompts.map((prompt) => {
                  const info = PROMPT_LABELS[prompt.prompt_type] || { label: prompt.name, icon: "📄" }
                  const isSelected = selectedPrompt?.id === prompt.id
                  return (
                    <button
                      key={prompt.id}
                      onClick={() => handleSelectPrompt(prompt)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        isSelected
                          ? "bg-brand text-white"
                          : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white"
                      )}
                    >
                      <span>{info.icon}</span>
                      <span>{info.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Edit form */}
            {selectedPrompt && (
              <div className="px-6 py-5 space-y-5 max-h-[50vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label className="text-sm text-white/70 font-medium">System Prompt</Label>
                  <Textarea
                    value={editedPrompt.system_content || ""}
                    onChange={(e) => handleChange("system_content", e.target.value)}
                    className={cn(inputClassName, "min-h-[120px] resize-y")}
                    placeholder="Instructions for the AI..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-white/70 font-medium">User Template</Label>
                  <Textarea
                    value={editedPrompt.user_content_template || ""}
                    onChange={(e) => handleChange("user_content_template", e.target.value)}
                    className={cn(inputClassName, "min-h-[100px] resize-y")}
                    placeholder="Template with {{CONTENT}} placeholder..."
                  />
                  <p className="text-xs text-white/40">
                    Variables: <code className="bg-white/10 px-1 rounded">{"{{CONTENT}}"}</code> for content, <code className="bg-white/10 px-1 rounded">{"{{TYPE}}"}</code> for type
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-white/70 font-medium">Model</Label>
                    <Select
                      value={editedPrompt.model_name || ""}
                      onValueChange={(value) => handleChange("model_name", value)}
                    >
                      <SelectTrigger className={cn(inputClassName, "h-10")}>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-white/10 text-white rounded-lg">
                        {modelOptions.map((model) => (
                          <SelectItem
                            key={model}
                            value={model}
                            className="text-sm focus:bg-white/[0.08] focus:text-white rounded"
                          >
                            {model.split("/")[1]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-white/70 font-medium">Temperature</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={editedPrompt.temperature ?? ""}
                      onChange={(e) => handleChange("temperature", e.target.value ? Number(e.target.value) : null)}
                      className={cn(inputClassName, "h-10")}
                      placeholder="0.7"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-white/70 font-medium">Max Tokens</Label>
                    <Input
                      type="number"
                      step="256"
                      min="256"
                      value={editedPrompt.max_tokens ?? ""}
                      onChange={(e) => handleChange("max_tokens", e.target.value ? Number(e.target.value) : null)}
                      className={cn(inputClassName, "h-10")}
                      placeholder="2048"
                    />
                  </div>
                </div>

                {/* Web Search Toggle */}
                <div className="flex items-center justify-between py-3 px-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-brand" />
                    <div>
                      <Label className="text-sm text-white/90 font-medium">Web Search</Label>
                      <p className="text-xs text-white/40">Enable Tavily web search for fact-checking</p>
                    </div>
                  </div>
                  <Switch
                    checked={editedPrompt.use_web_search !== false}
                    onCheckedChange={(checked) => handleChange("use_web_search", checked)}
                    className="data-[state=checked]:bg-brand"
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] bg-black/20 flex items-center justify-between">
              <div className="text-sm text-white/40">
                {hasChanges && "• Unsaved changes"}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="text-white/60 hover:text-white hover:bg-white/[0.06] h-9"
                >
                  Close
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="bg-brand hover:bg-brand-hover text-white h-9 px-5 disabled:opacity-40"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
