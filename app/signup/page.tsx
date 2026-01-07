"use client"

import { useState, type FormEvent, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, Shield, Mail, Lock, Eye, EyeOff, ArrowRight, User, Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

function PasswordStrengthIndicator({ password }: { password: string }) {
  const requirements = useMemo(() => ({
    minLength: password.length >= 10,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  }), [password])

  const metCount = Object.values(requirements).filter(Boolean).length

  const getStrengthLabel = () => {
    if (metCount === 0) return "Too weak"
    if (metCount === 1) return "Weak"
    if (metCount === 2) return "Fair"
    if (metCount === 3) return "Good"
    return "Strong"
  }

  const getStrengthColor = () => {
    if (metCount === 0) return "bg-white/20"
    if (metCount === 1) return "bg-red-500"
    if (metCount === 2) return "bg-yellow-500"
    if (metCount === 3) return "bg-blue-500"
    return "bg-green-500"
  }

  const requirementsList = [
    { key: 'minLength', label: 'At least 10 characters', met: requirements.minLength },
    { key: 'hasUppercase', label: 'One uppercase letter', met: requirements.hasUppercase },
    { key: 'hasLowercase', label: 'One lowercase letter', met: requirements.hasLowercase },
    { key: 'hasSpecial', label: 'One special character (!@#$%...)', met: requirements.hasSpecial },
  ]

  return (
    <div className="mt-3 space-y-3">
      {/* Strength bar */}
      <div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                level <= metCount ? getStrengthColor() : "bg-white/10"
              }`}
            />
          ))}
        </div>
        {password && (
          <p className={`text-xs mt-1.5 font-medium ${metCount <= 1 ? "text-red-400" : metCount === 2 ? "text-yellow-400" : metCount === 3 ? "text-blue-400" : "text-green-400"}`}>
            {getStrengthLabel()}
          </p>
        )}
      </div>

      {/* Requirements checklist */}
      <div className="space-y-1.5">
        {requirementsList.map((req) => (
          <div key={req.key} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
              req.met ? "bg-green-500/20" : "bg-white/5"
            }`}>
              {req.met ? (
                <CheckCircle2 className="w-3 h-3 text-green-400" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              )}
            </div>
            <span className={`text-xs transition-colors duration-200 ${
              req.met ? "text-green-400" : "text-white/40"
            }`}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SuccessOverlay({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2, duration: 0.5 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.4, duration: 0.4 }}
          >
            <Check className="w-10 h-10 text-green-400" />
          </motion.div>
        </motion.div>
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-2xl font-bold text-white mb-2"
        >
          Account Created!
        </motion.h2>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-white/50"
        >
          Check your email to verify your account
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

export default function SignUpPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!agreeToTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy.")
      toast.error("Please agree to the terms.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      toast.error("Passwords do not match.")
      return
    }

    // Password complexity validation
    const passwordErrors: string[] = []
    if (password.length < 10) {
      passwordErrors.push("at least 10 characters")
    }
    if (!/[A-Z]/.test(password)) {
      passwordErrors.push("one uppercase letter")
    }
    if (!/[a-z]/.test(password)) {
      passwordErrors.push("one lowercase letter")
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      passwordErrors.push("one special character")
    }

    if (passwordErrors.length > 0) {
      const errorMsg = `Password must contain ${passwordErrors.join(", ")}.`
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    setIsLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/`,
        data: {
          name: name,
        },
      },
    })

    setIsLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      toast.error(`Sign up failed: ${signUpError.message}`)
    } else if (data.user) {
      if (!data.user.identities || data.user.identities.length === 0) {
        toast.info("An account with this email already exists.")
        setTimeout(() => {
          router.push("/login?message=account_exists")
        }, 1500)
        return
      }

      setShowSuccess(true)
    } else {
      setError("An unexpected issue occurred during sign up. Please try again.")
      toast.error("An unexpected issue occurred during sign up.")
    }
  }

  const handleSuccessComplete = () => {
    router.push("/login")
  }

  // No loading spinner - render form immediately, redirect in background if logged in

  return (
    <>
      <AnimatePresence>
        {showSuccess && <SuccessOverlay onComplete={handleSuccessComplete} />}
      </AnimatePresence>

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
                <span className="text-white font-semibold text-2xl">Truth Checker</span>
              </Link>
              <h2 className="text-4xl font-bold text-white mb-4">
                Start your journey to{" "}
                <span className="gradient-text">truth</span>
              </h2>
              <p className="text-white/50 text-lg max-w-md">
                Join thousands of users who trust us to verify content and fight misinformation.
              </p>
            </motion.div>

            {/* Features list */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-12 space-y-4"
            >
              {[
                "Analyze YouTube videos, articles & X posts",
                "Fast AI-powered fact-checking and analysis",
                "Get signal-to-noise ratings for any content",
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#1d9bf0]/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-[#1d9bf0]" />
                  </div>
                  <span className="text-white/60">{feature}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Right side - Signup form */}
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
              <span className="text-white font-semibold text-xl">Truth Checker</span>
            </Link>

            {/* Header */}
            <div className="text-center lg:text-left mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Create account</h1>
              <p className="text-white/50">
                Already have an account?{" "}
                <Link href="/login" className="text-[#1d9bf0] hover:text-[#1a8cd8] font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSignUp} className="space-y-5">
              {/* Name field */}
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-white/70">
                  Full name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full h-12 pl-12 pr-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all outline-none"
                  />
                </div>
              </div>

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
                <label htmlFor="password" className="block text-sm font-medium text-white/70">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
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
                <PasswordStrengthIndicator password={password} />
              </div>

              {/* Confirm password field */}
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="block text-sm font-medium text-white/70">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full h-12 pl-12 pr-12 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords don&apos;t match</p>
                )}
              </div>

              {/* Terms checkbox */}
              <div className="flex items-start gap-3">
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-white/20 bg-white/[0.04] text-[#1d9bf0] focus:ring-[#1d9bf0] focus:ring-offset-0 focus:ring-1"
                />
                <label htmlFor="terms" className="text-sm text-white/50">
                  I agree to the{" "}
                  <Link href="/terms" className="text-[#1d9bf0] hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-[#1d9bf0] hover:underline">
                    Privacy Policy
                  </Link>
                </label>
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
                disabled={isLoading || !agreeToTerms}
                className="w-full h-12 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  "Creating account..."
                ) : (
                  <>
                    Create account
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

          </motion.div>
        </div>
      </div>
    </>
  )
}
