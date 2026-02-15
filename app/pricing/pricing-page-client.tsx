"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Check, X, Zap, Crown, Sparkles, Clock } from "lucide-react"
import { LandingHeader } from "@/components/landing/landing-header"
import { LandingFooter } from "@/components/landing/landing-footer"

type BillingInterval = "monthly" | "annual"

const PLANS = [
  {
    name: "Free",
    description: "Get started with content analysis",
    monthlyPrice: 0,
    annualPrice: 0,
    icon: <Sparkles className="w-5 h-5" />,
    color: "white",
    accent: {
      bg: "bg-white/[0.04]",
      border: "border-white/[0.08]",
      badge: "",
      button: "bg-white/[0.06] hover:bg-white/[0.1] text-white/80 border border-white/[0.1]",
    },
    features: [
      { text: "5 analyses per month (articles, YouTube, X)", included: true },
      { text: "Articles + YouTube only", included: true },
      { text: "50 chat messages per month", included: true },
      { text: "25 items in library", included: true },
      { text: "Podcast analysis", included: false },
      { text: "Exports & sharing", included: false },
    ],
    cta: "Get Started",
    ctaHref: "/signup",
  },
  {
    name: "Starter",
    description: "For serious content consumers",
    monthlyPrice: 18,
    annualPrice: 144,
    icon: <Zap className="w-5 h-5" />,
    color: "blue",
    popular: true,
    accent: {
      bg: "bg-brand/[0.06]",
      border: "border-brand/30",
      badge: "bg-brand",
      button: "bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/25 hover:shadow-brand/40",
    },
    features: [
      { text: "50 analyses per month (articles, YouTube, X)", included: true },
      { text: "10 podcast analyses (public feeds)", included: true },
      { text: "Exports & shareable links", included: true },
      { text: "Weekly digest email", included: true },
      { text: "Private podcast feeds", included: false },
    ],
    cta: "Get Started",
    ctaHref: "/signup",
  },
  {
    name: "Pro",
    description: "Full power for power users",
    monthlyPrice: 29,
    annualPrice: 279,
    icon: <Crown className="w-5 h-5" />,
    color: "purple",
    accent: {
      bg: "bg-purple-500/[0.06]",
      border: "border-purple-500/30",
      badge: "bg-purple-500",
      button: "bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40",
    },
    features: [
      { text: "150 analyses per month (articles, YouTube, X)", included: true },
      { text: "30 podcast analyses (public + private)", included: true },
      { text: "Cross-content claim tracking", included: true },
      { text: "Priority processing", included: true },
      { text: "PDF + Markdown exports", included: true },
      { text: "Everything in Starter", included: true },
    ],
    cta: "Go Pro",
    ctaHref: "/signup",
  },
] as const

const FAQS = [
  {
    q: "What counts as an analysis?",
    a: "One analysis = one piece of content processed. Articles, YouTube videos, and X posts all share the same monthly quota (5/50/150). Podcast analyses have their own separate quota (0/10/30) because audio transcription is more resource-intensive. Viewing content you've already analyzed does not count again — only new analyses are counted.",
  },
  {
    q: "What happens if I hit my limit?",
    a: "You can still access your library, read existing analyses, and chat with previously analyzed content. You just can't analyze new content until your quota resets at the start of each calendar month (UTC), or you upgrade.",
  },
  {
    q: "Can I switch plans?",
    a: "Yes. Upgrade anytime and get immediate access to the higher tier's limits. Downgrade or cancel anytime — your current plan stays active until the end of your billing period.",
  },
  {
    q: "Is the Free plan really free?",
    a: "Yes, forever. 5 analyses per month for articles, YouTube, and X posts. No credit card required, no time limit, no trial period. Upgrade only when you need more.",
  },
  {
    q: "Do you use my content to train AI?",
    a: "No. Your content is processed, analyzed, and stored for you. Our AI provider (Google Gemini via Vertex AI) does not use your data for model training and does not retain prompts. We never sell your data. You can delete everything anytime.",
  },
  {
    q: "What's claim tracking?",
    a: "Clarus identifies factual claims in content and tracks them across your library. See which claims appear in multiple sources, which are supported, and which contradict each other. Available on the Pro plan.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual plans are billed once per year at a discount. Starter: $144/year ($12/month, saves $72 vs monthly). Pro: $279/year ($23.25/month, saves $69 vs monthly).",
  },
  {
    q: "What is podcast analysis?",
    a: "Podcast analysis transcribes audio with speaker identification, then runs the same 6-section AI analysis as articles and videos. Starter supports public podcast feeds. Pro adds private feed support for premium podcasts (Patreon, Supercast, etc.) — credentials are stored encrypted and audio is securely proxied for transcription. Podcast analyses have their own monthly quota, separate from regular content analyses.",
  },
  {
    q: "How does the Day Pass work?",
    a: "The Day Pass gives you 24 hours of paid-tier access for a one-time $10 payment. You get 15 analyses, 3 podcast analyses (public feeds), 100 chat messages, shareable links, and exports. After 24 hours, you return to the Free plan. Content you analyzed during the pass stays in your library forever. You can't stack day passes or buy one while on an active subscription.",
  },
]

function PricingToggle({ interval, onChange }: { interval: BillingInterval; onChange: (v: BillingInterval) => void }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className={`text-sm transition-colors ${interval === "monthly" ? "text-white" : "text-white/50"}`}>
        Monthly
      </span>
      <button
        onClick={() => onChange(interval === "monthly" ? "annual" : "monthly")}
        className="relative w-14 h-7 rounded-full bg-white/[0.08] border border-white/[0.1] transition-colors hover:bg-white/[0.12]"
        aria-label={`Switch to ${interval === "monthly" ? "annual" : "monthly"} billing`}
      >
        <motion.div
          className="absolute top-0.5 w-6 h-6 rounded-full bg-brand"
          animate={{ left: interval === "monthly" ? "2px" : "calc(100% - 26px)" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      <span className={`text-sm transition-colors ${interval === "annual" ? "text-white" : "text-white/50"}`}>
        Annual
      </span>
      <span
        className={`text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-opacity duration-200 ${
          interval === "annual" ? "opacity-100" : "opacity-0"
        }`}
      >
        Save up to 33%
      </span>
    </div>
  )
}

function PlanCard({
  plan,
  interval,
  index,
}: {
  plan: (typeof PLANS)[number]
  interval: BillingInterval
  index: number
}) {
  const price = interval === "monthly" ? plan.monthlyPrice : plan.annualPrice
  const monthlyEquivalent = interval === "annual" && plan.annualPrice > 0
    ? (plan.annualPrice / 12).toFixed(2)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`relative flex flex-col rounded-2xl border p-6 ${plan.accent.bg} ${plan.accent.border} transition-all hover:-translate-y-1 hover:shadow-2xl`}
    >
      {/* Popular badge */}
      {"popular" in plan && plan.popular && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full ${plan.accent.badge} text-xs font-bold text-white tracking-wider uppercase`}>
          Most Popular
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={plan.color === "blue" ? "text-brand" : plan.color === "purple" ? "text-purple-400" : "text-white/60"}>
          {plan.icon}
        </span>
        <h2 className="text-lg font-bold text-white">{plan.name}</h2>
      </div>
      <p className="text-sm text-white/50 mb-5">{plan.description}</p>

      {/* Price — fixed height to prevent layout shift on toggle */}
      <div className="mb-6 h-[72px] flex flex-col justify-center">
        {price === 0 ? (
          <div className="text-4xl font-bold text-white">Free</div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">
                ${interval === "monthly" ? price : monthlyEquivalent}
              </span>
              <span className="text-white/50 text-sm">/month</span>
            </div>
            <div className={`text-xs mt-1 transition-opacity duration-200 ${interval === "annual" ? "text-white/50 opacity-100" : "opacity-0"}`}>
              ${plan.annualPrice}/year &middot; billed annually
            </div>
          </>
        )}
      </div>

      {/* CTA */}
      <Link
        href={plan.ctaHref}
        className={`block w-full text-center px-5 py-3 rounded-full text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${plan.accent.button}`}
      >
        {plan.cta}
      </Link>

      {/* Features */}
      <ul className="mt-6 space-y-3 flex-1">
        {plan.features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-2.5">
            {feature.included ? (
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                plan.color === "blue" ? "text-brand" : plan.color === "purple" ? "text-purple-400" : "text-emerald-400"
              }`} />
            ) : (
              <X className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/50" />
            )}
            <span className={`text-sm ${feature.included ? "text-white/70" : "text-white/50"}`}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      {/* Link to comparison table */}
      <a
        href="#compare"
        className="block mt-4 text-xs text-white/30 hover:text-white/50 transition-colors text-center"
      >
        See full comparison &darr;
      </a>
    </motion.div>
  )
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white text-center mb-8">
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {FAQS.map((faq, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-white/80 hover:text-white transition-colors"
            >
              {faq.q}
              <span className={`text-white/50 transition-transform duration-200 ${openIndex === i ? "rotate-45" : ""}`}>
                +
              </span>
            </button>
            {openIndex === i && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-5 pb-4"
              >
                <p className="text-sm text-white/50 leading-relaxed">{faq.a}</p>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PricingPageClient() {
  const [interval, setInterval] = useState<BillingInterval>("monthly")

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <LandingHeader />

      <main id="main-content" className="pt-14 flex-1">
        {/* Background orbs */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand/[0.06] rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.04] rounded-full blur-[100px]" />
        </div>

        {/* Hero */}
        <section className="pt-20 pb-12 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight"
            >
              Simple, transparent{" "}
              <span className="bg-gradient-to-r from-brand via-[#0ea5e9] to-[#14b8a6] bg-clip-text text-transparent">
                pricing
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg text-white/50 mb-8 max-w-xl mx-auto"
            >
              Start free. Upgrade when you need more. No hidden fees, cancel anytime.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <PricingToggle interval={interval} onChange={setInterval} />
            </motion.div>
          </div>
        </section>

        {/* Plan cards + Day Pass callout as one visual unit */}
        <section className="pb-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map((plan, i) => (
                <PlanCard key={plan.name} plan={plan} interval={interval} index={i} />
              ))}
            </div>

            {/* Day Pass — callout strip directly below tier cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-6"
            >
              <div className="relative rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 sm:p-6 overflow-hidden">
                {/* Glow accent */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

                <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  {/* Left: info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <h2 className="text-base font-bold text-white">Need it just for today?</h2>
                      <span className="text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Day Pass
                      </span>
                    </div>
                    <p className="text-sm text-white/50 mb-3">
                      Full premium features for 24 hours — 15 analyses, 100 chat messages, exports, and shareable links.
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1">
                      {[
                        "15 analyses",
                        "3 podcast analyses (public feeds)",
                        "100 chat messages",
                        "Exports",
                      ].map((feature) => (
                        <div key={feature} className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span className="text-xs text-white/60">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: price + CTA */}
                  <div className="flex items-center gap-4 sm:flex-col sm:gap-2 sm:min-w-[140px]">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">$10</div>
                      <div className="text-[0.6875rem] text-white/50">one-time &middot; 24hr</div>
                    </div>
                    <Link
                      href="/signup"
                      className="block text-center px-5 py-2 rounded-full text-sm font-semibold text-black bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap"
                    >
                      Get Day Pass
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Comparison table (desktop) */}
        <section id="compare" className="pb-20 px-4 hidden lg:block scroll-mt-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white text-center mb-8">
              Compare Plans
            </h2>
            <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-6 py-4 text-white/50 font-medium">Feature</th>
                    <th className="px-6 py-4 text-white/60 font-semibold text-center">Free</th>
                    <th className="px-6 py-4 text-brand font-semibold text-center">Starter</th>
                    <th className="px-6 py-4 text-purple-400 font-semibold text-center">Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    ["Analyses per month (articles, YouTube, X)", "5", "50", "150"],
                    ["Podcast analyses", false, "10/month", "30/month"],
                    ["Podcast feed subscriptions", false, "3 (public)", "10 (public + private)"],
                    ["YouTube feed subscriptions", false, "3", "10"],
                    ["Private podcast feeds", false, false, true],
                    ["Chat messages/content", "10", "25", "50"],
                    ["Chat messages/month", "50", "300", "1,000"],
                    ["Library storage", "25 items", "500 items", "5,000 items"],
                    ["Collections", "3", "50", "100"],
                    ["Bookmarks", "5", "50", "500"],
                    ["Tags", "3 max", "50", "100"],
                    ["Shareable links", false, "10/month", "100/month"],
                    ["Exports (Markdown)", false, "50/month", "100/month"],
                    ["PDF export", false, false, true],
                    ["Weekly digest email", false, true, true],
                    ["Claim tracking", false, false, true],
                    ["Comparative analysis", false, false, true],
                    ["Analysis preferences", false, true, true],
                    ["Content types", "Articles, YouTube", "All types", "All types"],
                    ["Processing speed", "Standard", "Standard", "Priority"],
                  ].map(([feature, free, starter, pro]) => (
                    <tr key={feature as string} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5 text-white/60">{feature}</td>
                      <td className="px-6 py-3.5 text-center">
                        <CellValue value={free} />
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <CellValue value={starter} accent="blue" />
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <CellValue value={pro} accent="purple" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-20 px-4">
          <FAQSection />
        </section>

        {/* Bottom CTA */}
        <section className="pb-20 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10"
          >
            <h2 className="text-2xl font-bold text-white mb-3">
              Ready to think clearly?
            </h2>
            <p className="text-white/50 mb-6">
              Join thousands who use Clarus to cut through noise and understand what matters.
            </p>
            <Link
              href="/signup"
              className="inline-block px-8 py-3 bg-brand hover:bg-brand-hover text-white font-semibold rounded-full transition-all duration-200 shadow-lg shadow-brand/25 hover:shadow-brand/40 hover:-translate-y-0.5 text-sm"
            >
              Get Started Free
            </Link>
          </motion.div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}

function CellValue({ value, accent }: { value: string | boolean; accent?: "blue" | "purple" }) {
  if (value === true) {
    return (
      <Check className={`w-4 h-4 mx-auto ${
        accent === "blue" ? "text-brand" : accent === "purple" ? "text-purple-400" : "text-emerald-400"
      }`} />
    )
  }
  if (value === false) {
    return <X className="w-4 h-4 mx-auto text-white/15" />
  }
  return (
    <span className={`text-sm ${
      accent === "blue" ? "text-brand/80" : accent === "purple" ? "text-purple-400/80" : "text-white/50"
    }`}>
      {value}
    </span>
  )
}
