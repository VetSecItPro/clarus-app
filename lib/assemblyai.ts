/**
 * @module assemblyai
 * @description AssemblyAI integration for podcast transcription with speaker diarization.
 *
 * Implements a two-phase pipeline:
 * 1. **Submit** -- POST the audio URL to AssemblyAI with webhook callback
 * 2. **Webhook** -- Receive the completed transcript, format with speaker labels
 *
 * Speaker diarization is enabled by default to attribute statements to
 * individual speakers, which is critical for accurate claim attribution
 * in the analysis pipeline.
 *
 * @see {@link lib/utils.ts} isPodcastUrl for URL detection that routes to this pipeline
 * @see {@link lib/api-usage.ts} for cost tracking (billed per second of audio)
 */

const ASSEMBLYAI_API_URL = "https://api.assemblyai.com/v2/transcript"
const ASSEMBLYAI_UPLOAD_URL = "https://api.assemblyai.com/v2/upload"

interface SubmitTranscriptionResult {
  transcript_id: string
}

/** Options for podcast transcription submission. */
export interface TranscriptionOptions {
  /** Decrypted Authorization header for private/premium podcast audio. */
  feedAuthHeader?: string
}

/** A single speaker utterance from AssemblyAI's diarization output. */
export interface AssemblyAIUtterance {
  speaker: string
  text: string
  start: number
  end: number
}

/**
 * The payload received from AssemblyAI via webhook when transcription completes.
 * Also re-exported for use by the webhook API route handler.
 */
export interface AssemblyAIWebhookPayload {
  transcript_id: string
  status: "completed" | "error"
  error?: string
  utterances?: AssemblyAIUtterance[]
  audio_duration?: number
}

interface FormattedTranscript {
  full_text: string
  duration_seconds: number
  speaker_count: number
}

/**
 * Downloads audio from an authenticated URL and uploads it to AssemblyAI's
 * upload endpoint, returning a temporary public URL that AssemblyAI can access.
 *
 * This is necessary for private/premium podcast feeds where the audio URL
 * requires an Authorization header — AssemblyAI can't send custom headers
 * when fetching audio_url directly.
 *
 * The audio is streamed (piped) to avoid buffering entire podcast files
 * (often 50-200MB) in memory.
 *
 * @param audioUrl - The private audio URL requiring authentication
 * @param authHeader - The Authorization header value (e.g., "Bearer xxx")
 * @param apiKey - The AssemblyAI API key
 * @returns A temporary AssemblyAI-hosted URL for the uploaded audio
 */
async function uploadAudioForTranscription(
  audioUrl: string,
  authHeader: string,
  apiKey: string,
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 min for large audio files

  try {
    // Download the audio with credentials
    const audioResponse = await fetch(audioUrl, {
      signal: controller.signal,
      headers: {
        Authorization: authHeader,
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

    // Upload to AssemblyAI's upload endpoint, streaming the body directly
    const uploadResponse = await fetch(ASSEMBLYAI_UPLOAD_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/octet-stream",
        "Transfer-Encoding": "chunked",
      },
      body: audioResponse.body,
      // @ts-expect-error -- Node fetch supports duplex for streaming request bodies
      duplex: "half",
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(
        `AssemblyAI upload failed (${uploadResponse.status}): ${errorText}`,
      )
    }

    const data = await uploadResponse.json() as { upload_url: string }
    return data.upload_url
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Submits an audio URL to AssemblyAI for asynchronous transcription.
 *
 * The transcription runs asynchronously on AssemblyAI's servers. When
 * complete, AssemblyAI sends the result to the provided webhook URL.
 * Speaker diarization and language detection are enabled by default.
 *
 * For private/premium feeds: when `options.feedAuthHeader` is provided,
 * the audio is first downloaded with credentials and uploaded to AssemblyAI's
 * upload endpoint, then the temporary hosted URL is used for transcription.
 *
 * @param audioUrl - The URL of the audio file
 * @param webhookUrl - The URL AssemblyAI should POST the result to when complete
 * @param apiKey - The AssemblyAI API key
 * @param options - Optional settings for private feed authentication
 * @returns An object containing the `transcript_id` for tracking
 * @throws Error if the AssemblyAI API returns a non-200 response
 */
export async function submitPodcastTranscription(
  audioUrl: string,
  webhookUrl: string,
  apiKey: string,
  options?: TranscriptionOptions,
): Promise<SubmitTranscriptionResult> {
  // For private feeds, proxy through AssemblyAI's upload endpoint
  const resolvedAudioUrl = options?.feedAuthHeader
    ? await uploadAudioForTranscription(audioUrl, options.feedAuthHeader, apiKey)
    : audioUrl

  const response = await fetch(ASSEMBLYAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: resolvedAudioUrl,
      speaker_labels: true,
      language_detection: true,
      webhook_url: webhookUrl,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `AssemblyAI submission failed (${response.status}): ${errorText}`,
    )
  }

  const data = await response.json()
  return { transcript_id: data.id }
}

/**
 * Formats an AssemblyAI webhook payload into a readable transcript
 * with timestamps and speaker labels.
 *
 * Each utterance is formatted as `[MM:SS] Speaker A: text` with
 * double newlines between utterances for readability.
 *
 * @param payload - The webhook payload from AssemblyAI
 * @returns A formatted transcript with full text, duration, and speaker count
 */
export function formatTranscript(
  payload: AssemblyAIWebhookPayload,
): FormattedTranscript {
  const utterances = payload.utterances || []
  const speakers = new Set<string>()

  const lines = utterances.map((u) => {
    speakers.add(u.speaker)
    const timestamp = formatMs(u.start)
    return `[${timestamp}] Speaker ${u.speaker}: ${u.text}`
  })

  return {
    full_text: lines.join("\n\n"),
    duration_seconds: Math.round((payload.audio_duration || 0)),
    speaker_count: speakers.size,
  }
}

/** Convert milliseconds to MM:SS or H:MM:SS */
function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
