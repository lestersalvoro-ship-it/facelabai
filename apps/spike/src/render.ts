import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { toSrt } from './captions.ts';
import { ffmpeg } from './media.ts';
import { ROOT, type Run } from './run.ts';
import { buildProps } from './steps.ts';

export async function render(run: Run, log: (s: string) => void) {
  const missing = run.m.scenes.filter((s) => !s.voiceFile || !(s.keyframeFile || s.clipFile));
  if (missing.length) throw new Error(`Cannot render: scenes ${missing.map((s) => s.index + 1).join(', ')} are missing voice or visuals.`);
  const props = buildProps(run);
  writeFileSync(join(run.dir, 'composition.json'), JSON.stringify(props, null, 2));

  log('bundling composition');
  const serveUrl = await bundle({ entryPoint: join(ROOT, 'packages/composition/src/index.ts'), publicDir: join(run.dir, 'assets') });
  const browserExecutable = process.env.CHROME_PATH || undefined;
  const inputProps = props as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: 'FacelabVideo', inputProps, browserExecutable });

  const raw = join(run.dir, 'render-raw.mp4');
  let last = -1;
  await renderMedia({
    composition, serveUrl, codec: 'h264', outputLocation: raw, inputProps, browserExecutable, crf: 18, pixelFormat: 'yuv420p',
    onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== last) { last = p; log(`rendering ${p * 10}%`); } },
  });

  // Normalise loudness to a level typical for social feeds, without re-encoding the picture.
  const out = join(run.dir, 'export.mp4');
  ffmpeg(['-i', raw, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out]);

  let offset = 0;
  const srt = toSrt(props.scenes.map((s) => { const o = { offsetSec: offset, chunks: s.captions }; offset += Math.round(s.durationSec * props.fps) / props.fps; return o; }));
  writeFileSync(join(run.dir, 'export.srt'), srt);
  run.m.exportFile = 'export.mp4';
  run.save();
  return out;
}
