import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { Brief } from '@facelab/contracts';
import { REQUIRED_KEYS, missingKeys } from '@facelab/providers';
import { makeFixture } from './fixture.ts';
import { qa } from './qa.ts';
import { render } from './render.ts';
import { ROOT, Run } from './run.ts';
import { estimate, planMotion, produce, writeStoryboard } from './steps.ts';

config({ path: join(ROOT, '.env'), quiet: true });
const log = (s: string) => console.log(`  ${s}`);
const usd = (n: number) => `$${n.toFixed(2)}`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    idea: { type: 'string' }, category: { type: 'string' }, duration: { type: 'string' }, aspect: { type: 'string' },
    lang: { type: 'string' }, style: { type: 'string' }, mode: { type: 'string' }, tier: { type: 'string' },
    scene: { type: 'string' }, redo: { type: 'string' },
  },
});
const [cmd, runId] = positionals;

function printQa(run: Run) {
  const checks = qa(run);
  for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(36)} ${c.detail}`);
  const failed = checks.filter((c) => !c.pass).length;
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
  return failed === 0;
}
function printEstimate(run: Run) {
  const e = estimate(run);
  for (const l of e.lines) console.log(`  ${usd(l.usd).padStart(7)}  ${l.item}`);
  console.log(`  ${usd(e.total).padStart(7)}  total. ${e.note} Ceiling for this run: ${usd(run.ceiling)}.`);
}

const commands: Record<string, () => Promise<void> | void> = {
  doctor() {
    const tool = (name: string, args: string[]) => { try { return execFileSync(name, args, { encoding: 'utf8' }).split('\n')[0]; } catch { return undefined; } };
    console.log('Tools');
    console.log(`  ${tool('ffmpeg', ['-version']) ? 'OK     ' : 'MISSING'} ffmpeg`);
    const chrome = process.env.CHROME_PATH;
    console.log(`  ${chrome ? (existsSync(chrome) ? 'OK     ' : 'MISSING') : 'AUTO   '} Chrome for rendering ${chrome ?? '(Remotion downloads its own on first render)'}`);
    console.log('Provider keys');
    for (const k of REQUIRED_KEYS) console.log(`  ${process.env[k] ? 'SET    ' : 'MISSING'} ${k}`);
    for (const k of ['ELEVENLABS_VOICE_EN', 'ELEVENLABS_VOICE_FIL']) console.log(`  ${process.env[k] ? 'SET    ' : 'MISSING'} ${k}`);
    const miss = missingKeys();
    console.log(miss.length ? `\nReal generation is not possible yet: ${miss.length} key(s) missing. "fixture" still works.` : '\nReady for real generation.');
  },
  async new() {
    const brief = Brief.parse({
      idea: values.idea, category: values.category, durationSec: values.duration ? Number(values.duration) : undefined,
      aspect: values.aspect, language: values.lang, style: values.style, mode: values.mode, tier: values.tier,
    });
    const run = Run.create({ id: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14), createdAt: new Date().toISOString(), kind: 'real', brief });
    console.log(`Run ${run.m.id}: writing storyboard`);
    await writeStoryboard(run);
    const sb = run.m.storyboard!, motion = planMotion(run);
    console.log(`\n${sb.title}\nHook: ${sb.hook}\n`);
    sb.scenes.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. [${motion[i] === 'ai_video' ? 'video' : 'still'}] ${s.narration}\n      ${s.framing}: ${s.subject}, ${s.action}`));
    console.log('\nEstimate');
    printEstimate(run);
    console.log(`\nReview runs/${run.m.id}/manifest.json, edit it if you like, then: pnpm spike produce ${run.m.id}`);
  },
  estimate() { printEstimate(Run.load(runId!)); },
  async produce() {
    const run = Run.load(runId!);
    if (run.m.kind === 'fixture') throw new Error('Fixture runs are synthetic and cannot be produced.');
    await produce(run, { scene: values.scene ? Number(values.scene) - 1 : undefined, redo: values.redo as never, log });
    const failed = run.m.scenes.filter((s) => s.errors.length);
    console.log(`\nSpent so far: ${usd(run.spent)}. ${failed.length ? `${failed.length} scene(s) failed; fix and run produce again (finished scenes are kept).` : `All scenes ready. Next: pnpm spike render ${run.m.id}`}`);
  },
  async render() {
    const run = Run.load(runId!);
    const out = await render(run, log);
    console.log(`\nWrote ${out}\n`);
    if (!printQa(run)) process.exitCode = 1;
  },
  qa() { if (!printQa(Run.load(runId!))) process.exitCode = 1; },
  async fixture() {
    const run = makeFixture((values.aspect as never) ?? '9:16');
    console.log(`Fixture run ${run.m.id} (synthetic media, no provider calls)`);
    const out = await render(run, log);
    console.log(`\nWrote ${out}\n`);
    if (!printQa(run)) process.exitCode = 1;
  },
};

if (!cmd || !commands[cmd]) {
  console.log(`Usage: pnpm spike <command>
  doctor                         check tools and provider keys
  new --idea "..." [--lang en|fil] [--duration 60] [--mode motion_stills|hybrid|full_ai] [--tier draft|premium|ultra] [--aspect 9:16|16:9|1:1] [--style "..."]
  estimate <run>                 first-take cost of a storyboard
  produce <run> [--scene N --redo voice|keyframe|clip]
  render <run>                   render, normalise loudness, write captions, run export checks
  qa <run>                       run export checks again
  fixture [--aspect 9:16]        render a synthetic test video without any provider`);
  process.exit(cmd ? 1 : 0);
}
try { await commands[cmd]!(); } catch (e) { console.error(`\n${e instanceof Error ? e.message : e}`); process.exit(1); }
