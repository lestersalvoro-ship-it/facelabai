# Environment variables

Copy `.env.example` to `.env`. The file is ignored by git. This repository is public, so a committed key must be treated as leaked and revoked at once.

| Variable | Where to get it | Used for |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | console.anthropic.com, API keys | Storyboards |
| `GEMINI_API_KEY` | aistudio.google.com, with billing enabled | Keyframe images |
| `ELEVENLABS_API_KEY` | elevenlabs.io, profile, API keys | Narration |
| `RUNWAYML_API_SECRET` | dev.runwayml.com, API keys (credits are bought there too) | Video clips |
| `ELEVENLABS_VOICE_EN` | Voice id from the ElevenLabs voice library | English narrator |
| `ELEVENLABS_VOICE_FIL` | Voice id of a voice that speaks Filipino well | Filipino narrator |
| `MAX_RUN_USD` | Your choice, default 5 | Spend ceiling for one run |
| `CHROME_PATH` | Optional path to Chrome | Rendering; empty lets Remotion download its own |
