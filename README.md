# FACELAB AI

An AI production studio for faceless videos. This repository currently holds **Phase 1, the quality spike**: a command-line pipeline that turns an idea into a finished vertical video through real providers. There is no web app yet, by design. The engine is proven first.

- Blueprint: https://claude.ai/artifact/VhTgT9j2ujVtqMaj3KnkDv
- Phase status and what is and is not tested: [docs/phase-1.md](docs/phase-1.md)
- Keys and environment variables: [docs/env.md](docs/env.md)
- Provider prices and sources: [docs/providers.md](docs/providers.md)

## Quick start

```
pnpm install
cp .env.example .env        # then fill in the keys; .env is never committed
pnpm spike doctor           # shows which tools and keys are present
pnpm spike fixture          # renders a synthetic test video, no keys needed
pnpm spike new --idea "The night a lighthouse keeper refused to leave" --lang en --duration 45 --mode hybrid
pnpm spike produce <run>    # voice, keyframes, video; stops at MAX_RUN_USD
pnpm spike render <run>     # MP4, SRT and the export checks
```

Each run lives in `runs/<id>/` with a `manifest.json` (brief, storyboard, per-scene state, cost ledger), an `assets/` folder, `export.mp4`, `export.srt` and `qa.json`.

## Layout

```
apps/spike             the command-line pipeline
packages/contracts     shared schemas and types (Zod)
packages/providers     one adapter per provider: Anthropic, Google, ElevenLabs, Runway
packages/composition   the Remotion video: scenes, camera moves, captions, audio
docs/                  phase notes, environment, provider pages
```

## Security

This repository is public. Never commit `.env`, keys, or anything under `runs/`. Provider keys are read only from the environment.
