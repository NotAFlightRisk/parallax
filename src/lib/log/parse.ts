import { NEEDS_YEAR, detect, readerFor, resolve, type Fields, type Format } from './formats';
import type { FormatId, ParseOptions, Parsed } from './types';
import { offsetAt } from './zone';

/** Only the head of a line can hold a timestamp, so never slice more than this */
const HEAD = 200;
const SAMPLE_LINES = 200;
const DAY = 86400000;
const LATE_MONTH = 11;
const EARLY_MONTH = 2;

export type ParseHooks = { onProgress?: (done: number, total: number) => void; now?: number };

function lineEndAt(text: string, from: number) {
  const next = text.indexOf('\n', from);
  return next === -1 ? text.length : next;
}

function headAt(text: string, start: number, end: number) {
  return text.slice(start, Math.min(start + HEAD, end));
}

function sampleHeads(text: string) {
  const heads: string[] = [];
  let cursor = 0;
  while (cursor < text.length && heads.length < SAMPLE_LINES) {
    const end = lineEndAt(text, cursor);
    if (end > cursor) heads.push(headAt(text, cursor, end));
    cursor = end + 1;
  }
  return heads;
}

function firstFields(heads: string[], read: Format['read']) {
  for (const head of heads) {
    const stamp = read(head);
    if (stamp && !('epoch' in stamp)) return stamp;
  }
  return undefined;
}

/**
 * Formats without a year start from the newest year that does not put the first
 * line in the future, then roll forward at a year end. Read in the source's own
 * zone, which near new year is not the same year as UTC.
 */
function baseYear(first: Fields | undefined, zone: string, now: number) {
  const year = new Date(now + offsetAt(now, zone)).getUTCFullYear();
  if (!first) return year;
  return resolve(first, year, zone) > now + DAY ? year - 1 : year;
}

export function parse(text: string, options: ParseOptions, hooks: ParseHooks = {}): Parsed {
  const now = hooks.now ?? Date.now();
  const heads = sampleHeads(text);
  const detected = options.format === 'auto';
  const format: FormatId = options.format === 'auto' ? detect(heads).format : options.format;
  const read = readerFor(format, options.pattern);

  let times = new Float64Array(4096);
  let starts = new Uint32Array(4096);
  let ends = new Uint32Array(4096);
  let lines = new Uint32Array(4096);
  let count = 0;

  const grow = () => {
    const size = times.length * 2;
    const wider = new Float64Array(size);
    wider.set(times);
    times = wider;
    const next = [starts, ends, lines].map((array) => {
      const grown = new Uint32Array(size);
      grown.set(array);
      return grown;
    });
    [starts, ends, lines] = next;
  };

  let year = NEEDS_YEAR.includes(format)
    ? baseYear(firstFields(heads, read), options.zone, now)
    : 0;

  let previous = -Infinity;
  let previousMonth = 0;
  let low = Infinity;
  let high = -Infinity;
  let total = 0;
  let unmatched = 0;
  let orphanStart = -1;
  let cursor = 0;
  let nextTick = 0;

  while (cursor < text.length) {
    const end = lineEndAt(text, cursor);
    if (end === cursor) {
      cursor = end + 1;
      continue;
    }
    total += 1;
    const stamp = read(headAt(text, cursor, end));

    if (!stamp) {
      unmatched += 1;
      if (count > 0) {
        ends[count - 1] = end;
        lines[count - 1] += 1;
      } else if (orphanStart === -1) {
        orphanStart = cursor;
      }
    } else {
      let time: number;
      if ('epoch' in stamp) {
        time = stamp.epoch;
      } else {
        time = resolve(stamp, year, options.zone);
        const rolled =
          stamp.year === undefined &&
          time < previous &&
          previousMonth >= LATE_MONTH &&
          stamp.month <= EARLY_MONTH;
        if (rolled) {
          year += 1;
          time = resolve(stamp, year, options.zone);
        }
        previousMonth = stamp.month;
      }
      previous = time;
      if (time < low) low = time;
      if (time > high) high = time;
      if (count === times.length) grow();
      times[count] = time;
      starts[count] = count === 0 && orphanStart !== -1 ? orphanStart : cursor;
      ends[count] = end;
      lines[count] = count === 0 && orphanStart !== -1 ? countLines(text, orphanStart, end) : 1;
      count += 1;
    }

    cursor = end + 1;
    if (hooks.onProgress && cursor >= nextTick) {
      hooks.onProgress(cursor, text.length);
      nextTick = cursor + 1_000_000;
    }
  }

  hooks.onProgress?.(text.length, text.length);

  return {
    text,
    times: times.slice(0, count),
    starts: starts.slice(0, count),
    ends: ends.slice(0, count),
    lines: lines.slice(0, count),
    format,
    detected,
    total,
    unmatched,
    low: count ? low : 0,
    high: count ? high : 0
  };
}

function countLines(text: string, start: number, end: number) {
  let count = 1;
  for (let at = text.indexOf('\n', start); at !== -1 && at < end; at = text.indexOf('\n', at + 1)) {
    count += 1;
  }
  return count;
}
