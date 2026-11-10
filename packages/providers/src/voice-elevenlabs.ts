import type { Alignment } from '@facelab/contracts';
import { ProviderError, outcomeFromStatus, requireKey } from './errors.ts';
import { PRICING } from './pricing.ts';

export type VoiceModel = keyof typeof PRICING.voicePer1kChars;

/** ElevenLabs text to speech. One call returns the audio and the start and end time of every character. */
export async function synthesize(opts: {
  text: string; voiceId: string; model?: VoiceModel; speed?: number; stability?: number; style?: number;
}): Promise<{ bytes: Buffer; alignment: Alignment; usd: number; model: string }> {
  const model = opts.model ?? 'eleven_v3';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': requireKey('elevenlabs', 'ELEVENLABS_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: opts.text, model_id: model,
      voice_settings: { stability: opts.stability ?? 0.5, similarity_boost: 0.75, style: opts.style ?? 0, speed: opts.speed ?? 1 },
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new ProviderError('elevenlabs', outcomeFromStatus(res.status, body), body.slice(0, 400), res.status);
  const json = JSON.parse(body) as { audio_base64: string; alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } };
  if (!json.audio_base64 || !json.alignment) throw new ProviderError('elevenlabs', 'provider_down', 'Response had no audio or no alignment.');
  return {
    bytes: Buffer.from(json.audio_base64, 'base64'),
    alignment: { characters: json.alignment.characters, starts: json.alignment.character_start_times_seconds, ends: json.alignment.character_end_times_seconds },
    usd: (opts.text.length / 1000) * PRICING.voicePer1kChars[model], model,
  };
}
