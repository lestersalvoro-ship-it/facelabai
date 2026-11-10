import type { Alignment, CaptionChunk, CaptionWord } from '@facelab/contracts';

/** Turn per-character timings into per-word timings. */
export function alignmentToWords(a: Alignment): CaptionWord[] {
  const words: CaptionWord[] = [];
  let text = '', start = 0, end = 0;
  const flush = () => { if (text) words.push({ text, start, end }); text = ''; };
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) return flush();
    if (!text) start = a.starts[i] ?? end;
    text += ch;
    end = a.ends[i] ?? start;
  });
  flush();
  return words;
}

/** Group words into short on-screen chunks. Breaks at sentence punctuation, a word limit, or a character limit. */
export function chunkWords(words: CaptionWord[], maxWords = 3, maxChars = 18): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let cur: CaptionWord[] = [];
  const flush = () => { if (cur.length) chunks.push({ start: cur[0]!.start, end: cur[cur.length - 1]!.end, words: cur }); cur = []; };
  for (const w of words) {
    const len = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length >= maxWords || (cur.length > 0 && len > maxChars)) flush();
    cur.push(w);
    if (/[.!?…]["')]?$/.test(w.text)) flush();
  }
  flush();
  // Captions must never overlap: clamp each end to the next start.
  for (let i = 0; i < chunks.length - 1; i++) chunks[i]!.end = Math.min(chunks[i]!.end, chunks[i + 1]!.start);
  return chunks;
}

const ts = (s: number) => {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

/** SRT file from chunks placed on the full timeline. */
export function toSrt(scenes: { offsetSec: number; chunks: CaptionChunk[] }[]): string {
  let n = 0;
  return scenes.flatMap((s) => s.chunks.map((c) => `${++n}\n${ts(s.offsetSec + c.start)} --> ${ts(s.offsetSec + c.end)}\n${c.words.map((w) => w.text).join(' ')}\n`)).join('\n');
}
