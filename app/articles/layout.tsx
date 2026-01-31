import Link from "next/link"
import Image from "next/image"

export default function ArticlesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/clarus-logo.png"
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
                href="/articles"
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Articles
              </Link>
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

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-16">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-8 text-center">
          <div className="flex items-center justify-center gap-4 text-sm text-white/40">
            <Link href="/articles" className="hover:text-white/70 transition-colors">
              Articles
            </Link>
            <span className="text-white/20">&middot;</span>
            <Link href="/features" className="hover:text-white/70 transition-colors">
              Features
            </Link>
            <span className="text-white/20">&middot;</span>
            <Link href="/pricing" className="hover:text-white/70 transition-colors">
              Pricing
            </Link>
            <span className="text-white/20">&middot;</span>
            <Link href="/terms" className="hover:text-white/70 transition-colors">
              Terms
            </Link>
            <span className="text-white/20">&middot;</span>
            <Link href="/privacy" className="hover:text-white/70 transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
