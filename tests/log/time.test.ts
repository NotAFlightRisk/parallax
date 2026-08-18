import { describe, expect, it } from 'vitest';
import { clock } from '../../src/lib/log/time';

const at = (iso: string) => Date.parse(iso);

const cold = (zone: string, time: number) => clock(zone).full(time);

const warmed = (zone: string, first: number, second: number) => {
  const stamp = clock(zone);
  stamp.full(first);
  return stamp.full(second);
};

describe('clock', () => {
  it('holds its offset for a later row in the same window', () => {
    const noon = at('2026-08-17T12:00:00Z');
    expect(warmed('Europe/London', noon, noon + 7200000)).toBe('2026-08-17 15:00:00.000');
  });

  it('follows the clocks going back', () => {
    const before = at('2026-10-24T23:30:00Z');
    const after = at('2026-10-25T02:00:00Z');
    expect(cold('Europe/London', after)).toBe('2026-10-25 02:00:00.000');
    expect(warmed('Europe/London', before, after)).toBe('2026-10-25 02:00:00.000');
  });

  it('follows the clocks going forward', () => {
    const before = at('2026-03-08T06:00:00Z');
    const after = at('2026-03-08T08:00:00Z');
    expect(cold('America/New_York', after)).toBe('2026-03-08 04:00:00.000');
    expect(warmed('America/New_York', before, after)).toBe('2026-03-08 04:00:00.000');
  });

  it('follows a change reached by reading backwards', () => {
    const after = at('2026-10-25T03:00:00Z');
    const before = at('2026-10-25T00:30:00Z');
    expect(warmed('Europe/London', after, before)).toBe('2026-10-25 01:30:00.000');
  });

  it('keeps the ambiguous hour in order', () => {
    const edge = at('2026-10-25T01:00:00Z');
    expect(cold('Europe/London', edge)).toBe('2026-10-25 01:00:00.000');
    expect(warmed('Europe/London', edge, edge - 1)).toBe('2026-10-25 01:59:59.999');
  });
});
