import RunwayML from '@runwayml/sdk';
import { ProviderError, outcomeFromStatus, requireKey } from './errors.ts';
import { videoUsd, type VideoModel } from './pricing.ts';

const RATIO = { '9:16': '720:1280', '16:9': '1280:720', '1:1': '960:960' } as const;

/**
 * Image-to-video through the Runway API, which also resells Kling and Veo models under the same key.
 * Audio is always off: narration and music are added in the edit, and silent output is the cheaper rate.
 */
export async function animate(opts: {
  image: { mimeType: string; base64: string }; motionPrompt: string; seconds: number;
  aspect: '9:16' | '16:9' | '1:1'; model?: VideoModel; onProgress?: (status: string) => void;
}): Promise<{ bytes: Buffer; seconds: number; usd: number; model: string; taskId: string }> {
  const model = opts.model ?? 'kling3.0_standard';
  if (opts.aspect === '1:1' && model.startsWith('veo')) throw new ProviderError('runway', 'invalid_input', `${model} does not offer a square ratio.`);
  const client = new RunwayML({ apiKey: requireKey('runway', 'RUNWAYML_API_SECRET') });
  const seconds = model.startsWith('veo') ? ([4, 6, 8].find((d) => d >= opts.seconds) ?? 8) : Math.min(10, Math.max(3, Math.ceil(opts.seconds)));
  try {
    const created = await client.imageToVideo.create({
      model, promptImage: `data:${opts.image.mimeType};base64,${opts.image.base64}`,
      promptText: opts.motionPrompt, ratio: RATIO[opts.aspect], duration: seconds,
      ...(model === 'gen4_turbo' || model === 'gen4.5' ? {} : { audio: false }),
    } as Parameters<typeof client.imageToVideo.create>[0]);
    opts.onProgress?.(`task ${created.id} started`);
    const done = await client.tasks.retrieve(created.id).waitForTaskOutput({ timeout: 15 * 60 * 1000 });
    const url = done.output[0];
    if (!url) throw new ProviderError('runway', 'provider_down', 'Task succeeded with no output.');
    const file = await fetch(url);
    if (!file.ok) throw new ProviderError('runway', 'provider_down', `Could not download output (${file.status}).`);
    return { bytes: Buffer.from(await file.arrayBuffer()), seconds, usd: videoUsd(model, seconds), model, taskId: created.id };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof RunwayML.APIError) throw new ProviderError('runway', outcomeFromStatus(e.status ?? 500, e.message), e.message, e.status);
    const msg = e instanceof Error ? e.message : String(e);
    throw new ProviderError('runway', /moderation|safety/i.test(msg) ? 'content_blocked' : 'provider_down', msg);
  }
}
