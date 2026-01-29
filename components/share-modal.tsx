"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Mail, Loader2, CheckCircle2, AlertCircle, Link2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface ShareModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  contentTitle: string
  contentUrl: string
  briefOverview?: string
  contentId?: string
}

export function ShareModal({
  isOpen,
  onOpenChange,
  contentTitle,
  contentUrl,
  briefOverview,
  contentId,
}: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<"link" | "email">(contentId ? "link" : "email")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<"idle" | "success" | "error">("idle")

  // Link tab state
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const handleGenerateLink = async () => {
    if (!contentId) return
    setIsGenerating(true)
    try {
      const response = await fetch(`/api/content/${contentId}/share-link`, {
        method: "POST",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to generate link")
      setShareUrl(data.share_url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate link"
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setLinkCopied(true)
    toast.success("Link copied to clipboard")
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsSending(true)
    setSendStatus("idle")

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: `Analysis: ${contentTitle}`,
          contentTitle,
          contentUrl,
          briefOverview,
          personalMessage: message,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send email")
      }

      setSendStatus("success")
      toast.success("Email sent successfully!")

      setTimeout(() => {
        setEmail("")
        setMessage("")
        setSendStatus("idle")
        onOpenChange(false)
      }, 1500)
    } catch (err: unknown) {
      setSendStatus("error")
      const message = err instanceof Error ? err.message : "Failed to send email"
      toast.error(message)
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = () => {
    if (!isSending) {
      setEmail("")
      setMessage("")
      setSendStatus("idle")
      setShareUrl(null)
      setLinkCopied(false)
      onOpenChange(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-4"
          >
            <div className="bg-gray-900 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    {activeTab === "link" ? (
                      <Link2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Mail className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Share Analysis</h3>
                    <p className="text-white/50 text-xs">
                      {activeTab === "link" ? "Share via link" : "Send via email"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isSending}
                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab switcher */}
              {contentId && (
                <div className="px-5 pt-4 flex gap-1 bg-gray-900">
                  <button
                    onClick={() => setActiveTab("link")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "link"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Link2 className="w-4 h-4" />
                    Link
                  </button>
                  <button
                    onClick={() => setActiveTab("email")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "email"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Content preview */}
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <p className="text-white/80 text-sm font-medium line-clamp-2">{contentTitle}</p>
                  <p className="text-white/40 text-xs mt-1 truncate">{contentUrl}</p>
                </div>

                {activeTab === "link" && contentId ? (
                  /* Link tab */
                  <div className="space-y-3">
                    {shareUrl ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={shareUrl}
                          className="flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-sm font-mono truncate"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="flex-shrink-0 px-4 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
                        >
                          {linkCopied ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleGenerateLink}
                        disabled={isGenerating}
                        className="w-full rounded-xl py-6 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 transition-all"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating link...
                          </>
                        ) : (
                          <>
                            <Link2 className="mr-2 h-4 w-4" />
                            Generate shareable link
                          </>
                        )}
                      </Button>
                    )}
                    <p className="text-white/30 text-xs text-center">
                      Anyone with this link can view this analysis without logging in.
                    </p>
                  </div>
                ) : (
                  /* Email tab */
                  <>
                    <div>
                      <label className="block text-white/60 text-sm mb-2">Recipient Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="friend@example.com"
                        disabled={isSending}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 text-sm mb-2">Personal Message (optional)</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Hey, thought you might find this interesting..."
                        rows={3}
                        disabled={isSending}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all resize-none disabled:opacity-50"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Footer — only show for email tab */}
              {(activeTab === "email" || !contentId) && (
                <div className="px-5 py-4 border-t border-white/[0.08] flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleClose}
                    disabled={isSending}
                    className="text-white/60 hover:text-white hover:bg-white/[0.08]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={isSending || !email.trim()}
                    className={`rounded-full px-6 transition-all ${
                      sendStatus === "success"
                        ? "bg-emerald-500 text-white"
                        : sendStatus === "error"
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30"
                    }`}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : sendStatus === "success" ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Sent!
                      </>
                    ) : sendStatus === "error" ? (
                      <>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Try Again
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
