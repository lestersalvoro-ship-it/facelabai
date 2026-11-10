# Phase 1: quality spike

Goal: prove that the engine can produce videos worth publishing before any interface is built. Done when the owner would publish at least three of ten test videos as they are.

## Built

| Piece | File | State |
| --- | --- | --- |
| Shared schemas: brief, storyboard, manifest, composition | `packages/contracts` | Type-checked |
| Storyboard writer (Claude, schema-enforced output) | `packages/providers/src/text-anthropic.ts`, `apps/spike/src/steps.ts` | Written. **Not yet run against the API.** |
| Keyframes with character reference images (Google Gemini) | `packages/providers/src/image-gemini.ts` | Written. **Not yet run against the API.** |
| Narration with character timings (ElevenLabs) | `packages/providers/src/voice-elevenlabs.ts` | Written. **Not yet run against the API.** |
| Image-to-video (Runway API: Gen-4 Turbo, Kling 3.0, Veo 3.1) | `packages/providers/src/video-runway.ts` | Written against SDK 4.24 types. **Not yet run against the API.** |
| Production modes: Motion Stills, Hybrid, Full AI Video | `apps/spike/src/steps.ts` | Written |
| Cost ledger and per-run spend ceiling | `apps/spike/src/run.ts` | Written |
| Caption timing: characters to words to chunks to SRT | `apps/spike/src/captions.ts` | **Tested**, 4 unit tests |
| Video composition: clips, camera moves on stills, word-highlight captions, voice, music | `packages/composition` | **Tested** by rendering |
| Render, loudness normalisation, SRT export | `apps/spike/src/render.ts` | **Tested** by rendering |
| Export checks, 12 of them | `apps/spike/src/qa.ts` | **Tested**: all pass on the fixture |

## How it was tested

`pnpm spike fixture` builds a run from synthetic media (colour gradients, test tones, one test-pattern clip), renders it at 1080x1920 and runs the export checks. Every frame is stamped "RENDER TEST - SYNTHETIC MEDIA, NOT AI OUTPUT". This tests the compositor and the checks. It says nothing about AI output quality.

No provider has been called yet because no keys are configured. The four adapters are the part of this phase that is unproven.

## Not built yet

- Automatic keyframe and clip review by a vision model. For now review is by eye, with `produce --scene N --redo keyframe|clip|voice` for retakes. Retakes are recorded in the ledger so the retake rate can be measured.
- Music selection. The composition accepts a music track; no licensed catalogue is chosen yet.
- Scene transitions beyond a short fade-in.
- Retry of a Runway task that fails after it starts (the SDK polls; a failed task is reported per scene and can be re-run).

## Known limits

- Through the Runway API, Kling 3.0 Standard outputs 720x1280, which the compositor scales to 1080x1920. Veo 3.1 offers 1080x1920.
- The Gemini image response shape is not fully documented, so the adapter searches the response for the first image block.

## To close the phase

1. Add the four keys and two voice ids (see `docs/env.md`), run `pnpm spike doctor`.
2. Run one 30-second Motion Stills video in English. Fix whatever the first real calls reveal.
3. Run the ten test briefs, five English and five Filipino, across the three modes.
4. Record per run: cost, retakes, and a publish or reject verdict.
5. Replace the 30% retake assumption in the blueprint with the measured figure.
