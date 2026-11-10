import { readFileSync } from 'node:fs';
import { Storyboard, DIMENSIONS, type Brief, type CompositionProps } from '@facelab/contracts';
import { PRICING, ProviderError, animate, generateImage, generateStructured, synthesize, videoUsd, withRetry, type ImageRef, type VideoModel } from '@facelab/providers';
import { alignmentToWords, chunkWords } from './captions.ts';
import { durationSec } from './media.ts';
import { BudgetExceeded, type Run } from './run.ts';

const pad = (n: number) => String(n + 1).padStart(2, '0');
const VIDEO_MODEL: Record<Brief['tier'], VideoModel> = { draft: 'gen4_turbo', premium: 'kling3.0_standard', ultra: 'veo3.1' };
const SCENE_GAP = 0.3;

const DIRECTOR = `You are the head writer and director for short faceless videos made for TikTok, Reels and Shorts.
You write narration that sounds like a person telling a story out loud, not like an article.
Rules:
- The first line is the hook. It must create a question the viewer needs answered. No greetings, no "in this video".
- One idea per scene. Each scene is one continuous shot that a single image could represent.
- Every scene's visuals must show what the narration is saying at that moment, with a specific subject doing a specific action.
- Vary framing from scene to scene: never two wides or two close-ups in a row.
- Describe each recurring character once, concretely, and name them in every scene they appear in.
- Never put text, captions, logos or watermarks in a shot.
- Do not promise outcomes or invent statistics. End on a line that resolves the hook.`;

export async function writeStoryboard(run: Run) {
  const b = run.m.brief;
  const words = Math.round(b.durationSec * (b.language === 'fil' ? 2.1 : 2.4));
  const scenes = Math.max(3, Math.round(b.durationSec / 6));
  run.guard(0.15, 'storyboard');
  const res = await withRetry(() => generateStructured({
    schema: Storyboard, system: DIRECTOR,
    prompt: `Create a storyboard.
Idea: ${b.idea}
Category: ${b.category}
Narration language: ${b.language === 'fil' ? 'Filipino (natural, conversational Tagalog as spoken in Metro Manila; not formal textbook Filipino)' : 'English'}
Target length: ${b.durationSec} seconds, so about ${words} words of narration in total across about ${scenes} scenes.
Visual style: ${b.style}
Frame: ${b.aspect}. Keep the main subject in the upper two thirds; captions sit in the lower third.
Write every visual field in English regardless of narration language. Mark the hook scene and the two or three strongest beats as keyBeat.`,
  }));
  run.m.storyboard = res.value;
  run.m.scenes = res.value.scenes.map((_, index) => ({ index, errors: [] }));
  run.charge({ step: 'storyboard', provider: 'anthropic', model: res.model, usd: res.usd });
}

/** Which scenes get generated video, by production mode. */
export function planMotion(run: Run): Array<'ai_video' | 'still'> {
  const sb = run.m.storyboard!;
  const { mode } = run.m.brief;
  if (mode === 'motion_stills') return sb.scenes.map(() => 'still');
  if (mode === 'full_ai') return sb.scenes.map(() => 'ai_video');
  const cap = Math.max(1, Math.round(sb.scenes.length * 0.3));
  let used = 0;
  return sb.scenes.map((s, i) => ((i === 0 || s.keyBeat) && used < cap ? (used++, 'ai_video') : 'still'));
}

export function estimate(run: Run) {
  const sb = run.m.storyboard!, b = run.m.brief;
  const chars = sb.scenes.reduce((n, s) => n + s.narration.length, 0);
  const perScene = b.durationSec / sb.scenes.length;
  const motion = planMotion(run);
  const model = VIDEO_MODEL[b.tier];
  const lines = [
    { item: `Narration, ${chars} characters`, usd: (chars / 1000) * PRICING.voicePer1kChars.eleven_v3 },
    { item: `Character sheets, ${sb.characters.length}`, usd: sb.characters.length * PRICING.image['gemini-3.1-flash-image']['1K'] },
    { item: `Keyframes, ${sb.scenes.length}`, usd: sb.scenes.length * PRICING.image['gemini-3.1-flash-image']['1K'] },
    { item: `Video, ${motion.filter((m) => m === 'ai_video').length} scenes on ${model}`, usd: motion.filter((m) => m === 'ai_video').length * videoUsd(model, Math.ceil(perScene)) },
  ];
  return { lines, total: lines.reduce((n, l) => n + l.usd, 0), note: 'First-take cost only. Retakes are extra.' };
}

const fileRef = (run: Run, name: string): ImageRef => ({ mimeType: name.endsWith('.jpg') ? 'image/jpeg' : 'image/png', base64: readFileSync(run.asset(name)).toString('base64') });
const ext = (mime: string) => (mime.includes('jpeg') ? 'jpg' : 'png');

export async function produce(run: Run, opts: { scene?: number; redo?: 'voice' | 'keyframe' | 'clip'; log: (s: string) => void }) {
  const sb = run.m.storyboard!, b = run.m.brief;
  const voiceId = process.env[b.language === 'fil' ? 'ELEVENLABS_VOICE_FIL' : 'ELEVENLABS_VOICE_EN'];
  if (!voiceId) throw new ProviderError('elevenlabs', 'not_configured', `Set ELEVENLABS_VOICE_${b.language === 'fil' ? 'FIL' : 'EN'} to a voice id.`);
  const motion = planMotion(run);
  const model = VIDEO_MODEL[b.tier];
  const imgUsd = PRICING.image['gemini-3.1-flash-image']['1K'];

  // 1. One reference sheet per recurring character, reused by every scene that character is in.
  const sheets = new Map<string, string>();
  for (const [i, c] of sb.characters.entries()) {
    const existing = ['png', 'jpg'].map((e) => `character-${pad(i)}.${e}`).find((n) => { try { readFileSync(run.asset(n)); return true; } catch { return false; } });
    if (existing) { sheets.set(c.name, existing); continue; }
    run.guard(imgUsd, `character sheet ${c.name}`);
    opts.log(`character sheet: ${c.name}`);
    const img = await withRetry(() => generateImage({ aspect: '1:1', prompt: `Character reference sheet, single full-body view on a plain neutral background, even lighting. ${c.description} Style: ${sb.styleBlock} No text.` }));
    sheets.set(c.name, run.write(`character-${pad(i)}.${ext(img.mime)}`, img.bytes));
    run.charge({ step: `character:${c.name}`, provider: 'google', model: img.model, usd: img.usd });
  }

  for (const [i, s] of sb.scenes.entries()) {
    if (opts.scene !== undefined && opts.scene !== i) continue;
    const st = run.m.scenes[i]!;
    st.errors = [];
    st.motion = motion[i];
    const redo = opts.scene === i ? opts.redo : undefined;
    try {
      // 2. Voice first: its real length sets the scene length.
      if (!st.voiceFile || redo === 'voice') {
        run.guard((s.narration.length / 1000) * PRICING.voicePer1kChars.eleven_v3, `voice ${i + 1}`);
        opts.log(`scene ${i + 1}: voice`);
        const v = await withRetry(() => synthesize({ text: s.narration, voiceId }));
        st.voiceFile = run.write(`scene-${pad(i)}-voice.mp3`, v.bytes);
        st.voiceSec = durationSec(run.asset(st.voiceFile));
        st.alignment = v.alignment;
        run.charge({ step: `voice:${i + 1}`, provider: 'elevenlabs', model: v.model, usd: v.usd });
      }
      // 3. Keyframe, with character references attached.
      if (!st.keyframeFile || redo === 'keyframe') {
        run.guard(imgUsd, `keyframe ${i + 1}`);
        opts.log(`scene ${i + 1}: keyframe`);
        const cast = sb.characters.filter((c) => s.characters.includes(c.name));
        const prompt = `${s.framing} shot. ${s.subject}. ${s.action}. Lighting: ${s.lighting}.` +
          (cast.length ? ` Characters, matching the attached reference images exactly: ${cast.map((c) => `${c.name}: ${c.description}`).join(' ')}` : '') +
          ` Style: ${sb.styleBlock} Composition: main subject in the upper two thirds of the frame, lower third uncluttered. No text, captions, logos or watermarks.`;
        const img = await withRetry(() => generateImage({ aspect: b.aspect, prompt, references: cast.map((c) => fileRef(run, sheets.get(c.name)!)) }));
        st.keyframeFile = run.write(`scene-${pad(i)}-keyframe.${ext(img.mime)}`, img.bytes);
        st.clipFile = undefined;
        run.charge({ step: `keyframe:${i + 1}`, provider: 'google', model: img.model, usd: img.usd, note: redo ? 'retake' : undefined });
      }
      // 4. Video only where the mode asks for it, generated from the approved keyframe.
      if (st.motion === 'ai_video' && (!st.clipFile || redo === 'clip')) {
        const seconds = Math.ceil(st.voiceSec! + SCENE_GAP);
        run.guard(videoUsd(model, seconds), `clip ${i + 1}`);
        opts.log(`scene ${i + 1}: video on ${model} (this can take a few minutes)`);
        const clip = await animate({ image: fileRef(run, st.keyframeFile), motionPrompt: `${s.motionPrompt} Camera: ${s.camera.replace('_', ' ')}.`, seconds, aspect: b.aspect, model, onProgress: opts.log });
        st.clipFile = run.write(`scene-${pad(i)}-clip.mp4`, clip.bytes);
        run.charge({ step: `clip:${i + 1}`, provider: 'runway', model: clip.model, usd: clip.usd, note: redo ? 'retake' : undefined });
      }
    } catch (e) {
      if (e instanceof BudgetExceeded) { run.save(); throw e; }
      st.errors.push(e instanceof Error ? e.message : String(e));
      opts.log(`scene ${i + 1}: FAILED - ${st.errors.at(-1)}`);
    }
    run.save();
  }
}

export function buildProps(run: Run): CompositionProps {
  const sb = run.m.storyboard!;
  const dims = DIMENSIONS[run.m.brief.aspect];
  return {
    fps: 30, ...dims,
    watermark: run.m.kind === 'fixture' ? 'RENDER TEST - SYNTHETIC MEDIA, NOT AI OUTPUT' : undefined,
    scenes: run.m.scenes.map((st, i) => ({
      image: st.keyframeFile, clip: st.clipFile,
      clipSec: st.clipFile ? durationSec(run.asset(st.clipFile)) : undefined,
      voice: st.voiceFile, durationSec: (st.voiceSec ?? 3) + SCENE_GAP,
      camera: sb.scenes[i]!.camera,
      captions: st.alignment ? chunkWords(alignmentToWords(st.alignment)) : [],
    })),
  };
}
