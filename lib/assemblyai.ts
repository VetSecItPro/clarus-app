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

interface SubmitTranscriptionResult {
  transcript_id: string
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
 * Submits an audio URL to AssemblyAI for asynchronous transcription.
 *
 * The transcription runs asynchronously on AssemblyAI's servers. When
 * complete, AssemblyAI sends the result to the provided webhook URL.
 * Speaker diarization and language detection are enabled by default.
 *
 * @param audioUrl - The publicly accessible URL of the audio file
 * @param webhookUrl - The URL AssemblyAI should POST the result to when complete
 * @param apiKey - The AssemblyAI API key
 * @returns An object containing the `transcript_id` for tracking
 * @throws Error if the AssemblyAI API returns a non-200 response
 *
 * @example
 * ```ts
 * const { transcript_id } = await submitPodcastTranscription(
 *   audioUrl,
 *   `${process.env.NEXT_PUBLIC_APP_URL}/api/assemblyai-webhook`,
 *   process.env.ASSEMBLYAI_API_KEY!
 * )
 * // Store transcript_id for matching when webhook arrives
 * ```
 */
export async function submitPodcastTranscription(
  audioUrl: string,
  webhookUrl: string,
  apiKey: string,
): Promise<SubmitTranscriptionResult> {
  const response = await fetch(ASSEMBLYAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
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
