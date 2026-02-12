"use client"

import { useState } from "react"
import { Download, Trash2, Loader2, AlertTriangle, ArrowLeft, Shield, CreditCard, ExternalLink } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { clearAuthCache, getCachedSession } from "@/components/with-auth"
import { useUserTier } from "@/lib/hooks/use-user-tier"
import { toast } from "sonner"

const TIER_DISPLAY: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  day_pass: "Day Pass",
}

export default function AccountPage() {
  const { session } = getCachedSession()
  const { tier, subscriptionStatus, isLoading: tierLoading } = useUserTier(session?.user?.id ?? null)
  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const hasPaidSubscription = tier !== "free" && tier !== "day_pass"
  const hasDayPass = tier === "day_pass"

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true)
    try {
      const response = await fetch("/api/polar/portal", { method: "POST" })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || "Failed to open billing portal")
        return
      }
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch {
      toast.error("Failed to open billing portal")
    } finally {
      setIsLoadingPortal(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch("/api/account/export")
      if (!response.ok) {
        toast.error("Failed to export data")
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `clarus-data-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Data exported successfully")
    } catch {
      toast.error("Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== "DELETE") return
    setIsDeleting(true)
    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE_MY_ACCOUNT" }),
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || "Failed to delete account")
        setIsDeleting(false)
        return
      }

      // Clear local state and redirect
      clearAuthCache()
      if (typeof window !== "undefined") {
        localStorage.clear()
        sessionStorage.clear()
      }
      await supabase.auth.signOut()
      window.location.href = "/login"
    } catch {
      toast.error("Failed to delete account")
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <main id="main-content" className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 pb-24 sm:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="h-9 w-9 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white border border-white/[0.08] inline-flex items-center justify-center transition-all"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Account</h1>
            <p className="text-sm text-white/40">Manage your data and privacy</p>
          </div>
        </div>

        {/* Data Export Section */}
        <section className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Export Your Data</h2>
              <p className="text-sm text-white/50 mt-1">
                Download a copy of all your data including analyses, chat history, collections, and preferences. The export is a JSON file you can open in any text editor.
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 hover:border-brand/30 text-sm font-medium transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download My Data
              </>
            )}
          </button>
        </section>

        {/* Subscription & Billing Section */}
        <section className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-brand" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-white">Subscription & Billing</h2>
              {tierLoading ? (
                <div className="h-4 w-32 mt-1.5 rounded bg-white/[0.06] animate-pulse" />
              ) : (
                <p className="text-sm text-white/50 mt-1">
                  Current plan:{" "}
                  <span className="text-white font-medium">{TIER_DISPLAY[tier] ?? tier}</span>
                  {subscriptionStatus === "active" && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  )}
                  {subscriptionStatus === "trialing" && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Trial
                    </span>
                  )}
                  {subscriptionStatus === "past_due" && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Past Due
                    </span>
                  )}
                  {hasDayPass && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      24hr Access
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {hasPaidSubscription ? (
            <button
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 hover:border-brand/30 text-sm font-medium transition-all disabled:opacity-50"
            >
              {isLoadingPortal ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening portal...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Manage Subscription
                </>
              )}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 hover:border-brand/30 text-sm font-medium transition-all"
            >
              <CreditCard className="w-4 h-4" />
              {hasDayPass ? "View Plans" : "Upgrade Plan"}
            </Link>
          )}
        </section>

        {/* Delete Account Section */}
        <section className="p-5 rounded-2xl bg-red-500/[0.03] border border-red-500/[0.12] mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-red-300">Delete Account</h2>
              <p className="text-sm text-white/50 mt-1">
                Permanently delete your account and all associated data. This includes all analyses, chat history, collections, subscriptions, and usage data. This action cannot be undone.
              </p>
            </div>
          </div>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 text-sm font-medium transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete My Account
            </button>
          ) : (
            <div className="mt-2 p-4 rounded-xl bg-red-500/[0.05] border border-red-500/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm font-medium text-red-300">This is permanent and irreversible</p>
              </div>
              <p className="text-sm text-white/50 mb-4">
                Type <span className="font-mono text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded">DELETE</span> to confirm:
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE"
                  className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-red-500/20 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== "DELETE" || isDeleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Confirm Delete"
                  )}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput("") }}
                  className="px-3 py-2 rounded-lg text-white/50 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Privacy Info */}
        <section className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white/50" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Your Privacy Rights</h2>
              <p className="text-sm text-white/50 mt-1">
                Under GDPR and similar privacy laws, you have the right to access, export, and delete your personal data at any time. Read our{" "}
                <Link href="/privacy" className="text-brand hover:text-brand underline underline-offset-2">
                  Privacy Policy
                </Link>{" "}
                for full details.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
