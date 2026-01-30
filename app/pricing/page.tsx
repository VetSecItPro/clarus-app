"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Check, X, Zap, Crown, Sparkles } from "lucide-react"

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
      { text: "5 analyses per month", included: true },
      { text: "All 6 analysis sections", included: true },
      { text: "10 chat messages per content", included: true },
      { text: "25 items in library", included: true },
      { text: "5 bookmarks", included: true },
      { text: "3 tags max", included: true },
      { text: "Articles + YouTube", included: true },
      { text: "Community feed (view only)", included: true },
      { text: "Shareable links", included: false },
      { text: "Export (Markdown/PDF)", included: false },
      { text: "Weekly digest email", included: false },
      { text: "Claim tracking", included: false },
    ],
    cta: "Get Started",
    ctaHref: "/signup",
  },
  {
    name: "Starter",
    description: "For serious content consumers",
    monthlyPrice: 8,
    annualPrice: 80,
    icon: <Zap className="w-5 h-5" />,
    color: "blue",
    popular: true,
    accent: {
      bg: "bg-[#1d9bf0]/[0.06]",
      border: "border-[#1d9bf0]/30",
      badge: "bg-[#1d9bf0]",
      button: "bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white shadow-lg shadow-[#1d9bf0]/25 hover:shadow-[#1d9bf0]/40",
    },
    features: [
      { text: "50 analyses per month", included: true },
      { text: "All 6 analysis sections", included: true },
      { text: "Unlimited chat messages", included: true },
      { text: "500 items in library", included: true },
      { text: "50 bookmarks", included: true },
      { text: "Unlimited tags", included: true },
      { text: "All content types", included: true },
      { text: "Community feed (view + post)", included: true },
      { text: "10 shareable links/month", included: true },
      { text: "Markdown export", included: true },
      { text: "Weekly digest email", included: true },
      { text: "Claim tracking", included: false },
    ],
    cta: "Get Started",
    ctaHref: "/signup",
  },
  {
    name: "Pro",
    description: "Full power, zero limits",
    monthlyPrice: 16,
    annualPrice: 160,
    icon: <Crown className="w-5 h-5" />,
    color: "purple",
    accent: {
      bg: "bg-purple-500/[0.06]",
      border: "border-purple-500/30",
      badge: "bg-purple-500",
      button: "bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40",
    },
    features: [
      { text: "Unlimited analyses", included: true },
      { text: "All 6 analysis sections", included: true },
      { text: "Unlimited chat messages", included: true },
      { text: "Unlimited library", included: true },
      { text: "Unlimited bookmarks", included: true },
      { text: "Unlimited tags", included: true },
      { text: "All content types", included: true },
      { text: "Community feed (view + post)", included: true },
      { text: "Unlimited shareable links", included: true },
      { text: "PDF + Markdown export", included: true },
      { text: "Weekly digest email", included: true },
      { text: "Cross-content claim tracking", included: true },
    ],
    cta: "Go Pro",
    ctaHref: "/signup",
  },
] as const

const FAQS = [
  {
    q: "Can I switch plans anytime?",
    a: "Yes. Upgrade or downgrade at any time. When upgrading, you get immediate access to new features. When downgrading, your current billing cycle completes first and you keep full access until it ends.",
  },
  {
    q: "What happens when I hit my monthly limit?",
    a: "You'll see a prompt to upgrade. Your existing analyses, bookmarks, and chat history remain fully accessible. Limits reset on the 1st of each month.",
  },
  {
    q: "What content types are supported?",
    a: "Free users can analyze articles and YouTube videos. Starter and Pro unlock X/Twitter posts, PDFs, Word docs, spreadsheets, and more.",
  },
  {
    q: "Do you offer refunds?",
    a: "We do not offer refunds. When you cancel, your subscription remains active through the end of your current billing period. You keep full access to all paid features until that date.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual plans are billed once per year at a 17% discount. That's 2 months free compared to monthly billing.",
  },
  {
    q: "Is the Free plan really free?",
    a: "Yes, forever. 5 analyses per month, no credit card required, no time limit. Upgrade only when you need more.",
  },
]

function PricingToggle({ interval, onChange }: { interval: BillingInterval; onChange: (v: BillingInterval) => void }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className={`text-sm transition-colors ${interval === "monthly" ? "text-white" : "text-white/40"}`}>
        Monthly
      </span>
      <button
        onClick={() => onChange(interval === "monthly" ? "annual" : "monthly")}
        className="relative w-14 h-7 rounded-full bg-white/[0.08] border border-white/[0.1] transition-colors hover:bg-white/[0.12]"
        aria-label={`Switch to ${interval === "monthly" ? "annual" : "monthly"} billing`}
      >
        <motion.div
          className="absolute top-0.5 w-6 h-6 rounded-full bg-[#1d9bf0]"
          animate={{ left: interval === "monthly" ? "2px" : "calc(100% - 26px)" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      <span className={`text-sm transition-colors ${interval === "annual" ? "text-white" : "text-white/40"}`}>
        Annual
      </span>
      {interval === "annual" && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
        >
          Save 17%
        </motion.span>
      )}
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
        <span className={plan.color === "blue" ? "text-[#1d9bf0]" : plan.color === "purple" ? "text-purple-400" : "text-white/60"}>
          {plan.icon}
        </span>
        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
      </div>
      <p className="text-sm text-white/50 mb-5">{plan.description}</p>

      {/* Price */}
      <div className="mb-6">
        {price === 0 ? (
          <div className="text-4xl font-bold text-white">Free</div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">
                ${interval === "monthly" ? price : monthlyEquivalent}
              </span>
              <span className="text-white/40 text-sm">/month</span>
            </div>
            {interval === "annual" && (
              <div className="text-xs text-white/30 mt-1">
                ${price}/year &middot; billed annually
              </div>
            )}
          </>
        )}
      </div>

      {/* CTA */}
      <Link
        href={plan.ctaHref}
        className={`block w-full text-center px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${plan.accent.button}`}
      >
        {plan.cta}
      </Link>

      {/* Features */}
      <ul className="mt-6 space-y-3 flex-1">
        {plan.features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-2.5">
            {feature.included ? (
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                plan.color === "blue" ? "text-[#1d9bf0]" : plan.color === "purple" ? "text-purple-400" : "text-emerald-400"
              }`} />
            ) : (
              <X className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/20" />
            )}
            <span className={`text-sm ${feature.included ? "text-white/70" : "text-white/30"}`}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
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
              <span className={`text-white/30 transition-transform duration-200 ${openIndex === i ? "rotate-45" : ""}`}>
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

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("monthly")

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]"
      >
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <Image
                  src="/clarus-logo.png"
                  alt="Clarus"
                  width={40}
                  height={40}
                  className="w-10 h-10 transition-all duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-[#1d9bf0]/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <span className="text-white/90 font-bold text-3xl italic tracking-wide group-hover:text-white transition-colors duration-200" style={{ fontFamily: "var(--font-cormorant)" }}>
                Clarus
              </span>
            </Link>
            <Link href="/login">
              <button className="px-5 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-sm font-semibold rounded-full transition-all duration-200 shadow-md shadow-[#1d9bf0]/25 hover:shadow-lg hover:shadow-[#1d9bf0]/40 hover:-translate-y-0.5">
                Log In
              </button>
            </Link>
          </div>
        </div>
      </motion.header>

      <main className="pt-14 flex-1">
        {/* Background orbs */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#1d9bf0]/[0.06] rounded-full blur-[120px]" />
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
              <span className="bg-gradient-to-r from-[#1d9bf0] via-[#0ea5e9] to-[#14b8a6] bg-clip-text text-transparent">
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

        {/* Plan cards */}
        <section className="pb-20 px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <PlanCard key={plan.name} plan={plan} interval={interval} index={i} />
            ))}
          </div>
        </section>

        {/* Comparison table (desktop) */}
        <section className="pb-20 px-4 hidden lg:block">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white text-center mb-8">
              Compare Plans
            </h2>
            <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-6 py-4 text-white/40 font-medium">Feature</th>
                    <th className="px-6 py-4 text-white/60 font-semibold text-center">Free</th>
                    <th className="px-6 py-4 text-[#1d9bf0] font-semibold text-center">Starter</th>
                    <th className="px-6 py-4 text-purple-400 font-semibold text-center">Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    ["Analyses per month", "5", "50", "Unlimited"],
                    ["Chat messages", "10/content", "Unlimited", "Unlimited"],
                    ["Library storage", "25 items", "500 items", "Unlimited"],
                    ["Bookmarks", "5", "50", "Unlimited"],
                    ["Tags", "3 max", "Unlimited", "Unlimited"],
                    ["Shareable links", false, "10/month", "Unlimited"],
                    ["Markdown export", false, true, true],
                    ["PDF export", false, false, true],
                    ["Weekly digest email", false, true, true],
                    ["Claim tracking", false, false, true],
                    ["Content types", "Articles, YouTube", "All types", "All types"],
                    ["Community feed", "View only", "View + post", "View + post"],
                    ["Processing speed", "Standard", "Standard", "Priority"],
                    ["Support", "Community", "Email", "Priority email"],
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
              className="inline-block px-8 py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-full transition-all duration-200 shadow-lg shadow-[#1d9bf0]/25 hover:shadow-[#1d9bf0]/40 hover:-translate-y-0.5"
            >
              Get Started Free
            </Link>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 text-white/50">
            <Image
              src="/clarus-logo.png"
              alt="Clarus"
              width={40}
              height={40}
              className="w-10 h-10"
            />
            <span className="text-white/90 font-bold text-3xl italic tracking-wide" style={{ fontFamily: "var(--font-cormorant)" }}>
              Clarus
            </span>
            <span className="text-white/30">&middot;</span>
            <span>Veteran-Owned Business</span>
          </div>
          <div className="flex items-center gap-4 text-white/40">
            <Link href="/terms" className="hover:text-white/70 transition-colors">
              Terms of Service
            </Link>
            <span className="text-white/20">&middot;</span>
            <Link href="/privacy" className="hover:text-white/70 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function CellValue({ value, accent }: { value: string | boolean; accent?: "blue" | "purple" }) {
  if (value === true) {
    return (
      <Check className={`w-4 h-4 mx-auto ${
        accent === "blue" ? "text-[#1d9bf0]" : accent === "purple" ? "text-purple-400" : "text-emerald-400"
      }`} />
    )
  }
  if (value === false) {
    return <X className="w-4 h-4 mx-auto text-white/15" />
  }
  return (
    <span className={`text-sm ${
      accent === "blue" ? "text-[#1d9bf0]/80" : accent === "purple" ? "text-purple-400/80" : "text-white/50"
    }`}>
      {value}
    </span>
  )
}
