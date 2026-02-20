import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Shield, Target, Eye, Zap } from "lucide-react"
import { PublicHeader } from "@/components/public-header"
import { LandingFooter } from "@/components/landing/landing-footer"

export const metadata: Metadata = {
  title: "About | Clarus",
  description:
    "Clarus is a veteran-owned AI content analysis tool built to help people understand what they read, watch, and listen to. Our mission is clarity in a noisy world.",
  openGraph: {
    title: "About | Clarus",
    description:
      "Veteran-owned AI content analysis. Our mission is clarity in a noisy world.",
    url: "https://clarusapp.io/about",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "About | Clarus",
    description: "Veteran-owned AI content analysis. Our mission is clarity in a noisy world.",
  },
  alternates: {
    canonical: "https://clarusapp.io/about",
  },
}

export const revalidate = 3600

const values = [
  {
    icon: Eye,
    title: "Clarity Over Convenience",
    description:
      "We don't summarize to save time — we analyze to surface truth. Every analysis fact-checks claims, identifies bias, and gives you the full picture.",
  },
  {
    icon: Shield,
    title: "No Shortcuts on Trust",
    description:
      "We cite sources, flag uncertainty, and tell you when something can't be verified. If AI can't give a confident answer, we say so.",
  },
  {
    icon: Target,
    title: "Built for Real People",
    description:
      "Researchers, students, professionals, podcast listeners — anyone who wants to go beyond headlines. Clarus meets you where your content already lives.",
  },
  {
    icon: Zap,
    title: "Veteran Discipline",
    description:
      "Military service taught us that details matter and cutting corners gets people hurt. We bring that same rigor to how we build software.",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <PublicHeader />

      <main id="main-content" className="flex-1 max-w-3xl mx-auto px-4 py-12 sm:py-16 w-full">
        {/* Hero */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="flex justify-center mb-6">
            <Image
              src="/clarus-logo.webp"
              alt="Clarus"
              width={64}
              height={64}
              sizes="64px"
              className="w-16 h-16"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Clarity in a noisy world
          </h1>
          <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Clarus is an AI-powered content analysis tool that helps you
            understand what you read, watch, and listen to — with
            fact-checking, source citations, and zero spin.
          </p>
        </div>

        {/* Origin story */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-xl font-semibold text-white mb-4">Why we built this</h2>
          <div className="space-y-4 text-white/60 text-sm sm:text-base leading-relaxed">
            <p>
              We started Clarus because we were tired of not knowing what to
              trust. Every article has an angle. Every video has an agenda.
              Every podcast guest has something to sell. And most &quot;summary&quot;
              tools just compress the noise — they don&apos;t help you see through it.
            </p>
            <p>
              We wanted something different: a tool that takes any piece of
              content and gives you an honest breakdown. What are the key
              claims? Are they supported by evidence? What&apos;s the source&apos;s
              track record? What context is missing?
            </p>
            <p>
              That&apos;s Clarus. Drop in a YouTube video, article, podcast, or
              PDF, and get six layers of analysis — from a quick overview to
              deep fact-checking with cross-referenced sources. Then chat with
              it to go deeper.
            </p>
          </div>
        </section>

        {/* Veteran-owned badge */}
        <section className="mb-12 sm:mb-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Veteran-Owned &amp; Operated
              </h2>
              <p className="text-white/60 text-sm sm:text-base leading-relaxed">
                Clarus is proudly veteran-owned. Military service instills a
                commitment to precision, accountability, and getting things
                right — values that directly shape how we build this product.
                We don&apos;t cut corners, we don&apos;t ship features that aren&apos;t
                ready, and we treat your data with the same care we&apos;d expect
                for our own.
              </p>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-xl font-semibold text-white mb-6">What we stand for</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {values.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-brand" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                </div>
                <p className="text-white/50 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-xl font-semibold text-white mb-3">
            Ready to see through the noise?
          </h2>
          <p className="text-white/50 text-sm mb-6">
            Start analyzing content for free. No credit card required.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-full transition-all shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/40 hover:-translate-y-0.5"
            >
              Get Started Free
            </Link>
            <Link
              href="/contact"
              className="px-6 py-2.5 text-white/60 hover:text-white/80 text-sm font-medium transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
