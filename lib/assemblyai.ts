/**
 * AssemblyAI integration for podcast transcription with speaker diarization.
 * Two-phase pipeline: submit → webhook callback.
 */

const ASSEMBLYAI_API_URL = "https://api.assemblyai.com/v2/transcript"

interface SubmitTranscriptionResult {
  transcript_id: string
}

interface AssemblyAIUtterance {
  speaker: string
  text: string
  start: number
  end: number
}

interface AssemblyAIWebhookPayload {
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
 * Submit an audio URL to AssemblyAI for transcription.
 * Returns the transcript_id for tracking; the result arrives via webhook.
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
 * Format AssemblyAI webhook response into a readable transcript
 * with timestamps and speaker labels.
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

export type { AssemblyAIWebhookPayload, AssemblyAIUtterance }
