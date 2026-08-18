import type { Parsed } from './types';

const CR = 13;

/** Trailing carriage returns come from CRLF line endings, not from the log itself */
export function contentEnd(text: string, start: number, end: number) {
  return end > start && text.charCodeAt(end - 1) === CR ? end - 1 : end;
}

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
  const end = next === -1 || next > stop ? stop : next;
  return parsed.text.slice(start, contentEnd(parsed.text, start, end));
}
