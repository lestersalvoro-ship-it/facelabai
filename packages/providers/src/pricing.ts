/**
 * Provider list prices in US dollars, read on 2026-11-10. Sources in docs/providers.md.
 * In the product this becomes the admin-editable provider_models table.
 */
export const PRICING = {
  text: {
    'claude-sonnet-5-5': { inPerMTok: 2, outPerMTok: 10 },
    'claude-haiku-5-5': { inPerMTok: 0.1, outPerMTok: 0.5 },
  },
  image: {
    'gemini-3.1-flash-image': { '1K': 0.067, '2K': 0.101 },
    'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134 },
  },
  voicePer1kChars: { eleven_v3: 0.08, eleven_multilingual_v2: 0.08, eleven_flash_v2_5: 0.04 },
  /** Runway API credits per second with audio off; one credit is $0.01. */
  videoCreditsPerSec: { gen4_turbo: 5, 'gen4.5': 12, 'kling3.0_standard': 9, 'veo3.1_fast': 10, 'veo3.1': 20 },
  runwayUsdPerCredit: 0.01,
} as const;

export type VideoModel = keyof typeof PRICING.videoCreditsPerSec;
export const videoUsd = (model: VideoModel, sec: number) => PRICING.videoCreditsPerSec[model] * PRICING.runwayUsdPerCredit * sec;
