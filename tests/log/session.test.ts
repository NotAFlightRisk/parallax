import { describe, expect, it } from 'vitest';
import { fromSession, toSession } from '../../src/lib/log/session';
import { clock, formatDelta, formatOffset } from '../../src/lib/log/time';
import type { Source } from '../../src/lib/log/types';

const source = (extra: Partial<Source> = {}): Source => ({
  id: 'one',
  name: 'api',
  colour: '#7aa2f7',
  text: '2026-08-17T00:00:00Z secret log content',
  options: { format: 'iso', zone: 'UTC' },
  offset: 250,
  enabled: true,
  ...extra
});

describe('session files', () => {
  it('keeps the settings and none of the log', () => {
    const saved = JSON.stringify(toSession([source()], 'Europe/London'));
    expect(saved).toContain('"api"');
    expect(saved).not.toContain('secret log content');
  });

  it('survives a round trip', () => {
    const session = toSession([source()], 'Europe/London');
    const loaded = fromSession(JSON.stringify(session));
    expect(loaded).toEqual(session);
  });

  it('rejects a file from another tool', () => {
    expect(() => fromSession('{"app":"something-else","version":1}')).toThrow(/not a Parallax/);
  });

  it('rejects a version it does not know', () => {
    expect(() => fromSession('{"app":"parallax","version":99,"zone":"UTC","sources":[]}')).toThrow(
      /version 99/
    );
  });

  it('rejects a source with an unknown format', () => {
    const bad = {
      app: 'parallax',
      version: 1,
      zone: 'UTC',
      sources: [{ name: 'api', options: { format: 'runes', zone: 'UTC' } }]
    };
    expect(() => fromSession(JSON.stringify(bad))).toThrow(/unknown format/);
  });

  it('rejects a source with an unknown zone', () => {
    const bad = {
      app: 'parallax',
      version: 1,
      zone: 'UTC',
      sources: [{ name: 'api', options: { format: 'iso', zone: 'Mars/Olympus' } }]
    };
    expect(() => fromSession(JSON.stringify(bad))).toThrow(/unknown time zone/);
  });

  it('says so plainly when the file is not JSON', () => {
    expect(() => fromSession('nope')).toThrow(/not JSON/);
  });
});

describe('display helpers', () => {
  it('shows a zone offset in the timestamp it prints', () => {
    const london = clock('Europe/London');
    expect(london.full(Date.UTC(2026, 7, 17, 0, 0, 0))).toBe('2026-08-17 01:00:00.000');
  });

  it('tracks a daylight saving change rather than caching through it', () => {
    const london = clock('Europe/London');
    expect(london.time(Date.UTC(2026, 6, 1, 12))).toBe('13:00:00.000');
    expect(london.time(Date.UTC(2026, 0, 1, 12))).toBe('12:00:00.000');
  });

  it('scales the delta unit to its size', () => {
    expect(formatDelta(12)).toBe('+12ms');
    expect(formatDelta(1500)).toBe('+1.500s');
    expect(formatDelta(65000)).toBe('+1m05s');
    expect(formatDelta(3665000)).toBe('+1h01m');
  });

  it('signs a negative delta', () => {
    expect(formatDelta(-12)).toBe('-12ms');
  });

  it('trims trailing zeroes off a whole-second offset', () => {
    expect(formatOffset(2000)).toBe('+2s');
    expect(formatOffset(0)).toBe('0');
  });
});
