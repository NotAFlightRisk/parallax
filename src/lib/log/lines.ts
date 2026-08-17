import type { Parsed } from './types';

export function entryText(parsed: Parsed, entry: number) {
  return parsed.text.slice(parsed.starts[entry], parsed.ends[entry]);
}

/** Nth physical line of an entry, where line 0 is the one carrying the timestamp */
export function lineText(parsed: Parsed, entry: number, line: number) {
  const stop = parsed.ends[entry];
  let start = parsed.starts[entry];
  for (let skipped = 0; skipped < line; skipped += 1) {
    const next = parsed.text.indexOf('\n', start);
    if (next === -1 || next >= stop) return '';
    start = next + 1;
  }
  const next = parsed.text.indexOf('\n', start);
  return parsed.text.slice(start, next === -1 || next > stop ? stop : next);
}
