import { ProviderError, outcomeFromStatus, requireKey } from './errors.ts';
import { PRICING } from './pricing.ts';

export type ImageModel = keyof typeof PRICING.image;
export type ImageRef = { mimeType: string; base64: string };

/** Depth-first search for the first image block. The raw response shape is not fully documented, so this is tolerant. */
function findImage(node: unknown): { data: string; mime: string } | undefined {
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if (o.type === 'image' && typeof o.data === 'string') return { data: o.data, mime: String(o.mime_type ?? 'image/png') };
  for (const v of Object.values(o)) { const hit = findImage(v); if (hit) return hit; }
}

/** Google Gemini image generation through the Interactions API. Reference images carry character and style consistency. */
export async function generateImage(opts: {
  prompt: string; aspect: '9:16' | '16:9' | '1:1'; references?: ImageRef[]; model?: ImageModel; size?: '1K' | '2K';
}): Promise<{ bytes: Buffer; mime: string; usd: number; model: string }> {
  const model = opts.model ?? 'gemini-3.1-flash-image';
  const size = opts.size ?? '1K';
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': requireKey('google', 'GEMINI_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: [{ type: 'text', text: opts.prompt }, ...(opts.references ?? []).map((r) => ({ type: 'image', mime_type: r.mimeType, data: r.base64 }))],
      response_format: { type: 'image', aspect_ratio: opts.aspect, image_size: size },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new ProviderError('google', outcomeFromStatus(res.status, text), text.slice(0, 400), res.status);
  const img = findImage(JSON.parse(text));
  if (!img) throw new ProviderError('google', 'content_blocked', 'Response contained no image (often a safety refusal).');
  return { bytes: Buffer.from(img.data, 'base64'), mime: img.mime, usd: PRICING.image[model][size], model };
}
