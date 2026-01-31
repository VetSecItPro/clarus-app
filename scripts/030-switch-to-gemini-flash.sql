-- Migration: Switch all AI models from Claude to Gemini 2.5 Flash
-- Run this against the live database to update all prompt model references
-- Date: 2026-01-30

SET search_path TO clarus, public, extensions;

-- Update all analysis prompts to use Gemini 2.5 Flash
UPDATE analysis_prompts
SET model_name = 'google/gemini-2.5-flash',
    updated_at = now()
WHERE model_name LIKE 'anthropic/%';

-- Update the summarizer prompt
UPDATE active_summarizer_prompt
SET model_name = 'google/gemini-2.5-flash'
WHERE model_name LIKE 'anthropic/%';

-- Update the chat prompt
UPDATE active_chat_prompt
SET model_name = 'google/gemini-2.5-flash'
WHERE model_name LIKE 'anthropic/%';
