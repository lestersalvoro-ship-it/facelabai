import { execFileSync, spawnSync } from 'node:child_process';

export function ffprobeJson(file: string): { streams: Array<Record<string, any>>; format: Record<string, any> } {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8' }));
}
export const durationSec = (file: string) => Number(ffprobeJson(file).format.duration);

/** Run ffmpeg and return its log output (ffmpeg writes analysis results to stderr). */
export function ffmpeg(args: string[]): string {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-600)}`);
  return r.stderr;
}
