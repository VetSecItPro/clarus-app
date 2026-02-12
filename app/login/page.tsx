"use client"

import { useState, type FormEvent, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { setAuthCache } from "@/components/with-auth"
import { toast } from "sonner"
import { AlertCircle, Info, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const accountExists = searchParams.get("message") === "account_exists"

  useEffect(() => {
    // Check session in background - don't block rendering
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        router.replace("/")
      }
    }
    checkSession()
  }, [router])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setIsLoading(false)

    if (signInError) {
      setError(signInError.message)
      toast.error(`Login failed: ${signInError.message}`)
    } else if (data.session) {
      // Use session directly from signInWithPassword response (more reliable than getSession)
      const session = data.session

      type SubscriptionStatus = "active" | "trialing" | "grandfathered" | "canceled" | "none" | null
      let subscriptionStatus: SubscriptionStatus = null
      if (session?.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("subscription_status")
          .eq("id", session.user.id)
          .single()
        subscriptionStatus = (userData?.subscription_status as SubscriptionStatus) || "none"
      }

      // Set auth cache with session so homepage doesn't need to re-fetch
      setAuthCache(session, subscriptionStatus)
      toast.success("Login successful!")
      // Use replace instead of push to prevent back-button returning to login
      // Don't call router.refresh() — it races with navigation and can block redirect
      router.replace("/")
    } else {
      // Edge case: login succeeded but no session returned
      setError("Login succeeded but session not established. Please try again.")
      toast.error("Session error. Please try again.")
    }
  }

  // No loading spinner - render form immediately, redirect in background if logged in

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left side - Animated background (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Animated gradient orbs — CSS keyframes instead of framer-motion */}
        <div
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-brand/30 blur-[120px]"
          style={{ animation: "loginOrb1 20s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-teal-500/20 blur-[100px]"
          style={{ animation: "loginOrb2 25s ease-in-out infinite" }}
        />
        <div
          className="absolute top-1/2 left-1/3 w-[300px] h-[300px] rounded-full bg-cyan-500/15 blur-[80px]"
          style={{ animation: "loginOrb3 18s ease-in-out infinite" }}
        />

        {/* Content overlay */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-16 text-center animate-[fadeInUp_0.8s_ease-out]">
            <Link href="/" className="inline-block mb-10 hover:opacity-80 transition-opacity">
              <Image
                src="/clarus-email-logo-transparent.png"
                alt="Clarus"
                width={400}
                height={130}
                sizes="(max-width: 1024px) 0px, 400px"
                priority
                className="h-36 w-auto"
              />
            </Link>
            <h2 className="text-4xl font-bold text-white mb-4">
              Welcome back
            </h2>
            <p className="text-white/50 text-lg max-w-md">
              Sign in to continue analyzing content and gaining clarity on what matters.
            </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-xs animate-[fadeInUp_0.6s_ease-out]">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex justify-center mb-8 hover:opacity-80 transition-opacity">
            <Image
              src="/clarus-email-logo.png"
              alt="Clarus"
              width={140}
              height={48}
              sizes="140px"
              priority
              className="h-10 w-auto"
            />
          </Link>

          {/* Header */}
          <div className="text-center lg:text-left mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Sign in</h1>
            <p className="text-white/50 text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-brand hover:text-brand-hover font-medium transition-colors">
                Create one
              </Link>
            </p>
          </div>

          {accountExists && (
            <div className="flex items-center p-3 text-xs text-blue-400 bg-blue-500/10 rounded-lg border border-blue-500/20 mb-4 animate-[fadeIn_0.3s_ease-out]">
              <Info className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>An account with that email already exists. Please log in with your existing password.</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
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

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-medium text-white/70">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-brand hover:text-brand-hover transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
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

            {/* Error message */}
            {error && (
              <div className="flex items-center p-3 text-xs text-red-400 bg-red-500/10 rounded-lg border border-red-500/20 animate-[fadeIn_0.3s_ease-out]">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{error}</span>
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
                  "Signing in..."
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-[0.625rem] text-white/30">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-white/50 hover:text-white/70 underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-white/50 hover:text-white/70 underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes loginOrb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(100px, -50px) scale(1.2); }
        }
        @keyframes loginOrb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-80px, 100px) scale(1.3); }
        }
        @keyframes loginOrb3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(60px, 60px); }
        }
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
