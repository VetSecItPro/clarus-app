"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Youtube,
  FileText,
  Headphones,
  FileUp,
  MessageSquare,
  Library,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const ONBOARDING_KEY = "clarus_onboarding_completed"

interface OnboardingStep {
  title: string
  description: string
  features: Array<{
    icon: React.ComponentType<{ className?: string }>
    label: string
    detail: string
  }>
}

const steps: OnboardingStep[] = [
  {
    title: "Welcome to Clarus",
    description:
      "Get instant clarity on any content. Paste a URL, and we'll break it down — fact-check claims, extract key points, and give you the full picture.",
    features: [
      { icon: Youtube, label: "YouTube Videos", detail: "Full transcript analysis" },
      { icon: FileText, label: "Articles", detail: "Web articles & news" },
      { icon: Headphones, label: "Podcasts", detail: "Episode transcription & analysis" },
      { icon: FileUp, label: "PDFs", detail: "Document upload & analysis" },
    ],
  },
  {
    title: "Your Analysis Toolkit",
    description:
      "Every analysis gives you six detailed sections — from a quick overview to deep fact-checking with source citations.",
    features: [
      { icon: Sparkles, label: "Truth Check", detail: "Fact-check claims with sources" },
      { icon: MessageSquare, label: "Chat", detail: "Ask follow-up questions about any content" },
      { icon: Library, label: "Library", detail: "Save & organize everything you analyze" },
    ],
  },
]

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return true
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "true"
  } catch {
    return true
  }
}

function markOnboardingComplete() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "true")
  } catch {
    // localStorage unavailable
  }
}

interface WelcomeOnboardingProps {
  username?: string | null
  onComplete: () => void
}

export function WelcomeOnboarding({ username, onComplete }: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      markOnboardingComplete()
      onComplete()
    }
  }, [currentStep, onComplete])

  const handleSkip = useCallback(() => {
    markOnboardingComplete()
    onComplete()
  }, [onComplete])

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Clarus"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 sm:p-8 shadow-2xl"
      >
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Skip onboarding"
        >
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= currentStep ? "bg-brand" : "bg-white/10"
                  }`}
                />
              ))}
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2">
              {currentStep === 0 && username
                ? `Welcome to Clarus, ${username}`
                : step.title}
            </h2>

            {/* Description */}
            <p className="text-white/50 text-sm sm:text-base mb-6 leading-relaxed">
              {step.description}
            </p>

            {/* Feature cards */}
            <div className="space-y-3 mb-8">
              {step.features.map(({ icon: Icon, label, detail }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-brand" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{label}</div>
                    <div className="text-xs text-white/40">{detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Skip
          </button>
          <Button onClick={handleNext} className="gap-1.5">
            {isLastStep ? "Get Started" : "Next"}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
