-- 033: Auto-Tone Detection
-- Adds detected_tone column and inserts {{TONE}} placeholder into 4 prose-generating prompts.
-- Applied: 2026-01-31

-- 1. Add detected_tone column to content table
ALTER TABLE clarus.content ADD COLUMN IF NOT EXISTS detected_tone TEXT;

-- 2. Update brief_overview prompt with {{TONE}} placeholder
UPDATE clarus.analysis_prompts
SET user_content_template = 'Analyze the following content and produce a brief overview.

CONTENT VOICE & TONE: {{TONE}}
Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.

{{CONTENT}}

Write 2-4 sentences of plain text capturing the core thesis. Lead with the actual claim or argument, not with framing. Include specific names, numbers, or details. No markdown formatting.',
    updated_at = NOW()
WHERE id = 'a9942892-1a21-4c78-875b-485d6f3e7ae7';

-- 3. Update detailed_summary prompt with {{TONE}} placeholder
UPDATE clarus.analysis_prompts
SET user_content_template = 'Produce a structured analytical breakdown of this content.

CONTENT VOICE & TONE: {{TONE}}
Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.

Content:
{{CONTENT}}
Content Type: {{TYPE}}

Follow the five-part structure: Core Argument, Key Points (4-7 subsections with ## headers), Evidence & Support, Counterarguments & Limitations, Bottom Line.

For video/podcast content: reference timestamps in [M:SS] format within paragraphs. Use ## headers to organize by topic, not by timestamp range.

For articles: organize by argument structure. Include key quotes in > blockquote format.

Use **bold** for key terms. Write analytically in present tense, third person. Prefer flowing paragraphs over bullet lists.

Return only the formatted markdown text, no JSON wrapping.',
    updated_at = NOW()
WHERE id = '74b7406b-ae4a-460d-94c7-69352106e100';

-- 4. Update short_summary prompt with {{TONE}} placeholder
UPDATE clarus.analysis_prompts
SET user_content_template = 'Extract the key points from this content.

CONTENT VOICE & TONE: {{TONE}}
Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.

Content:
{{CONTENT}}

Provide a structured summary covering:
- Core thesis or central finding
- Key supporting evidence or arguments (3-5 points)
- Notable conclusions or implications
- Any important caveats or limitations

Use markdown formatting. Be precise and information-dense.',
    updated_at = NOW()
WHERE id = 'a287b89b-7127-49a5-8a00-b4fef19f1698';

-- 5. Update active_summarizer_prompt with {{TONE}} placeholder
UPDATE clarus.active_summarizer_prompt
SET user_content_template = 'Extract the key takeaways from this content and generate a descriptive title.

CONTENT VOICE & TONE: {{TONE}}
Match the register and energy of the original content in your analysis. If the content is conversational, write conversationally. If academic, write formally.

{{TEXT_TO_SUMMARIZE}}

Return a JSON object with "title" and "mid_length_summary" keys. The summary should be 200-400 words of markdown with a bold TLDR opening, 5-8 substantive bullet points, and a closing caveat line.',
    updated_at = NOW()
WHERE id = 1;
