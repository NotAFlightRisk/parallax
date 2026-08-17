import { describe, expect, it } from 'vitest';
import { parse } from '../../src/lib/log/parse';
import {
  density,
  entryForRow,
  entryForTime,
  indexOf,
  merge,
  sourceOf
} from '../../src/lib/log/merge';
import { matchMask } from '../../src/lib/log/search';
import { spanOf } from '../../src/lib/log/merge';
import { render } from '../../src/lib/log/render';
import type { Lane } from '../../src/lib/log/merge';

const iso = (seconds: number, body: string) =>
  `2026-08-17T00:00:${String(seconds).padStart(2, '0')}Z ${body}`;

const lane = (text: string, offset = 0): Lane => ({
  parsed: parse(text, { format: 'iso', zone: 'UTC' }),
  offset
});

const bodies = (lanes: Lane[], order: Uint32Array) =>
  Array.from(order, (slot) => {
    const { parsed } = lanes[sourceOf(slot)];
    const entry = indexOf(slot);
    return parsed.text.slice(parsed.starts[entry], parsed.ends[entry]).split(' ')[1];
  });

describe('merge', () => {
  it('interleaves sources by time', () => {
    const lanes = [lane([iso(1, 'a1'), iso(3, 'a2')].join('\n')), lane(iso(2, 'b1'))];
    expect(bodies(lanes, merge(lanes).order)).toEqual(['a1', 'b1', 'a2']);
  });

  it('re-interleaves when an offset moves a source', () => {
    const lanes = [lane([iso(1, 'a1'), iso(3, 'a2')].join('\n')), lane(iso(2, 'b1'), 5000)];
    expect(bodies(lanes, merge(lanes).order)).toEqual(['a1', 'a2', 'b1']);
  });

  it('applies the offset to the reported times, not just the order', () => {
    const lanes = [lane(iso(1, 'a1'), 250)];
    expect(merge(lanes).times[0]).toBe(Date.UTC(2026, 7, 17, 0, 0, 1, 250));
  });

  it('drops entries outside the time range', () => {
    const lanes = [lane([iso(1, 'a1'), iso(9, 'a2')].join('\n'))];
    const range: [number, number] = [Date.UTC(2026, 7, 17, 0, 0, 5), Date.UTC(2026, 7, 17, 0, 1)];
    expect(bodies(lanes, merge(lanes, range).order)).toEqual(['a2']);
  });

  it('drops entries the mask hides', () => {
    const lanes = [lane([iso(1, 'a1'), iso(2, 'a2')].join('\n'))];
    lanes[0].mask = Uint8Array.from([0, 1]);
    expect(bodies(lanes, merge(lanes).order)).toEqual(['a2']);
  });

  it('spans the first and last visible time', () => {
    const lanes = [lane([iso(1, 'a1'), iso(4, 'a2')].join('\n'))];
    expect(merge(lanes).span).toEqual([
      Date.UTC(2026, 7, 17, 0, 0, 1),
      Date.UTC(2026, 7, 17, 0, 0, 4)
    ]);
  });

  it('has no span when everything is filtered out', () => {
    const lanes = [lane(iso(1, 'a1'))];
    lanes[0].mask = Uint8Array.from([0]);
    expect(merge(lanes).span).toBeNull();
  });

  it('counts a multi-line entry as several rows', () => {
    const lanes = [lane(`${iso(1, 'boom')}\n  at thing\n${iso(2, 'next')}`)];
    const merged = merge(lanes);
    expect(merged.rows).toBe(3);
    expect(Array.from(merged.rowStarts)).toEqual([0, 2, 3]);
  });
});

describe('lookups', () => {
  const merged = merge([lane([iso(1, 'a'), iso(2, 'b'), iso(3, 'c')].join('\n'))]);

  it('maps a row back to the entry that owns it', () => {
    expect(entryForRow(merged.rowStarts, 2)).toBe(2);
  });

  it('seeks to the first entry at or after a time', () => {
    expect(entryForTime(merged.times, Date.UTC(2026, 7, 17, 0, 0, 2))).toBe(1);
  });

  it('clamps a seek past the end to the last entry', () => {
    expect(entryForTime(merged.times, Date.UTC(2027, 0, 1))).toBe(2);
  });

  it('buckets each source separately for the density strip', () => {
    const lanes = [lane([iso(1, 'a'), iso(1, 'b')].join('\n')), lane(iso(9, 'c'))];
    const span = merge(lanes).span!;
    const [first, second] = density(lanes, span, 4);
    expect(first[0]).toBe(2);
    expect(second.at(-1)).toBe(1);
  });
});

describe('free text search', () => {
  const parsed = parse([iso(1, 'alpha'), iso(2, 'beta'), iso(3, 'alpha')].join('\n'), {
    format: 'iso',
    zone: 'UTC'
  });

  it('marks only the entries holding the term', () => {
    const mask = matchMask(parsed.text, 'alpha', parsed.starts, parsed.ends);
    expect(Array.from(mask)).toEqual([1, 0, 1]);
  });

  it('ignores case without lowercasing the text out from under the offsets', () => {
    const mask = matchMask(parsed.text, 'ALPHA', parsed.starts, parsed.ends);
    expect(Array.from(mask)).toEqual([1, 0, 1]);
  });

  it('keeps the right entry when a character lowercases to two', () => {
    const odd = parse([iso(1, 'İstanbul'), iso(2, 'needle')].join('\n'), {
      format: 'iso',
      zone: 'UTC'
    });
    const mask = matchMask(odd.text, 'needle', odd.starts, odd.ends);
    expect(Array.from(mask)).toEqual([0, 1]);
  });

  it('treats the term as text, not as a pattern', () => {
    const dotted = parse([iso(1, 'a.c'), iso(2, 'abc')].join('\n'), { format: 'iso', zone: 'UTC' });
    const mask = matchMask(dotted.text, 'a.c', dotted.starts, dotted.ends);
    expect(Array.from(mask)).toEqual([1, 0]);
  });

  it('marks an entry when the term is on an attached line', () => {
    const stacked = parse(`${iso(1, 'boom')}\n  at needle\n${iso(2, 'fine')}`, {
      format: 'iso',
      zone: 'UTC'
    });
    const mask = matchMask(stacked.text, 'needle', stacked.starts, stacked.ends);
    expect(Array.from(mask)).toEqual([1, 0]);
  });

  it('marks everything when there is no term', () => {
    const mask = matchMask(parsed.text, '', parsed.starts, parsed.ends);
    expect(Array.from(mask)).toEqual([1, 1, 1]);
  });
});

describe('span', () => {
  it('takes the true extremes, not the first and last line', () => {
    const lanes = [lane([iso(9, 'late'), iso(1, 'early')].join('\n'))];
    expect(spanOf(lanes)).toEqual([Date.UTC(2026, 7, 17, 0, 0, 1), Date.UTC(2026, 7, 17, 0, 0, 9)]);
  });

  it('shifts with the offset', () => {
    expect(spanOf([lane(iso(1, 'a'), 1000)])).toEqual([
      Date.UTC(2026, 7, 17, 0, 0, 2),
      Date.UTC(2026, 7, 17, 0, 0, 2)
    ]);
  });

  it('is null with nothing loaded', () => {
    expect(spanOf([])).toBeNull();
  });
});

describe('render', () => {
  it('writes the shifted time, the source name and the line', () => {
    const lanes = [lane(iso(1, 'a1'), 1000), lane(iso(2, 'b1'))];
    const text = render(lanes, merge(lanes), { zone: 'UTC', names: ['api', 'db'], delta: false });
    expect(text.split('\n')).toEqual([
      '2026-08-17 00:00:02.000  api  2026-08-17T00:00:01Z a1',
      '2026-08-17 00:00:02.000  db   2026-08-17T00:00:02Z b1'
    ]);
  });

  it('indents attached lines under their entry', () => {
    const lanes = [lane(`${iso(1, 'boom')}\n  at thing`)];
    const lines = render(lanes, merge(lanes), { zone: 'UTC', names: ['api'], delta: false }).split(
      '\n'
    );
    expect(lines[1].startsWith(' '.repeat(lines[0].indexOf('2026-08-17T')))).toBe(true);
  });
});
