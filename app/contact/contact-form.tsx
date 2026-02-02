"use client"

import { useState } from "react"
import { contactFormSchema } from "@/lib/schemas"
import { Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

type FormState = "idle" | "submitting" | "success" | "error"

export function ContactForm() {
  const [formState, setFormState] = useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})
    setErrorMessage("")

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
    }

    // Client-side validation
    const result = contactFormSchema.safeParse(data)
    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (field && !errors[String(field)]) {
          errors[String(field)] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }

    setFormState("submitting")

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      })

      if (response.status === 429) {
        setFormState("error")
        setErrorMessage("Too many submissions. Please try again later.")
        return
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setFormState("error")
        setErrorMessage(body?.error ?? "Something went wrong. Please try again.")
        return
      }

      setFormState("success")
    } catch {
      setFormState("error")
      setErrorMessage("Network error. Please check your connection and try again.")
    }
  }

  if (formState === "success") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Message sent</h2>
        <p className="text-white/40">We&apos;ll get back to you as soon as possible.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Name" name="name" type="text" placeholder="Your name" error={fieldErrors.name} disabled={formState === "submitting"} />
      <Field label="Email" name="email" type="email" placeholder="you@example.com" error={fieldErrors.email} disabled={formState === "submitting"} />
      <Field label="Subject" name="subject" type="text" placeholder="What is this about?" error={fieldErrors.subject} disabled={formState === "submitting"} />

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-white/40 mb-1.5">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder="Your message (min 10 characters)"
          disabled={formState === "submitting"}
          className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#1d9bf0]/50 focus:border-[#1d9bf0]/50 disabled:opacity-50 resize-y min-h-[120px]"
        />
        {fieldErrors.message && (
          <p className="mt-1 text-sm text-red-400">{fieldErrors.message}</p>
        )}
      </div>

      {formState === "error" && errorMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={formState === "submitting"}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {formState === "submitting" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send Message
          </>
        )}
      </button>
    </form>
  )
}

function Field({
  label,
  name,
  type,
  placeholder,
  error,
  disabled,
}: {
  label: string
  name: string
  type: string
  placeholder: string
  error?: string
  disabled: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-white/40 mb-1.5">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#1d9bf0]/50 focus:border-[#1d9bf0]/50 disabled:opacity-50"
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
