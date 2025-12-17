-- Step 1: Drop the old, unused instruction columns from the active_summarizer_prompt table.
-- We are consolidating three instruction fields into one.
ALTER TABLE public.active_summarizer_prompt
DROP COLUMN IF EXISTS overview_instruction,
DROP COLUMN IF EXISTS full_summary_instruction,
DROP COLUMN IF EXISTS tags_instruction;

-- Step 2: Add the new, consolidated instruction column for the mid-length summary.
-- This column will hold the specific instructions for generating the main summary.
ALTER TABLE public.active_summarizer_prompt
ADD COLUMN IF NOT EXISTS mid_length_summary_instruction TEXT;

-- Step 3: Update the existing prompt record (ID=1) with new, simplified content.
-- This new prompt is focused on generating a single, high-quality summary.
UPDATE public.active_summarizer_prompt
SET
  -- A more direct system prompt focused on the single task of calling the JSON tool.
  system_content = 'You are a highly intelligent text processing agent. Your task is to analyze the user''s content and generate a structured JSON output by calling the provided ''json'' tool. You must not respond with any conversational text or pleasantries. Your one and only job is to call the tool with the extracted information.',

  -- A simplified user template.
  user_content_template = 'Please analyze the following text and generate the structured summary based on my instructions. Text to summarize: {{TEXT_TO_SUMMARIZE}}',

  -- A clear, default instruction for the new mid-length summary field.
  mid_length_summary_instruction = 'Provide a comprehensive, medium-length summary of the content. It should capture the key arguments, main points, and any important conclusions. Aim for a summary that is detailed enough to replace a full reading for someone short on time, but concise enough to be read quickly.',

  -- Updating the description to reflect the change.
  description = 'Default summarizer prompt using Claude Sonnet 4, focused on a single mid-length summary.',

  -- Setting the model name explicitly.
  model_name = 'anthropic/claude-3-sonnet-20240229'
WHERE
  id = 1;
