export const WORTH_WATCHING_OPTIONS = [
  { label: "Skip", score: 0 },
  { label: "Maybe", score: 1 },
  { label: "Yes", score: 2 },
  { label: "Must Watch", score: 3 },
] as const

export type WorthWatchingScore = (typeof WORTH_WATCHING_OPTIONS)[number]["score"]

// Legacy alias for backwards compatibility
export const SIGNAL_NOISE_OPTIONS = WORTH_WATCHING_OPTIONS
export type SignalScore = WorthWatchingScore
