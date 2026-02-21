/**
 * @module deepgram
 * @description Deepgram Nova-3 integration for podcast transcription with speaker diarization.
 *
 * Implements a two-phase pipeline:
 * 1. **Submit** -- POST the audio URL to Deepgram with webhook callback
 * 2. **Webhook** -- Receive the completed transcript, format with speaker labels
 *
 * Speaker diarization is enabled by default to attribute statements to
 * individual speakers, which is critical for accurate claim attribution
 * in the analysis pipeline.
 *
 * @see {@link lib/utils.ts} isPodcastUrl for URL detection that routes to this pipeline
 * @see {@link lib/api-usage.ts} for cost tracking (billed per second of audio)
 */

const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"

interface SubmitTranscriptionResult {
  transcript_id: string
}

/** Options for podcast transcription submission. */
export interface TranscriptionOptions {
  /** Decrypted Authorization header for private/premium podcast audio. */
  feedAuthHeader?: string
}

/** A single speaker utterance from Deepgram's diarization output. */
export interface DeepgramUtterance {
  speaker: number
  transcript: string
  start: number
  end: number
}

/**
 * The payload received from Deepgram via webhook when transcription completes.
 * Also re-exported for use by the webhook API route handler.
 */
export interface DeepgramCallbackPayload {
  request_id: string
  metadata: {
    duration: number
    channels: number
    models: string[]
  }
  results: {
    utterances?: DeepgramUtterance[]
  }
  err_code?: number
  err_msg?: string
}

interface FormattedTranscript {
  full_text: string
  duration_seconds: number
  speaker_count: number
}

/**
 * Submits an audio URL to Deepgram for asynchronous transcription.
 *
 * The transcription runs asynchronously on Deepgram's servers. When
 * complete, Deepgram sends the result to the provided webhook URL.
 * Speaker diarization, utterance grouping, smart formatting, and
 * language detection are enabled by default.
 *
 * For private/premium feeds: when `options.feedAuthHeader` is provided,
 * the audio is first downloaded with credentials, then the raw bytes
 * are sent directly to Deepgram (which accepts audio in the POST body).
 *
 * @param audioUrl - The URL of the audio file
 * @param webhookUrl - The URL Deepgram should POST the result to when complete
 * @param apiKey - The Deepgram API key
 * @param options - Optional settings for private feed authentication
 * @returns An object containing the `transcript_id` for tracking
 * @throws Error if the Deepgram API returns a non-200 response
 */
export async function submitPodcastTranscription(
  audioUrl: string,
  webhookUrl: string,
  apiKey: string,
  options?: TranscriptionOptions,
): Promise<SubmitTranscriptionResult> {
  const queryParams = new URLSearchParams({
    model: "nova-3",
    diarize: "true",
    utterances: "true",
    smart_format: "true",
    detect_language: "true",
    callback: webhookUrl,
  })

  const apiUrl = `${DEEPGRAM_API_URL}?${queryParams.toString()}`

  let response: Response

  if (options?.feedAuthHeader) {
    // Private feed: download audio with credentials, send raw bytes to Deepgram
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 min for large audio files

    try {
      const audioResponse = await fetch(audioUrl, {
        signal: controller.signal,
        headers: {
          Authorization: options.feedAuthHeader,
          "User-Agent": "Clarus/1.0 (Podcast Transcription)",
        },
      })

      if (!audioResponse.ok) {
        throw new Error(
          `Failed to download private audio (HTTP ${audioResponse.status}): ${audioUrl}`,
        )
      }

      if (!audioResponse.body) {
        throw new Error("Audio response has no body to stream")
      }

      response = await fetch(apiUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "audio/mpeg",
        },
        body: audioResponse.body,
        // @ts-expect-error -- Node fetch supports duplex for streaming request bodies
        duplex: "half",
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } else {
    // Public URL: send JSON body with the URL for Deepgram to fetch
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioUrl }),
    })
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Deepgram submission failed (${response.status}): ${errorText}`,
    )
  }

  const data = await response.json()
  return { transcript_id: data.request_id }
}

/**
 * Formats a Deepgram callback payload into a readable transcript
 * with timestamps and speaker labels.
 *
 * Each utterance is formatted as `[MM:SS] Speaker A: text` with
 * double newlines between utterances for readability.
 *
 * Deepgram uses integer speaker IDs (0, 1, 2) which are mapped to
 * letters (A, B, C) via String.fromCharCode(65 + speaker).
 *
 * @param payload - The callback payload from Deepgram
 * @returns A formatted transcript with full text, duration, and speaker count
 */
export function formatTranscript(
  payload: DeepgramCallbackPayload,
): FormattedTranscript {
  const utterances = payload.results.utterances || []
  const speakers = new Set<number>()

  const lines = utterances.map((u) => {
    speakers.add(u.speaker)
    const timestamp = formatSeconds(u.start)
    const speakerLabel = String.fromCharCode(65 + u.speaker)
    return `[${timestamp}] Speaker ${speakerLabel}: ${u.transcript}`
  })

  return {
    full_text: lines.join("\n\n"),
    duration_seconds: Math.round(payload.metadata.duration || 0),
    speaker_count: speakers.size,
  }
}

/** Convert seconds to MM:SS or H:MM:SS */
function formatSeconds(totalSecondsRaw: number): string {
  const totalSeconds = Math.floor(totalSecondsRaw)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
