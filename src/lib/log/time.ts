import { offsetAt } from './zone';

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

/** How far towards `limit` the offset stays what it is at `time` */
function holdsUntil(time: number, limit: number, zone: string, offset: number) {
  if (offsetAt(limit, zone) === offset) return limit;
  while (Math.abs(limit - time) > 1000) {
    const middle = time + Math.trunc((limit - time) / 2);
    if (offsetAt(middle, zone) === offset) time = middle;
    else limit = middle;
  }
  return time;
}

/**
 * Caches the zone offset for a window either side of the last lookup, stopping
 * at a DST change. Calling Intl once per row is fine for a screenful and far
 * too slow for an export.
 */
export function clock(zone: string) {
  const WINDOW = 3 * 3600000;
  let offset = 0;
  let from = 1;
  let to = 0;

  const offsetFor = (time: number) => {
    if (time < from || time >= to) {
      offset = offsetAt(time, zone);
      from = holdsUntil(time, time - WINDOW, zone, offset);
      to = holdsUntil(time, time + WINDOW, zone, offset) + 1;
    }
    return offset;
  };

  const parts = (time: number) => new Date(time + offsetFor(time));

  return {
    offsetFor,
    date: (time: number) => {
      const at = parts(time);
      return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
    },
    time: (time: number) => {
      const at = parts(time);
      const hms = `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())}`;
      return `${hms}.${pad(at.getUTCMilliseconds(), 3)}`;
    },
    full(time: number) {
      return `${this.date(time)} ${this.time(time)}`;
    }
  };
}

export type Clock = ReturnType<typeof clock>;

export function formatDelta(delta: number) {
  if (!Number.isFinite(delta)) return '';
  const sign = delta < 0 ? '-' : '+';
  const value = Math.abs(delta);
  if (value < 1000) return `${sign}${value.toFixed(0)}ms`;
  if (value < 60000) return `${sign}${(value / 1000).toFixed(3)}s`;
  const seconds = Math.floor(value / 1000);
  if (value < 3600000) return `${sign}${Math.floor(seconds / 60)}m${pad(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  if (value < 86400000) return `${sign}${hours}h${pad(Math.floor(seconds / 60) % 60)}m`;
  return `${sign}${Math.floor(hours / 24)}d${pad(hours % 24)}h`;
}

/** Signed millisecond offsets read better with the unit that suits their size */
export function formatOffset(offset: number) {
  if (offset === 0) return '0';
  const sign = offset < 0 ? '-' : '+';
  const value = Math.abs(offset);
  if (value < 1000) return `${sign}${value}ms`;
  if (value < 60000) return `${sign}${(value / 1000).toFixed(3).replace(/\.?0+$/, '')}s`;
  return `${sign}${formatDelta(value).slice(1)}`;
}
