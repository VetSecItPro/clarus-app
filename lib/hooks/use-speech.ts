/**
 * @module use-speech
 * @description Web Speech API hooks for voice input and text-to-speech.
 *
 * Provides two complementary hooks:
 *   - {@link useSpeechToText} -- microphone input via the SpeechRecognition API
 *   - {@link useTextToSpeech} -- spoken output via the SpeechSynthesis API
 *
 * Both hooks detect browser support at mount time and expose an `isSupported`
 * flag so the UI can conditionally render voice controls. Error messages are
 * mapped to user-friendly strings (e.g., "Microphone access denied").
 *
 * The speech-to-text hook supports both single-utterance and continuous
 * modes. In continuous mode, final transcripts accumulate across pauses
 * and the combined result is delivered via `onResult` when the user stops.
 */

"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// ============================================
// Web Speech API Type Declarations
// ============================================

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

// ============================================
// Speech-to-Text Hook (Web Speech API)
// ============================================

/** Configuration options for {@link useSpeechToText}. */
interface UseSpeechToTextOptions {
  onResult?: (transcript: string) => void
  onError?: (error: string) => void
  continuous?: boolean
  language?: string
}

interface UseSpeechToTextReturn {
  isListening: boolean
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  transcript: string
}

/**
 * Provides speech-to-text functionality via the Web Speech Recognition API.
 *
 * In non-continuous mode, each recognized utterance fires `onResult` immediately.
 * In continuous mode, transcripts accumulate until `stopListening` is called,
 * then the full accumulated text is delivered via `onResult`.
 *
 * The `transcript` state always reflects the latest recognized text (including
 * interim results) for real-time display in the UI.
 *
 * @param options - Configuration for callbacks, language, and continuous mode
 * @returns State and controls for the speech recognition session
 */
export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const { onResult, onError, continuous = false, language = "en-US" } = options
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState("")
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const accumulatedTranscriptRef = useRef("")

  // Use refs for callbacks to avoid recreating recognition on every render
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)
  const continuousRef = useRef(continuous)

  // Keep refs updated
  useEffect(() => {
    onResultRef.current = onResult
    onErrorRef.current = onError
    continuousRef.current = continuous
  }, [onResult, onError, continuous])

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = continuous
      recognition.interimResults = true
      recognition.lang = language

      recognition.onresult = (event) => {
        let finalTranscript = ""
        let interimTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimTranscript += result[0].transcript
          }
        }

        // In continuous mode, accumulate final transcripts
        if (continuousRef.current && finalTranscript) {
          accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? " " : "") + finalTranscript.trim()
        }

        // Show accumulated + current interim for continuous, or just current for non-continuous
        const displayTranscript = continuousRef.current
          ? accumulatedTranscriptRef.current + (interimTranscript ? " " + interimTranscript : "")
          : finalTranscript || interimTranscript

        setTranscript(displayTranscript.trim())

        // In non-continuous mode, fire onResult for each final
        if (!continuousRef.current && finalTranscript && onResultRef.current) {
          onResultRef.current(finalTranscript)
        }
      }

      recognition.onerror = (event) => {
        setIsListening(false)

        // Map error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          "not-allowed": "Microphone access denied. Please allow microphone in browser settings.",
          "service-not-allowed": "Speech recognition not available in this browser.",
          "no-speech": "No speech detected. Please try again.",
          "audio-capture": "No microphone found. Please connect a microphone.",
          "network": "Network error. Please check your connection.",
          "aborted": "", // Silently ignore aborted (user cancelled)
        }

        const message = errorMessages[event.error]

        // Only fire callback with user-friendly message (skip aborted)
        if (message && onErrorRef.current) {
          onErrorRef.current(message)
        }
      }

      recognition.onend = () => {
        // In continuous mode, fire onResult with accumulated transcript when stopped
        if (continuousRef.current && accumulatedTranscriptRef.current && onResultRef.current) {
          onResultRef.current(accumulatedTranscriptRef.current)
        }
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [continuous, language]) // Only recreate when continuous or language changes

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("")
      accumulatedTranscriptRef.current = "" // Reset accumulated transcript
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (error) {
        console.error("Error starting speech recognition:", error)
      }
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    transcript,
  }
}

// ============================================
// Text-to-Speech Hook (Web Speech API)
// ============================================

/** Configuration options for {@link useTextToSpeech}. */
interface UseTextToSpeechOptions {
  rate?: number
  pitch?: number
  volume?: number
  voice?: string
}

interface UseTextToSpeechReturn {
  isSpeaking: boolean
  isSupported: boolean
  speak: (text: string) => void
  stop: () => void
  voices: SpeechSynthesisVoice[]
}

/**
 * Provides text-to-speech functionality via the Web SpeechSynthesis API.
 *
 * Loads available voices at mount time and exposes them for voice selection.
 * Defaults to a high-quality English voice (Google or Samantha) if available.
 * Cancels any ongoing speech when a new `speak` call is made or on unmount.
 *
 * @param options - Configuration for rate, pitch, volume, and preferred voice
 * @returns State and controls for the speech synthesis session
 */
export function useTextToSpeech(options: UseTextToSpeechOptions = {}): UseTextToSpeechReturn {
  const { rate = 1, pitch = 1, volume = 1, voice } = options
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window)

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // Load voices
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices()
        setVoices(availableVoices)
      }

      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text) return

      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = rate
      utterance.pitch = pitch
      utterance.volume = volume

      // Find preferred voice
      if (voice) {
        const selectedVoice = voices.find((v) => v.name === voice || v.lang === voice)
        if (selectedVoice) {
          utterance.voice = selectedVoice
        }
      } else {
        // Default to a good English voice if available
        const englishVoice = voices.find(
          (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Samantha") || v.default)
        )
        if (englishVoice) {
          utterance.voice = englishVoice
        }
      }

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [isSupported, rate, pitch, volume, voice, voices]
  )

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [isSupported])

  return {
    isSpeaking,
    isSupported,
    speak,
    stop,
    voices,
  }
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}
