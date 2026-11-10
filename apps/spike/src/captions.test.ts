import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignmentToWords, chunkWords, toSrt } from './captions.ts';

const align = (text: string, perChar = 0.05) => ({
  characters: [...text], starts: [...text].map((_, i) => i * perChar), ends: [...text].map((_, i) => (i + 1) * perChar),
});

test('words carry the first and last character times', () => {
  const w = alignmentToWords(align('Hi there'));
  assert.deepEqual(w.map((x) => x.text), ['Hi', 'there']);
  assert.equal(w[0]!.start, 0);
  assert.ok(Math.abs(w[0]!.end - 0.1) < 1e-9);
  assert.ok(Math.abs(w[1]!.start - 0.15) < 1e-9);
});

test('chunks respect the word limit, break on sentences and never overlap', () => {
  const chunks = chunkWords(alignmentToWords(align('He ran. Nobody saw the old man leave town that night.')));
  assert.equal(chunks[0]!.words.map((w) => w.text).join(' '), 'He ran.');
  for (const c of chunks) assert.ok(c.words.length <= 3);
  for (let i = 0; i < chunks.length - 1; i++) assert.ok(chunks[i]!.end <= chunks[i + 1]!.start);
  assert.equal(chunks.flatMap((c) => c.words).length, 11);
});

test('filipino text with punctuation keeps every word', () => {
  const src = 'Noong unang panahon, may isang batang hindi marunong sumuko.';
  const words = alignmentToWords(align(src));
  assert.equal(words.map((w) => w.text).join(' '), src);
});

test('srt numbers cues and offsets them by scene', () => {
  const chunks = chunkWords(alignmentToWords(align('One two')));
  const srt = toSrt([{ offsetSec: 0, chunks }, { offsetSec: 61.5, chunks }]);
  assert.match(srt, /^1\n00:00:00,000 --> /);
  assert.match(srt, /\n2\n00:01:01,500 --> /);
});
