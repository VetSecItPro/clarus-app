"use client"

import { useState, type FormEvent, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle, Info } from "lucide-react"
import LoadingSpinner from "@/components/loading-spinner"
import { BlueCheckLogo } from "@/components/blue-check-logo"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  const accountExists = searchParams.get("message") === "account_exists"

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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)
    toast.info("Attempting to log in...")

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setIsLoading(false)

    if (signInError) {
      setError(signInError.message)
      toast.error(`Login failed: ${signInError.message}`)
    } else {
      toast.success("Login successful! Redirecting...")
      router.push("/")
      router.refresh()
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

        {accountExists && (
          <div className="w-full flex items-center p-3 text-sm text-blue-400 bg-blue-500/10 rounded-xl border border-blue-500/20 backdrop-blur-xl mb-6">
            <Info className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>An account with that email already exists. Please log in with your existing password.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="w-full space-y-6">
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-neutral-300">
                Password
              </Label>
              <Link href="/forgot-password" className="text-xs text-[#1d9bf0] hover:underline">
                Forgot Password?
              </Link>
            </div>
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

          {error && (
            <div className="flex items-center p-3 text-sm text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 backdrop-blur-xl">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Logging In..." : "Log In"}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-8 flex flex-col items-center space-y-2">
          <p className="text-sm text-neutral-400">
            Don't have an account?{" "}
            <Link href="/signup" className="font-medium text-[#1d9bf0] hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
