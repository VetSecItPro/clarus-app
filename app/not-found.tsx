import Link from "next/link"
import { FileQuestion } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <FileQuestion className="w-12 h-12 text-white/50 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Page not found</h2>
        <p className="text-white/50 text-sm mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 rounded-full bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
