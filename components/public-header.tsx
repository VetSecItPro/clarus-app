import Link from "next/link"
import Image from "next/image"

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Image
                src="/clarus-logo.webp"
                alt="Clarus"
                width={40}
                height={40}
                className="w-10 h-10 transition-all duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[#1d9bf0]/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-white/90 font-bold text-3xl italic tracking-wide group-hover:text-white transition-colors duration-200" style={{ fontFamily: 'var(--font-cormorant)' }}>
              Clarus
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href="/articles" className="text-sm text-white/50 hover:text-white transition-colors">
              Articles
            </Link>
            <Link href="/pricing" className="text-sm text-white/50 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="px-5 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-sm font-semibold rounded-full transition-all duration-200 shadow-md shadow-[#1d9bf0]/25 hover:shadow-lg hover:shadow-[#1d9bf0]/40 hover:-translate-y-0.5">
              Log In
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
