export const SIGNAL_NOISE_OPTIONS = [
  { emoji: "🗑️", label: "Noise", score: 0 },
  { emoji: "⚡", label: "Noteworthy", score: 1 },
  { emoji: "⚡⚡", label: "Insightful", score: 2 },
  { emoji: "⚡⚡⚡", label: "Mind-blowing", score: 3 },
] as const

export type SignalScore = (typeof SIGNAL_NOISE_OPTIONS)[number]["score"]
