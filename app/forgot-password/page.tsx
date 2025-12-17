"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// import { getSupabaseBrowserClient } from "@/lib/supabase/client" // Remove this line
import { supabase } from "@/lib/supabase" // Add this line
import { toast } from "sonner"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  // Remove: const supabase = getSupabaseBrowserClient()
  // The global `supabase` import will be used.

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
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1a1a1a] border-gray-700 text-gray-200">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-[#F0F0F0]">Forgot Password</CardTitle>
          <CardDescription className="text-center text-gray-400">
            Enter your email to receive a password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-800 border-gray-600 text-gray-200 focus:ring-gray-500 placeholder-gray-500"
              />
            </div>

            {error && (
              <div className="flex items-center p-3 text-sm text-red-400 bg-red-900/30 rounded-md border border-red-700/50">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="flex items-center p-3 text-sm text-green-400 bg-green-900/30 rounded-md border border-green-700/50">
                <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <Button type="submit" className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Email"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-400">
            Remember your password?{" "}
            <Link href="/login" className="font-medium text-blue-400 hover:underline">
              Log In
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
