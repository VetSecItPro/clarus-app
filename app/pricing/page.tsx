"use client"

import { useState } from "react"
import { Check, Loader2, Zap, Gift } from "lucide-react"
import { BlueCheckLogo } from "@/components/blue-check-logo"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type BillingInterval = "monthly" | "annual"

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("monthly")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session")
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error: any) {
      toast.error(error.message || "Something went wrong")
      setIsLoading(false)
    }
  }

  const features = [
    "Unlimited content analysis",
    "AI-powered summaries",
    "Chat with any content",
    "Signal/Noise ratings",
    "Community feed access",
    "Full history & library",
  ]

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-12">
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <BlueCheckLogo size={56} />
        <h1 className="text-2xl font-bold text-white mt-4">Truth Checker Pro</h1>
        <p className="text-neutral-500 text-sm mt-1 text-center">
          Unlock the full power of AI-assisted truth verification
        </p>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full mb-6">
        <Gift className="w-4 h-4 text-green-400" />
        <span className="text-sm text-green-400 font-medium">30-day free trial included</span>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center gap-2 p-1 bg-white/[0.06] rounded-xl mb-8">
        <button
          onClick={() => setInterval("monthly")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            interval === "monthly" ? "bg-[#1d9bf0] text-white" : "text-white/60 hover:text-white",
          )}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("annual")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
            interval === "annual" ? "bg-[#1d9bf0] text-white" : "text-white/60 hover:text-white",
          )}
        >
          Annual
          <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Save 40%</span>
        </button>
      </div>

      {/* Pricing Card */}
      <div className="w-full max-w-sm">
        <div className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 overflow-hidden">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1d9bf0]/10 to-transparent pointer-events-none" />

          <div className="relative">
            {/* Price */}
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-bold text-white">${interval === "monthly" ? "4" : "29"}</span>
              <span className="text-white/50">/{interval === "monthly" ? "month" : "year"}</span>
            </div>

            {interval === "annual" && <p className="text-sm text-green-400 mb-4">$2.42/month, billed annually</p>}

            <p className="text-sm text-white/60 mb-4">
              Start with 30 days free, then {interval === "monthly" ? "$4/month" : "$29/year"}
            </p>

            {/* Features */}
            <ul className="space-y-3 mb-6">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1d9bf0]/20 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-[#1d9bf0]" />
                  </div>
                  <span className="text-sm text-white/80">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Subscribe Button */}
            <button
              onClick={handleSubscribe}
              disabled={isLoading}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2",
                "bg-[#1d9bf0] hover:bg-[#1a8cd8] active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Start Free Trial
                </>
              )}
            </button>

            <p className="text-xs text-white/40 text-center mt-4">
              No charge for 30 days. Cancel anytime. Secure payment via Stripe.
            </p>
          </div>
        </div>
      </div>

      {/* Back link */}
      <a href="/login" className="mt-6 text-sm text-white/50 hover:text-white/70 transition-colors">
        ← Back to login
      </a>
    </div>
  )
}
