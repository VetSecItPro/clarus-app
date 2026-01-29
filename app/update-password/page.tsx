"use client"

import { useState, type FormEvent, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// import { getSupabaseBrowserClient } from "@/lib/supabase/client" // Remove this line
import { supabase } from "@/lib/supabase" // Add this line
import { toast } from "sonner"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const router = useRouter()
  // Remove: const supabase = getSupabaseBrowserClient()
  // The global `supabase` import will be used.

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === "PASSWORD_RECOVERY") {
        // This event is triggered when the user lands on this page after clicking the reset link.
        // The session is now available, and we can allow the password update.
        setIsSessionReady(true)
      }
    })

    // Check if there's already a session when the component mounts
    // This handles the case where the user is already in the password recovery flow
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

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      toast.error("Password must be at least 6 characters long.")
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
      // Optionally sign the user out and redirect to login
      setTimeout(() => {
        supabase.auth.signOut()
        router.push("/login")
      }, 3000)
    }
  }

  if (!isSessionReady) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-gray-300">
        <p>Waiting for password recovery session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1a1a1a] border-gray-700 text-gray-200">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-[#F0F0F0]">Update Your Password</CardTitle>
          <CardDescription className="text-center text-gray-400">Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-gray-800 border-gray-600 text-gray-200 focus:ring-gray-500 placeholder-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-gray-300">
                Confirm New Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-400">
            <Link href="/login" className="font-medium text-blue-400 hover:underline">
              Back to Log In
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
