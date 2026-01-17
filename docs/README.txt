# Vajra - YouTube Transcript Analysis Tool

A tool to extract YouTube video transcripts and generate Vajra-style analyses with quality scoring, fact-checking, and plain-language summaries.

## For Users

Just tell Cline:
```
Analyze YouTube video: [paste URL]
```

That's it! Cline will extract the transcript and generate a comprehensive Vajra analysis.

## What You Get

**For all videos:**
- Quality score (X/10) - Is it worth your time?
- TL;DR summary
- Plain-language explanation with inline fact-checks
- Key takeaways
- Clear verdict: Should you watch?

**For long videos (≥ 15 min):**
- Executive summary for quick triage (2 min read)
- Full detailed analysis (moved to bottom)

## Examples

```
Analyze YouTube video: https://youtu.be/9H1nwqjzVVc
```

Follow-up refinements:
```
Can you expand the section on [topic]?
The quality score seems off. Can you recalibrate?
Can you verify the claim about [specific detail]?
```

## File Structure

```
Vajra/
├── AI_WORKFLOW.md              # AI assistant instructions
├── VAJRA_PROMPT.md             # Complete format specification
├── README.md                   # This file
├── analyze_youtube.sh          # Transcript extraction script
├── youtube_transcript_analyzer.py
├── requirements.txt
└── transcripts/                # Output folder
    ├── [VIDEO_ID]_raw.txt
    ├── [VIDEO_ID]_structured.json
    └── [VIDEO_ID]_vajra_analysis.md
```

## The Vajra Format

**Philosophy:** Give users the 80/20 in plain language.

- **Quality score first** - Immediate value assessment
- **Plain-language** - Explainable to anyone
- **Inline fact-checks** - Warnings at the moment they matter (✓ ⚠️ 🔴)
- **"Video says" style** - Describes content, doesn't state universal facts
- **Executive summary** - For long content, enables fast triage

See reference example: `transcripts/9H1nwqjzVVc_V4_REVISED.md`

## For AI Assistants

If you're an AI assistant working on this project, **read `AI_WORKFLOW.md` first**. It contains the complete workflow and instructions.

## Installation

Already set up! Virtual environment and dependencies are installed.

If you need to recreate:
```bash
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
chmod +x analyze_youtube.sh
```

## Requirements

- Python 3.7+
- `youtube-transcript-api` (installed in venv)
- Internet connection

## Troubleshooting

**"No transcript found"**
- Video must have captions/subtitles enabled
- Some videos have disabled transcripts

**Script issues**
```bash
rm -rf venv
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
chmod +x analyze_youtube.sh
```

---

**Ready to test!** Just paste a YouTube URL and let Cline handle the rest.
- `youtube-transcript-api` >= 1.2.3 (installed in venv)
