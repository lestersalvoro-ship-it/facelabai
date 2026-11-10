# Providers

Prices read on 10 November 2026. They live in `packages/providers/src/pricing.ts` and will move to an admin-editable table in the product.

| Provider | Used for | Model in the spike | Price | Source |
| --- | --- | --- | --- | --- |
| Anthropic | Storyboard | `claude-sonnet-5-5` | $2 in, $10 out per million tokens | https://platform.claude.com/docs/en/about-claude/pricing |
| Google Gemini API | Keyframes, character sheets | `gemini-3.1-flash-image` | $0.067 per 1K image | https://ai.google.dev/gemini-api/docs/pricing |
| ElevenLabs | Narration with timings | `eleven_v3` | $0.08 per 1,000 characters | https://elevenlabs.io/pricing/api |
| Runway API | Video, draft | `gen4_turbo` | 5 credits per second | https://docs.dev.runwayml.com/guides/pricing |
| Runway API | Video, premium | `kling3.0_standard` | 9 credits per second, silent | same |
| Runway API | Video, ultra | `veo3.1` | 20 credits per second, silent | same |

Runway credits cost $0.01 each.

## Still to document before any adapter serves paying users

For each provider: rate limits and usage tiers, maximum clip length per model, output formats, and commercial-use terms. None of these has been verified yet.
