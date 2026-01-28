"use client"

import { useState, type FormEvent, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { setAuthCache } from "@/components/with-auth"
import { toast } from "sonner"
import { AlertCircle, Info, Shield, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import LoadingSpinner from "@/components/loading-spinner"
import { motion } from "framer-motion"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(false) // Don't block UI with loading state
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
      router.push("/")
      router.refresh()
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
        {/* Animated gradient orbs */}
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[#1d9bf0]/30 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 100, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-teal-500/20 blur-[100px]"
        />
        <motion.div
          animate={{
            x: [0, 60, 0],
            y: [0, 60, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/2 left-1/3 w-[300px] h-[300px] rounded-full bg-cyan-500/15 blur-[80px]"
        />

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Link href="/" className="flex items-center gap-3 mb-8 hover:opacity-80 transition-opacity">
              <div className="w-12 h-12 bg-gradient-to-br from-[#1d9bf0] to-[#1a8cd8] rounded-2xl flex items-center justify-center shadow-lg shadow-[#1d9bf0]/30">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-white font-semibold text-2xl">Clarus</span>
            </Link>
            <h2 className="text-4xl font-bold text-white mb-4">
              Welcome back
            </h2>
            <p className="text-white/50 text-lg max-w-md">
              Sign in to continue analyzing content and gaining clarity on what matters.
            </p>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-12 flex items-center gap-8"
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-white">10K+</div>
              <div className="text-white/40 text-sm">Content Analyzed</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">AI</div>
              <div className="text-white/40 text-sm">Advanced Analysis</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">Fast</div>
              <div className="text-white/40 text-sm">Processing</div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center justify-center gap-3 mb-8 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1d9bf0] to-[#1a8cd8] rounded-xl flex items-center justify-center shadow-lg shadow-[#1d9bf0]/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-xl">Clarus</span>
          </Link>

          {/* Header */}
          <div className="text-center lg:text-left mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Sign in</h1>
            <p className="text-white/50">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[#1d9bf0] hover:text-[#1a8cd8] font-medium transition-colors">
                Create one
              </Link>
            </p>
          </div>

          {accountExists && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center p-4 text-sm text-blue-400 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-6"
            >
              <Info className="w-5 h-5 mr-3 flex-shrink-0" />
              <span>An account with that email already exists. Please log in with your existing password.</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-white/70">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 pl-12 pr-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all outline-none"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-white/70">
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm text-[#1d9bf0] hover:text-[#1a8cd8] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-12 pl-12 pr-12 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center p-4 text-sm text-red-400 bg-red-500/10 rounded-xl border border-red-500/20"
              >
                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                "Signing in..."
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-white/30">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-white/50 hover:text-white/70 underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-white/50 hover:text-white/70 underline">
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
