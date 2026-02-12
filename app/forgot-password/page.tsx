"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, Mail, ArrowRight } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handlePasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsLoading(true)
    toast.info("Sending password reset email...")

    // The redirectTo URL must be whitelisted in your Supabase project's URL Configuration
    const redirectTo = `${window.location.origin}/update-password`

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    setIsLoading(false)

    if (resetError) {
      setError(resetError.message)
      toast.error(`Error: ${resetError.message}`)
    } else {
      setMessage("Password reset email sent! Please check your inbox (and spam folder).")
      toast.success("Password reset email sent!")
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-xs animate-[fadeInUp_0.6s_ease-out]">
        {/* Logo */}
        <Link href="/" className="flex justify-center mb-8 hover:opacity-80 transition-opacity">
          <Image
            src="/clarus-email-logo.png"
            alt="Clarus"
            width={140}
            height={48}
            className="h-10 w-auto"
          />
        </Link>

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Forgot Password</h1>
          <p className="text-white/50 text-sm">
            Enter your email to receive a password reset link.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handlePasswordReset} className="space-y-4">
          {/* Email field */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-medium text-white/70">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-10 pl-10 pr-4 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center p-3 text-xs text-red-400 bg-red-500/10 rounded-lg border border-red-500/20 animate-[fadeIn_0.3s_ease-out]">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {message && (
            <div className="flex items-center p-3 text-xs text-green-400 bg-green-500/10 rounded-lg border border-green-500/20 animate-[fadeIn_0.3s_ease-out]">
              <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* Submit button */}
          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 h-9 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/40 hover:-translate-y-0.5"
            >
              {isLoading ? (
                "Sending..."
              ) : (
                <>
                  Send Reset Email
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-white/40">
          Remember your password?{" "}
          <Link href="/login" className="text-brand hover:text-brand-hover font-medium transition-colors">
            Log In
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
