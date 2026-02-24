/**
 * @module schemas/contact
 * @description Contact form validation schema.
 *
 * Separated from the main schemas bundle so the contact page
 * client component only pulls in what it needs (safeTextSchema + emailSchema).
 */

import { z } from "zod"
import { safeTextSchema, emailSchema } from "./base"

/**
 * Contact form request
 */
export const contactFormSchema = z.object({
  name: safeTextSchema.pipe(z.string().min(1, "Name is required").max(100, "Name is too long")),
  email: emailSchema,
  subject: safeTextSchema.pipe(z.string().min(1, "Subject is required").max(200, "Subject is too long")),
  message: safeTextSchema.pipe(z.string().min(10, "Message must be at least 10 characters").max(5000, "Message is too long (max 5000 characters)")),
})
