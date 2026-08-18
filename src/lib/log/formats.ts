import type { FormatId } from './types';
import { fromZoned } from './zone';

const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

export type Fields = {
  year?: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
  /** Minutes east of UTC when the line states one, otherwise the source zone wins */
  offset?: number;
};

export type Stamp = { epoch: number } | Fields;

export type Format = {
  id: FormatId;
  label: string;
  hint: string;
  read(head: string): Stamp | null;
};

const num = (value: string | undefined) => (value === undefined ? 0 : Number(value));

function monthFrom(name: string) {
  const index = MONTHS.indexOf(name.slice(0, 3).toLowerCase());
  return index < 0 ? Number(name) : index + 1;
}

/** Pads or trims a fractional string to milliseconds */
function msFrom(fraction: string | undefined) {
  return fraction ? Math.floor(Number(`0.${fraction}`) * 1000) : 0;
}

function offsetFrom(token: string | undefined) {
  if (token === undefined) return undefined;
  if (token === 'Z' || token === 'z') return 0;
  const sign = token[0] === '-' ? -1 : 1;
  const digits = token.slice(1).replace(':', '');
  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)));
}

/** Two-digit years are this century, because nobody is grepping 1998 */
function yearFrom(value: string | undefined) {
  if (value === undefined) return undefined;
  const year = Number(value);
  return year < 100 ? year + 2000 : year;
}

/** Digit count tells us the unit, since nobody writes microseconds for 1970 */
export function epochFrom(digits: string, fraction?: string) {
  const value = Number(digits);
  const { length } = digits;
  const scale = length <= 11 ? 1000 : length <= 14 ? 1 : length <= 17 ? 0.001 : 0.000001;
  return value * scale + (fraction ? Number(`0.${fraction}`) * scale : 0);
}

const ISO =
  /^\[?(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(Z|z|[+-]\d{2}(?::?\d{2})?)?/;
const BSD =
  /^(?:<\d{1,3}>)?([A-Z][a-z]{2}) {1,2}(\d{1,2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?=\s)/;
const CLF =
  /^\S+ \S+ \S+ \[(\d{2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\]/;
const GO = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?/;
const EPOCH = /^\[?(\d{9,19})(?:\.(\d{1,9}))?(?=\D|$)/;

function readIso(head: string): Stamp | null {
  const match = ISO.exec(head);
  if (!match) return null;
  return {
    year: num(match[1]),
    month: num(match[2]),
    day: num(match[3]),
    hour: num(match[4]),
    minute: num(match[5]),
    second: num(match[6]),
    ms: msFrom(match[7]),
    offset: offsetFrom(match[8])
  };
}

function readBsd(head: string): Stamp | null {
  const match = BSD.exec(head);
  if (!match) return null;
  return {
    month: monthFrom(match[1]),
    day: num(match[2]),
    hour: num(match[3]),
    minute: num(match[4]),
    second: num(match[5]),
    ms: msFrom(match[6])
  };
}

export const FORMATS: Record<FormatId, Format> = {
  iso: {
    id: 'iso',
    label: 'ISO 8601',
    hint: '2026-08-17T00:23:45.123Z',
    read: readIso
  },
  journalctl: {
    id: 'journalctl',
    label: 'journalctl short',
    hint: 'Aug 17 00:23:45.123456 host unit[9]:',
    read: readBsd
  },
  syslog: {
    id: 'syslog',
    label: 'RFC 3164 syslog',
    hint: '<34>Aug 17 00:23:45 host su:',
    read: readBsd
  },
  clf: {
    id: 'clf',
    label: 'CLF / combined',
    hint: '1.2.3.4 - - [17/Aug/2026:00:23:45 +0100]',
    read(head) {
      const match = CLF.exec(head);
      if (!match) return null;
      return {
        year: num(match[3]),
        month: monthFrom(match[2]),
        day: num(match[1]),
        hour: num(match[4]),
        minute: num(match[5]),
        second: num(match[6]),
        ms: 0,
        offset: offsetFrom(match[7])
      };
    }
  },
  go: {
    id: 'go',
    label: 'Go stdlib',
    hint: '2026/08/17 00:23:45.123456',
    read(head) {
      const match = GO.exec(head);
      if (!match) return null;
      return {
        year: num(match[1]),
        month: num(match[2]),
        day: num(match[3]),
        hour: num(match[4]),
        minute: num(match[5]),
        second: num(match[6]),
        ms: msFrom(match[7])
      };
    }
  },
  epoch: {
    id: 'epoch',
    label: 'Epoch',
    hint: '1755388800.123 (s, ms, µs or ns)',
    read(head) {
      const match = EPOCH.exec(head);
      return match ? { epoch: epochFrom(match[1], match[2]) } : null;
    }
  },
  custom: {
    id: 'custom',
    label: 'Custom regex',
    hint: '(?<hour>\\d\\d):(?<minute>\\d\\d):(?<second>\\d\\d)',
    read: () => null
  }
};

export const CUSTOM_GROUPS = [
  'epoch',
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'frac',
  'offset'
];

/** Builds a reader from a user regex using the named groups above */
export function customReader(pattern: string): Format['read'] {
  const regex = new RegExp(pattern);
  return (head) => {
    const groups = regex.exec(head)?.groups;
    if (!groups) return null;
    if (groups.epoch) return { epoch: epochFrom(groups.epoch, groups.frac) };
    if (groups.hour === undefined) return null;
    return {
      year: yearFrom(groups.year),
      month: groups.month === undefined ? 1 : monthFrom(groups.month),
      day: groups.day === undefined ? 1 : Number(groups.day),
      hour: Number(groups.hour),
      minute: num(groups.minute),
      second: num(groups.second),
      ms: msFrom(groups.frac),
      offset: offsetFrom(groups.offset)
    };
  };
}

export function readerFor(format: FormatId, pattern?: string) {
  return format === 'custom' ? customReader(pattern ?? '') : FORMATS[format].read;
}

/** Wall-clock fields to an instant, using the source zone when the line has no offset */
export function resolve(fields: Fields, year: number, zone: string) {
  const utc = Date.UTC(
    fields.year ?? year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second,
    fields.ms
  );
  return fields.offset === undefined ? fromZoned(utc, zone) : utc - fields.offset * 60000;
}

export const NEEDS_YEAR: FormatId[] = ['journalctl', 'syslog'];

/** Most specific first, so a journalctl line is not mistaken for a bare epoch */
const DETECT_ORDER: FormatId[] = ['clf', 'iso', 'go', 'journalctl', 'epoch'];

export type Detection = { format: FormatId; hits: number; sampled: number };

export function detect(heads: string[]): Detection {
  let best: Detection = { format: 'iso', hits: 0, sampled: heads.length };
  for (const format of DETECT_ORDER) {
    const read = FORMATS[format].read;
    let hits = 0;
    for (const head of heads) if (read(head)) hits += 1;
    if (hits > best.hits) best = { format, hits, sampled: heads.length };
    if (hits === heads.length && hits > 0) break;
  }
  if (best.format === 'journalctl' && !heads.some((head) => /:\d{2}\.\d/.test(head))) {
    best = { ...best, format: 'syslog' };
  }
  return best;
}
