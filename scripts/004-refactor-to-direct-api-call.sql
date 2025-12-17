-- Update prompt for direct OpenRouter API call with JSON mode
UPDATE public.active_summarizer_prompt
SET
    model_name = 'anthropic/claude-3.5-sonnet',
    system_content = 'You are an expert summarizer. Your task is to analyze the provided text and return a structured JSON object. The JSON object must contain two keys: "title" and "mid_length_summary". The "title" should be a concise, descriptive title for the text. The "mid_length_summary" should be a comprehensive summary of about 200-400 words, capturing the key points, main arguments, and any important conclusions. Your output MUST be ONLY the raw JSON object, without any markdown formatting, comments, or other text.',
    user_content_template = 'Please generate a title and mid-length summary for the following text:

{{TEXT_TO_SUMMARIZE}}',
    mid_length_summary_instruction = 'A comprehensive summary of about 200-400 words, capturing the key points, main arguments, and any important conclusions from the original text. This is now part of the system prompt.',
    temperature = 0.5,
    top_p = 1,
    max_tokens = 4096,
    updated_at = now()
WHERE id = 1;
