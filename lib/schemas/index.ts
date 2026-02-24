/**
 * @module schemas
 * @description Re-exports all schemas for backward compatibility.
 *
 * Existing imports like `import { parseBody } from "@/lib/schemas"` continue
 * to work through this barrel file. New code should import from the specific
 * sub-module (e.g., `@/lib/schemas/contact`) to enable better tree-shaking,
 * especially in client bundles.
 */

// Base schemas & helpers
export {
  uuidSchema,
  safeUrlSchema,
  emailSchema,
  usernameSchema,
  chatMessageSchema,
  safeTextSchema,
  htmlSafeSchema,
  contentTypeSchema,
  XSS_PATTERNS,
  parseBody,
  parseQuery,
} from "./base"

// Contact
export { contactFormSchema } from "./contact"

// Content
export {
  processContentSchema,
  searchSchema,
  tagsUpdateSchema,
  bookmarkUpdateSchema,
  shareContentSchema,
  exportSchema,
  compareContentSchema,
  fetchTitleSchema,
  translateContentSchema,
} from "./content"

// Chat
export { chatRequestSchema } from "./chat"

// Collections
export {
  COLLECTION_COLORS,
  createCollectionSchema,
  updateCollectionSchema,
  addToCollectionSchema,
} from "./collections"

// User
export {
  updateNameSchema,
  updatePreferencesSchema,
  digestPreferencesSchema,
} from "./user"

// Payments
export {
  checkoutSchema,
  polarCheckoutSchema,
} from "./payments"

// Subscriptions
export {
  addPodcastSubscriptionSchema,
  podcastEpisodesQuerySchema,
  addYouTubeSubscriptionSchema,
  youtubeVideosQuerySchema,
} from "./subscriptions"
