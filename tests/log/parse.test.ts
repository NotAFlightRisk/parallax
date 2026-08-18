import { describe, expect, it } from 'vitest';
import { parse } from '../../src/lib/log/parse';
import { lineText } from '../../src/lib/log/lines';
import { detect, epochFrom } from '../../src/lib/log/formats';
import type { ParseOptions } from '../../src/lib/log/types';

const NOW = Date.UTC(2026, 7, 17, 12, 0, 0);
const options = (extra: Partial<ParseOptions> = {}): ParseOptions => ({
  format: 'auto',
  zone: 'UTC',
  ...extra
});

const run = (text: string, extra: Partial<ParseOptions> = {}) =>
  parse(text, options(extra), { now: NOW });

describe('format detection', () => {
  it('picks ISO 8601 over a bare epoch when both could match', () => {
    expect(detect(['2026-08-17T00:23:45Z hello']).format).toBe('iso');
  });

  it('picks CLF for an access log line', () => {
    const line = '1.2.3.4 - - [17/Aug/2026:00:23:45 +0100] "GET / HTTP/1.1" 200 12';
    expect(detect([line]).format).toBe('clf');
  });

  it('calls a syslog line syslog, not journalctl, when it has no sub-second part', () => {
    expect(detect(['Aug 17 00:23:45 host sshd[1]: hi']).format).toBe('syslog');
  });

  it('calls it journalctl once microseconds show up', () => {
    expect(detect(['Aug 17 00:23:45.123456 host sshd[1]: hi']).format).toBe('journalctl');
  });

  it('reports no hits for something that is not a log', () => {
    expect(detect(['just some prose', 'and more of it']).hits).toBe(0);
  });
});

describe('epoch units', () => {
  it('reads ten digits as seconds', () => {
    expect(epochFrom('1755388800')).toBe(1755388800000);
  });

  it('reads thirteen digits as milliseconds', () => {
    expect(epochFrom('1755388800123')).toBe(1755388800123);
  });

  it('reads sixteen digits as microseconds', () => {
    expect(epochFrom('1755388800123456')).toBe(1755388800123.456);
  });

  it('reads nineteen digits as nanoseconds', () => {
    expect(Math.round(epochFrom('1755388800123456789'))).toBe(1755388800123);
  });

  it('reads eighteen digits as nanoseconds, not far-future microseconds', () => {
    expect(Math.round(epochFrom('175538880012345678'))).toBe(175538880012);
  });

  it('adds a fraction in the same unit as the whole part', () => {
    expect(epochFrom('1755388800', '5')).toBe(1755388800500);
  });
});

describe('parsing', () => {
  it('honours an offset written on the line', () => {
    const parsed = run('2026-08-17T01:00:00+01:00 up');
    expect(parsed.times[0]).toBe(Date.UTC(2026, 7, 17, 0, 0, 0));
  });

  it('falls back to the source zone when the line states none', () => {
    const parsed = run('2026-08-17 01:00:00 up', { format: 'iso', zone: 'Europe/London' });
    expect(parsed.times[0]).toBe(Date.UTC(2026, 7, 17, 0, 0, 0));
  });

  it('reads a Go UnixNano log as nanoseconds, not the year 57596', () => {
    const parsed = run('1755388800123456789 boot\n1755388801123456789 ready');
    expect(Math.round(parsed.times[0])).toBe(Date.UTC(2025, 7, 17, 0, 0, 0, 123));
    expect(Math.round(parsed.times[1] - parsed.times[0])).toBe(1000);
  });

  it('attaches unparseable lines to the entry above so stack traces survive', () => {
    const text = [
      '2026-08-17T00:00:00Z boom',
      '  at thing (a.js:1)',
      '  at other (b.js:2)',
      '2026-08-17T00:00:01Z next'
    ].join('\n');
    const parsed = run(text);
    expect(parsed.times).toHaveLength(2);
    expect(parsed.lines[0]).toBe(3);
    expect(parsed.text.slice(parsed.starts[0], parsed.ends[0])).toContain('at other');
  });

  it('keeps a blank line that falls inside an entry', () => {
    const text = [
      '2026-08-17T00:00:00Z boom',
      'Traceback (most recent call last):',
      '',
      '  at other (b.js:2)',
      '2026-08-17T00:00:01Z next'
    ].join('\n');
    const parsed = run(text);
    expect(parsed.lines[0]).toBe(4);
    expect(lineText(parsed, 0, 3)).toBe('  at other (b.js:2)');
  });

  it('drops a blank line sitting between two entries', () => {
    const parsed = run('2026-08-17T00:00:00Z up\n\n2026-08-17T00:00:01Z next');
    expect(parsed.lines[0]).toBe(1);
  });

  it('reads a CRLF entry without leaving carriage returns in the text', () => {
    const text = '2026-08-17T00:00:00Z boom\r\nTraceback:\r\n\r\n  at other (b.js:2)\r\n';
    const parsed = run(text);
    expect(parsed.lines[0]).toBe(4);
    expect(lineText(parsed, 0, 1)).toBe('Traceback:');
    expect(lineText(parsed, 0, 3)).toBe('  at other (b.js:2)');
  });

  it('drops a CRLF blank line sitting between two entries', () => {
    const parsed = run('2026-08-17T00:00:00Z up\r\n\r\n2026-08-17T00:00:01Z next\r\n');
    expect(parsed.lines[0]).toBe(1);
    expect(parsed.unmatched).toBe(0);
  });

  it('keeps a header that arrives before the first timestamp', () => {
    const parsed = run('== boot ==\n2026-08-17T00:00:00Z up');
    expect(parsed.times).toHaveLength(1);
    expect(parsed.lines[0]).toBe(2);
    expect(parsed.text.slice(parsed.starts[0], parsed.ends[0])).toContain('== boot ==');
  });

  it('counts lines it could not place', () => {
    const parsed = run('2026-08-17T00:00:00Z up\nnope\nnope');
    expect(parsed.total).toBe(3);
    expect(parsed.unmatched).toBe(2);
  });

  it('infers the current year for syslog', () => {
    const parsed = run('Aug 17 00:00:00 host sshd[1]: hi');
    expect(new Date(parsed.times[0]).getUTCFullYear()).toBe(2026);
  });

  it('steps back a year when that would put the log in the future', () => {
    const parsed = run('Dec 25 00:00:00 host sshd[1]: hi');
    expect(new Date(parsed.times[0]).getUTCFullYear()).toBe(2025);
  });

  it('honours an hour-only ISO offset', () => {
    const parsed = run('2026-08-17T01:00:00+01 up');
    expect(parsed.times[0]).toBe(Date.UTC(2026, 7, 17, 0, 0, 0));
  });

  it('records the true extremes even when lines arrive out of order', () => {
    const parsed = run('2026-08-17T00:00:09Z late\n2026-08-17T00:00:01Z early');
    expect(parsed.low).toBe(Date.UTC(2026, 7, 17, 0, 0, 1));
    expect(parsed.high).toBe(Date.UTC(2026, 7, 17, 0, 0, 9));
  });

  it('rolls the year forward when a yearless log crosses new year', () => {
    const parsed = run('Dec 31 23:59:59 host a[1]: x\nJan 01 00:00:01 host a[1]: y');
    const years = Array.from(parsed.times, (time) => new Date(time).getUTCFullYear());
    expect(years).toEqual([2025, 2026]);
  });

  it('does not roll the year for a few seconds of out-of-order logging', () => {
    const parsed = run('Aug 17 00:00:05 host a[1]: x\nAug 17 00:00:01 host a[1]: y');
    const years = Array.from(parsed.times, (time) => new Date(time).getUTCFullYear());
    expect(years).toEqual([2026, 2026]);
  });

  it('does not roll the year for a mid-year jump backwards', () => {
    const parsed = run('Aug 17 00:00:00 host a[1]: x\nJun 01 00:00:00 host a[1]: y');
    const years = Array.from(parsed.times, (time) => new Date(time).getUTCFullYear());
    expect(years).toEqual([2026, 2026]);
  });

  it('infers the year in the source zone, not in UTC', () => {
    const newYear = Date.UTC(2026, 11, 31, 23, 30);
    const parsed = parse('Jan 01 13:30:00 host a[1]: hi', options({ zone: 'Pacific/Kiritimati' }), {
      now: newYear
    });
    expect(parsed.times[0]).toBe(newYear);
  });

  it('reads a custom regex through its named groups', () => {
    const parsed = run('[00:00:05.250] tick', {
      format: 'custom',
      pattern: '^\\[(?<hour>\\d\\d):(?<minute>\\d\\d):(?<second>\\d\\d)\\.(?<frac>\\d+)\\]'
    });
    expect(parsed.times).toHaveLength(1);
    expect(new Date(parsed.times[0]).getUTCMilliseconds()).toBe(250);
  });

  it('leaves every line unmatched when the custom regex finds nothing', () => {
    const parsed = run('hello\nworld', { format: 'custom', pattern: '^(?<hour>\\d\\d)Z' });
    expect(parsed.times).toHaveLength(0);
    expect(parsed.unmatched).toBe(2);
  });

  it('reports progress and finishes at the full length', () => {
    const seen: number[] = [];
    const text = '2026-08-17T00:00:00Z up';
    parse(text, options(), { now: NOW, onProgress: (done) => seen.push(done) });
    expect(seen.at(-1)).toBe(text.length);
  });
});
