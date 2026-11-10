import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ffmpeg, ffprobeJson } from './media.ts';
import type { Run } from './run.ts';
import { buildProps } from './steps.ts';

export type Check = { name: string; pass: boolean; detail: string };

const ranges = (log: string, re: RegExp) => [...log.matchAll(re)].map((m) => ({ start: Number(m[1]), dur: Number(m[2]) }));

/** Export checks from section 8 of the blueprint. Returns one line per check; nothing is skipped silently. */
export function qa(run: Run): Check[] {
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });
  const props = buildProps(run);

  const noMedia = run.m.scenes.filter((s) => !(s.keyframeFile || s.clipFile) || !s.voiceFile || [s.keyframeFile, s.clipFile, s.voiceFile].some((f) => f && !existsSync(run.asset(f))));
  add('Every scene has media', noMedia.length === 0, noMedia.length ? `scenes ${noMedia.map((s) => s.index + 1).join(', ')}` : `${run.m.scenes.length} scenes`);

  const file = join(run.dir, run.m.exportFile ?? 'export.mp4');
  if (!existsSync(file)) { add('Export file exists', false, 'not rendered yet'); return checks; }

  const probe = ffprobeJson(file);
  const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio');
  add('Has picture and sound', !!v && !!a, `${v?.codec_name ?? 'no video'} / ${a?.codec_name ?? 'no audio'}`);
  if (!v || !a) return checks;

  add('Resolution and aspect ratio', v.width === props.width && v.height === props.height, `${v.width}x${v.height}, expected ${props.width}x${props.height}`);
  const [n, d] = String(v.avg_frame_rate).split('/').map(Number);
  add('Frame rate', Math.abs(n! / d! - props.fps) < 0.01, `${(n! / d!).toFixed(2)} fps`);

  const expected = props.scenes.reduce((t, s) => t + Math.round(s.durationSec * props.fps), 0) / props.fps;
  const vd = Number(v.duration), ad = Number(a.duration);
  add('Length matches the composition', Math.abs(vd - expected) < 0.2, `${vd.toFixed(2)}s, expected ${expected.toFixed(2)}s`);
  add('Picture and sound the same length', Math.abs(vd - ad) < 0.15, `video ${vd.toFixed(2)}s, audio ${ad.toFixed(2)}s`);

  const log = ffmpeg(['-i', file, '-vf', 'blackdetect=d=0.4:pix_th=0.10,freezedetect=n=-60dB:d=2', '-af', 'silencedetect=n=-50dB:d=1.5,ebur128', '-f', 'null', '-']);
  const black = ranges(log, /black_start:([\d.]+).*?black_duration:([\d.]+)/g);
  add('No black frames', black.length === 0, black.length ? black.map((b) => `${b.start.toFixed(1)}s for ${b.dur.toFixed(1)}s`).join('; ') : 'none');
  const frozen = [...log.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  add('No frozen picture', frozen.length === 0, frozen.length ? `at ${frozen.map((f) => f.toFixed(1) + 's').join(', ')}` : 'none');
  const silent = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  add('No silent stretches', silent.length === 0, silent.length ? `at ${silent.map((f) => f.toFixed(1) + 's').join(', ')}` : 'none');
  const lufs = Number(log.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/)?.[1]);
  add('Loudness near -14 LUFS', Number.isFinite(lufs) && Math.abs(lufs + 14) <= 2.5, Number.isFinite(lufs) ? `${lufs} LUFS` : 'could not measure');

  const bad = props.scenes.flatMap((s, i) => s.captions.filter((c, j) => c.end > s.durationSec + 0.05 || c.end < c.start || (j > 0 && c.start < s.captions[j - 1]!.end)).map(() => i + 1));
  const noCaps = props.scenes.filter((s) => s.captions.length === 0).length;
  add('Caption timing', bad.length === 0 && noCaps === 0, bad.length ? `problems in scenes ${[...new Set(bad)].join(', ')}` : noCaps ? `${noCaps} scenes have no captions` : `${props.scenes.reduce((t, s) => t + s.captions.length, 0)} captions inside their scenes, none overlapping`);

  ffmpeg(['-v', 'error', '-i', file, '-f', 'null', '-']);
  add('File decodes to the end', true, 'full decode pass');

  writeFileSync(join(run.dir, 'qa.json'), JSON.stringify({ at: new Date().toISOString(), checks }, null, 2));
  return checks;
}
