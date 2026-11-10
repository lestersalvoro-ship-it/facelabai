import { z } from 'zod';

export const Aspect = z.enum(['9:16', '16:9', '1:1']);
export type Aspect = z.infer<typeof Aspect>;
export const Mode = z.enum(['motion_stills', 'hybrid', 'full_ai']);
export type Mode = z.infer<typeof Mode>;
export const Tier = z.enum(['draft', 'premium', 'ultra']);
export type Tier = z.infer<typeof Tier>;
export const Language = z.enum(['en', 'fil']);
export type Language = z.infer<typeof Language>;

export const Brief = z.object({
  idea: z.string().min(3),
  category: z.string().default('storytelling'),
  durationSec: z.number().int().min(10).max(180).default(60),
  aspect: Aspect.default('9:16'),
  language: Language.default('en'),
  style: z.string().default('cinematic realism'),
  mode: Mode.default('hybrid'),
  tier: Tier.default('premium'),
});
export type Brief = z.infer<typeof Brief>;

/** What the language model must return. Kept flat so it validates reliably. */
export const Storyboard = z.object({
  title: z.string(),
  audience: z.string(),
  hook: z.string().describe('The first spoken line. Must earn the next three seconds.'),
  styleBlock: z.string().describe('One paragraph of visual style appended to every image prompt: medium, palette, lens, lighting, mood.'),
  characters: z.array(z.object({
    name: z.string(),
    description: z.string().describe('Fixed physical description: age, build, hair, clothing, colours. Reused verbatim in every scene the character appears in.'),
  })),
  scenes: z.array(z.object({
    narration: z.string().describe('Exactly what the narrator says in this scene.'),
    subject: z.string(),
    action: z.string(),
    framing: z.string().describe('e.g. wide establishing, medium, close-up, over-the-shoulder'),
    camera: z.enum(['push_in', 'pull_out', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down', 'static']),
    lighting: z.string(),
    characters: z.array(z.string()).describe('Names of characters visible in this scene.'),
    motionPrompt: z.string().describe('What moves in the shot, for an image-to-video model. One sentence.'),
    keyBeat: z.boolean().describe('True for the hook and the two or three most important story beats.'),
  })).min(3).max(24),
  musicMood: z.string(),
  metadata: z.object({ title: z.string(), description: z.string(), hashtags: z.array(z.string()).max(12) }),
});
export type Storyboard = z.infer<typeof Storyboard>;

export const Alignment = z.object({
  characters: z.array(z.string()),
  starts: z.array(z.number()),
  ends: z.array(z.number()),
});
export type Alignment = z.infer<typeof Alignment>;

export const LedgerEntry = z.object({
  at: z.string(), step: z.string(), provider: z.string(), model: z.string(),
  usd: z.number(), note: z.string().optional(),
});
export type LedgerEntry = z.infer<typeof LedgerEntry>;

export const SceneState = z.object({
  index: z.number(),
  voiceFile: z.string().optional(),
  voiceSec: z.number().optional(),
  alignment: Alignment.optional(),
  keyframeFile: z.string().optional(),
  clipFile: z.string().optional(),
  motion: z.enum(['ai_video', 'still']).optional(),
  errors: z.array(z.string()).default([]),
});
export type SceneState = z.infer<typeof SceneState>;

export const Manifest = z.object({
  id: z.string(),
  createdAt: z.string(),
  /** 'fixture' runs use synthetic media to test rendering only. They are never AI output. */
  kind: z.enum(['real', 'fixture']),
  brief: Brief,
  storyboard: Storyboard.optional(),
  scenes: z.array(SceneState).default([]),
  ledger: z.array(LedgerEntry).default([]),
  exportFile: z.string().optional(),
});
export type Manifest = z.infer<typeof Manifest>;

// ---- Composition input (what the renderer and the browser preview both read) ----
export type CaptionWord = { text: string; start: number; end: number };
export type CaptionChunk = { start: number; end: number; words: CaptionWord[] };
export type CompScene = {
  image?: string; clip?: string; clipSec?: number;
  voice?: string; durationSec: number;
  camera: Storyboard['scenes'][number]['camera'];
  captions: CaptionChunk[];
};
export type CompositionProps = {
  fps: number; width: number; height: number;
  scenes: CompScene[];
  music?: { src: string; volume: number };
  watermark?: string;
};

export const DIMENSIONS: Record<Aspect, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
};
