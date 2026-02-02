SET search_path TO clarus, public, extensions;

-- Add {{LANGUAGE}} placeholder to all 6 analysis prompts
-- For text prompts (brief_overview, short_summary, detailed_summary): add after {{TONE}} line
-- For JSON prompts (triage, truth_check, action_items): add before {{CONTENT}}

-- brief_overview: text prompt with {{TONE}}
UPDATE clarus.analysis_prompts
SET user_content_template = replace(
  user_content_template,
  'Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.',
  'Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.

OUTPUT LANGUAGE: {{LANGUAGE}}'
)
WHERE prompt_type = 'brief_overview' AND is_active = true;

-- detailed_summary: text prompt with {{TONE}}
UPDATE clarus.analysis_prompts
SET user_content_template = replace(
  user_content_template,
  'Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.',
  'Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.

OUTPUT LANGUAGE: {{LANGUAGE}}'
)
WHERE prompt_type = 'detailed_summary' AND is_active = true;

-- short_summary: text prompt with {{TONE}}
UPDATE clarus.analysis_prompts
SET user_content_template = replace(
  user_content_template,
  'Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.',
  'Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.

OUTPUT LANGUAGE: {{LANGUAGE}}'
)
WHERE prompt_type = 'short_summary' AND is_active = true;

-- triage: JSON prompt, add before {{CONTENT}}
UPDATE clarus.analysis_prompts
SET user_content_template = replace(
  user_content_template,
  'Content:
{{CONTENT}}',
  'OUTPUT LANGUAGE: {{LANGUAGE}}
IMPORTANT: Keep JSON keys in English. Only translate string VALUES.

Content:
{{CONTENT}}'
)
WHERE prompt_type = 'triage' AND is_active = true;

-- truth_check: JSON prompt, add before {{CONTENT}}
UPDATE clarus.analysis_prompts
SET user_content_template = replace(
  user_content_template,
  '{{CONTENT}}

Return a JSON',
  'OUTPUT LANGUAGE: {{LANGUAGE}}
IMPORTANT: Keep JSON keys in English. Only translate string VALUES.

{{CONTENT}}

Return a JSON'
)
WHERE prompt_type = 'truth_check' AND is_active = true;

-- action_items: JSON prompt, add before {{CONTENT}}
UPDATE clarus.analysis_prompts
SET user_content_template = replace(
  user_content_template,
  'Extract actionable recommendations from this {{TYPE}} content.

{{CONTENT}}',
  'Extract actionable recommendations from this {{TYPE}} content.

OUTPUT LANGUAGE: {{LANGUAGE}}
IMPORTANT: Keep JSON keys in English. Only translate string VALUES.

{{CONTENT}}'
)
WHERE prompt_type = 'action_items' AND is_active = true;
