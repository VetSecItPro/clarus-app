import Link from "next/link"
import Image from "next/image"

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/clarus-logo.webp"
                alt="Clarus"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="text-white/90 font-semibold text-sm tracking-tight group-hover:text-white transition-colors">
                Clarus
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/pricing"
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-white bg-[#1d9bf0] hover:bg-[#1a8cd8] px-4 py-2 rounded-full transition-colors"
              >
                Try Free
              </Link>
            </div>
          </div>
        </div>
      </header>

      {children}

      {/* Footer CTA */}
      <footer className="border-t border-white/[0.06] mt-16">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-12 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            Ready to try it?
          </h2>
          <p className="text-white/40 text-sm mb-6">
            Paste any URL and get AI-powered analysis in seconds. Free to start.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-medium rounded-full transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </footer>
    </div>
  )
}
