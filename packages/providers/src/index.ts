export * from './errors.ts';
export * from './pricing.ts';
export { generateStructured } from './text-anthropic.ts';
export { generateImage, type ImageRef } from './image-gemini.ts';
export { synthesize } from './voice-elevenlabs.ts';
export { animate } from './video-runway.ts';

export const REQUIRED_KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'ELEVENLABS_API_KEY', 'RUNWAYML_API_SECRET'] as const;
export const missingKeys = () => REQUIRED_KEYS.filter((k) => !process.env[k]);
