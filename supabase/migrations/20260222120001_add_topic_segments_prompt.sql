-- Migration 220: Insert topic_segments analysis prompt
-- Used by generateTopicSegments() for podcast/youtube content to produce
-- timestamped topic chapters from the transcript.

INSERT INTO clarus.analysis_prompts (
  prompt_type,
  name,
  description,
  system_content,
  user_content_template,
  model_name,
  temperature,
  max_tokens,
  expect_json,
  is_active,
  use_web_search
) VALUES (
  'topic_segments',
  'Topic Segments',
  'Identifies distinct topic segments with timestamps from podcast/YouTube transcripts.',
  'You are an expert content analyst specializing in audio/video content segmentation. Your task is to identify the distinct topic segments (chapters) in a transcript. Each segment should represent a coherent topic or discussion thread. Return a JSON object with a "segments" array.',
  '{{METADATA}}

Analyze the following transcript and identify 5-8 distinct topic segments (chapters). Each segment should represent a meaningful shift in topic or discussion.

RULES:
- Use the timestamps from the transcript (format: [MM:SS] or [H:MM:SS]) to determine segment boundaries
- The first segment should start at 0:00
- The last segment''s end_time should be the last timestamp in the transcript
- Segments must be contiguous (no gaps) — each segment''s start_time equals the previous segment''s end_time
- Each segment title should be concise (3-8 words) and descriptive
- Each summary should be 1-2 sentences capturing the key points discussed
- If speakers are identifiable, include which speakers are active in each segment
- For short content (<10 minutes), 3-5 segments is acceptable
- For long content (>60 minutes), up to 10-12 segments is acceptable

{{LANGUAGE}}

Return JSON in this exact format:
{
  "segments": [
    {
      "title": "Introduction & Background",
      "start_time": "0:00",
      "end_time": "8:14",
      "summary": "Host introduces the guest and provides context on their work in AI safety.",
      "speakers": ["A", "B"]
    }
  ]
}

TRANSCRIPT:
{{CONTENT}}',
  'google/gemini-2.5-flash',
  0.3,
  4096,
  true,
  false
) ON CONFLICT (prompt_type) DO NOTHING;
