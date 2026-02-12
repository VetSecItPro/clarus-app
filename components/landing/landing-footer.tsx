import Link from "next/link"
import Image from "next/image"

export function LandingFooter() {
  return (
    <footer className="py-8 px-4 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        {/* Top row: logo + links */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          {/* Logo and copyright */}
          <div className="flex flex-col items-center sm:items-start gap-1.5">
            <div className="flex items-center gap-2.5">
              <Image
                src="/clarus-logo.webp"
                alt="Clarus"
                width={32}
                height={32}
                sizes="32px"
                className="w-8 h-8"
              />
              <span className="text-white/70 font-bold text-2xl italic tracking-wide" style={{ fontFamily: 'var(--font-cormorant)' }}>
                Clarus
              </span>
            </div>
            <p className="text-xs text-white/30">
              &copy; {new Date().getFullYear()} Clarus. Veteran-Owned &amp; Operated.
            </p>
          </div>

          {/* Links — wrap on mobile */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-5 gap-y-2 text-sm text-white/50">
            <Link href="/articles" className="hover:text-white/70 transition-colors">
              Articles
            </Link>
            <Link href="/pricing" className="hover:text-white/70 transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="hover:text-white/70 transition-colors">
              Contact
            </Link>
            <Link href="/install" className="hover:text-white/70 transition-colors">
              Add to Home Screen
            </Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white/70 transition-colors">
              Privacy
            </Link>
          </div>
        </div>

      </div>
    </footer>
  )
}
