"use client"

import { useState, type FormEvent, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import LoadingSpinner from "@/components/loading-spinner"
import { BlueCheckLogo } from "@/components/blue-check-logo"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        router.replace("/")
      } else {
        setAuthLoading(false)
      }
    }
    checkSession()
  }, [router])

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      toast.error("Passwords do not match.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      toast.error("Password must be at least 6 characters long.")
      return
    }

    setIsLoading(true)
    toast.info("Attempting to sign up...")

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/`,
      },
    })

    setIsLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      toast.error(`Sign up failed: ${signUpError.message}`)
    } else if (data.user) {
      if (!data.user.identities || data.user.identities.length === 0) {
        // Email already exists - redirect to login
        toast.info("An account with this email already exists. Redirecting to login...")
        setTimeout(() => {
          router.push("/login?message=account_exists")
        }, 1500)
        return
      }

      if (!data.user.email_confirmed_at) {
        setSuccessMessage("Sign up successful! Please check your email to confirm your account.")
        toast.success("Sign up successful! Please check your email for a confirmation link.")
      } else {
        setSuccessMessage("Sign up successful! You can now log in.")
        toast.success("Sign up successful! You can now log in.")
      }
      setEmail("")
      setPassword("")
      setConfirmPassword("")
    } else {
      setError("An unexpected issue occurred during sign up. Please try again.")
      toast.error("An unexpected issue occurred during sign up.")
    }
  }

  if (authLoading) {
    return <LoadingSpinner message="Checking session..." />
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8">
          <BlueCheckLogo size={80} />
        </div>

        {/* Header */}
        <h1 className="text-2xl font-bold text-center text-white mb-2">Truth Checker</h1>
        <p className="text-center text-neutral-500 text-sm mb-8">by Vajra Labs</p>

        {/* Form with liquid glass styling */}
        <form onSubmit={handleSignUp} className="w-full space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-neutral-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#1d9bf0] focus:ring-[#1d9bf0] placeholder-neutral-500 backdrop-blur-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-neutral-300">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#1d9bf0] focus:ring-[#1d9bf0] placeholder-neutral-500 backdrop-blur-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-neutral-300">
              Confirm Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#1d9bf0] focus:ring-[#1d9bf0] placeholder-neutral-500 backdrop-blur-xl"
            />
          </div>

          {error && (
            <div className="flex items-center p-3 text-sm text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 backdrop-blur-xl">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center p-3 text-sm text-green-400 bg-green-500/10 rounded-xl border border-green-500/20 backdrop-blur-xl">
              <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing Up...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-8 flex flex-col items-center space-y-2">
          <p className="text-sm text-neutral-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#1d9bf0] hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
