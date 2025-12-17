-- Remove deprecated description column from summarizer prompt table
ALTER TABLE public.active_summarizer_prompt
DROP COLUMN IF EXISTS description;
-- Remove deprecated mid_length_summary_instruction column from summarizer prompt table
ALTER TABLE public.active_summarizer_prompt
DROP COLUMN IF EXISTS mid_length_summary_instruction;
-- Remove deprecated description column from chat prompt table
ALTER TABLE public.active_chat_prompt
DROP COLUMN IF EXISTS description;
