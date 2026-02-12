"use client"

import { useState, type FormEvent, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsSessionReady(true)
      }
    })

    // Check if there's already a session when the component mounts
    async function checkSession() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setIsSessionReady(true)
      }
    }
    checkSession()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      toast.error("Passwords do not match.")
      return
    }

    if (password.length < 10) {
      setError("Password must be at least 10 characters long.")
      toast.error("Password must be at least 10 characters long.")
      return
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError("Password must include uppercase, lowercase, and a special character.")
      toast.error("Password must include uppercase, lowercase, and a special character.")
      return
    }

    setIsLoading(true)
    toast.info("Updating password...")

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setIsLoading(false)

    if (updateError) {
      setError(updateError.message)
      toast.error(`Error: ${updateError.message}`)
    } else {
      setMessage("Your password has been updated successfully! You can now log in with your new password.")
      toast.success("Password updated successfully!")
      setTimeout(() => {
        supabase.auth.signOut()
        router.push("/login")
      }, 3000)
    }
  }

  if (!isSessionReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-white/40 text-sm">Waiting for password recovery session...</div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-white mb-2">Update Your Password</h1>
          <p className="text-white/50 text-sm">
            Enter your new password below.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {/* Password field */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-medium text-white/70">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-10 pl-10 pr-10 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password field */}
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="block text-xs font-medium text-white/70">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full h-10 pl-10 pr-10 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
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
                "Updating..."
              ) : (
                <>
                  Update Password
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-white/40">
          <Link href="/login" className="text-brand hover:text-brand-hover font-medium transition-colors">
            Back to Log In
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
