-- Step 1: Refactor the 'active_summarizer_prompt' table and its content.

-- Drop old instruction columns if they exist
ALTER TABLE public.active_summarizer_prompt
DROP COLUMN IF EXISTS overview_instruction,
DROP COLUMN IF EXISTS full_summary_instruction,
DROP COLUMN IF EXISTS tags_instruction;

-- Add new columns for the simplified prompt structure if they don't exist
ALTER TABLE public.active_summarizer_prompt
ADD COLUMN IF NOT EXISTS model_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS mid_length_summary_instruction TEXT;

-- Update the single prompt entry to use the new structure and a compatible model
UPDATE public.active_summarizer_prompt
SET
  system_content = 'You are a highly intelligent text processing agent. Your task is to analyze the user''s content and generate a structured JSON output by calling the provided ''json'' tool. You must not respond with any conversational text or pleasantries. Your one and only job is to call the tool with the extracted information.',
  user_content_template = 'Please analyze the following text and generate a structured summary based on my instructions. Text to summarize: {{TEXT_TO_SUMMARIZE}}',
  description = 'Default summarizer prompt using Claude 3 Sonnet.',
  model_name = 'anthropic/claude-3-sonnet-20240229', -- Using a model compatible with the project's AI SDK version
  mid_length_summary_instruction = 'Provide a comprehensive, medium-length summary of the content. It should capture the key arguments, main points, and any important conclusions. Aim for a summary that is detailed enough to replace a full reading for someone short on time, but concise enough to be read quickly.',
  updated_at = NOW()
WHERE id = 1;


-- Step 2: Refactor the 'summaries' table to store only the mid-length summary.

-- Drop old summary columns
ALTER TABLE public.summaries
DROP COLUMN IF EXISTS overview,
DROP COLUMN IF EXISTS full_summary,
DROP COLUMN IF EXISTS tags;

-- Add the new column for the mid-length summary
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS mid_length_summary TEXT;


-- Step 3: Clean up the 'content' table by removing the old 'tags' column.
ALTER TABLE public.content
DROP COLUMN IF EXISTS tags;
