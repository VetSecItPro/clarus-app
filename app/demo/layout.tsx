import Link from "next/link"
import Image from "next/image"

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header - replicates SiteHeader */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="px-4 lg:px-6">
          <div className="relative flex items-center h-14">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/clarus-logo.png"
                alt="Clarus"
                width={40}
                height={40}
                className="w-10 h-10"
              />
              <span
                className="text-white/90 font-bold text-3xl italic tracking-wide"
                style={{ fontFamily: "var(--font-cormorant)" }}
              >
                Clarus
              </span>
            </Link>

            {/* Center nav */}
            <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
              <Link
                href="/demo/library"
                className="flex items-center gap-2 px-4 py-2 text-white/50 hover:text-white/90 transition-colors text-sm font-medium"
              >
                Library
              </Link>
              <Link
                href="/demo/analysis"
                className="flex items-center gap-2 px-4 py-2 text-white/50 hover:text-white/90 transition-colors text-sm font-medium"
              >
                Analysis
              </Link>
            </nav>

            {/* Right side - mock user avatar */}
            <div className="ml-auto flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1d9bf0] to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                J
              </div>
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
