/**
 * @module schemas/subscriptions
 * @description Podcast and YouTube subscription validation schemas.
 */

import { z } from "zod"
import { safeUrlSchema } from "./base"

/**
 * Add podcast subscription request
 */
export const addPodcastSubscriptionSchema = z.object({
  feed_url: safeUrlSchema,
})

/**
 * Podcast episodes query params
 */
export const podcastEpisodesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * Add YouTube subscription request
 */
export const addYouTubeSubscriptionSchema = z.object({
  channel_url: safeUrlSchema,
})

/**
 * YouTube videos query params
 */
export const youtubeVideosQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})
