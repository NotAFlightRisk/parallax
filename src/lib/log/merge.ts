import type { Parsed } from './types';

/** Six sources max, so four bits of source and twenty-eight of index fit in one slot */
const INDEX_BITS = 28;
const INDEX_MASK = (1 << INDEX_BITS) - 1;

export const sourceOf = (slot: number) => slot >>> INDEX_BITS;
export const indexOf = (slot: number) => slot & INDEX_MASK;

export type Lane = {
  parsed: Parsed;
  offset: number;
  mask?: Uint8Array;
};

export type Merged = {
  order: Uint32Array;
  times: Float64Array;
  /** Rows before each entry, so a scroll position maps to an entry and a line */
  rowStarts: Uint32Array;
  rows: number;
  span: [number, number] | null;
};

/** Each lane is sorted, so its ends are its extremes. No merge needed for this */
export function spanOf(lanes: Lane[]): [number, number] | null {
  let low = Infinity;
  let high = -Infinity;
  for (const { parsed, offset } of lanes) {
    if (!parsed.times.length) continue;
    low = Math.min(low, parsed.times[0] + offset);
    high = Math.max(high, parsed.times[parsed.times.length - 1] + offset);
  }
  return low === Infinity ? null : [low, high];
}

/**
 * A k-way merge, not a sort: an offset shifts a whole source, so each lane is
 * still in order and only the interleaving changes.
 */
export function merge(lanes: Lane[], range?: [number, number] | null): Merged {
  const width = lanes.length;
  const allTimes = lanes.map((lane) => lane.parsed.times);
  const allLines = lanes.map((lane) => lane.parsed.lines);
  const masks = lanes.map((lane) => lane.mask);
  const offsets = Float64Array.from(lanes, (lane) => lane.offset);
  const from = range ? range[0] : -Infinity;
  const to = range ? range[1] : Infinity;

  let capacity = 0;
  for (const times of allTimes) capacity += times.length;

  const order = new Uint32Array(capacity);
  const times = new Float64Array(capacity);
  const rowStarts = new Uint32Array(capacity + 1);
  const cursors = new Uint32Array(width);
  /** Head time per lane, Infinity once a lane is spent. Keeps the pick loop tiny */
  const heads = new Float64Array(width);
  let count = 0;
  let rows = 0;

  const advance = (lane: number) => {
    const laneTimes = allTimes[lane];
    const mask = masks[lane];
    const offset = offsets[lane];
    for (let index = cursors[lane]; index < laneTimes.length; index += 1) {
      const time = laneTimes[index] + offset;
      if ((!mask || mask[index] === 1) && time >= from && time <= to) {
        cursors[lane] = index;
        heads[lane] = time;
        return;
      }
    }
    cursors[lane] = laneTimes.length;
    heads[lane] = Infinity;
  };

  for (let lane = 0; lane < width; lane += 1) advance(lane);

  for (;;) {
    let pick = -1;
    let best = Infinity;
    for (let lane = 0; lane < width; lane += 1) {
      if (heads[lane] < best) {
        best = heads[lane];
        pick = lane;
      }
    }
    if (pick === -1) break;

    const index = cursors[pick];
    order[count] = (pick << INDEX_BITS) | index;
    times[count] = best;
    rowStarts[count] = rows;
    rows += allLines[pick][index];
    count += 1;

    cursors[pick] = index + 1;
    advance(pick);
  }

  rowStarts[count] = rows;
  return {
    order: order.subarray(0, count),
    times: times.subarray(0, count),
    rowStarts: rowStarts.subarray(0, count + 1),
    rows,
    span: count ? [times[0], times[count - 1]] : null
  };
}

/** Index of the entry owning a given row */
export function entryForRow(rowStarts: Uint32Array, row: number) {
  let low = 0;
  let high = rowStarts.length - 2;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (rowStarts[mid] <= row) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** First entry at or after a time, for seeking from the density strip */
export function entryForTime(times: Float64Array, time: number) {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (times[mid] < time) low = mid + 1;
    else high = mid;
  }
  return Math.min(low, Math.max(0, times.length - 1));
}

/** Per-lane counts over a fixed number of buckets, for the density strip */
export function density(lanes: Lane[], span: [number, number], buckets: number) {
  const scale = (buckets - 1) / Math.max(1, span[1] - span[0]);
  return lanes.map(({ parsed, offset, mask }) => {
    const counts = new Uint32Array(buckets);
    const times = parsed.times;
    const shift = offset - span[0];
    for (let index = 0; index < times.length; index += 1) {
      if (mask && mask[index] !== 1) continue;
      const at = ((times[index] + shift) * scale) | 0;
      if (at >= 0 && at < buckets) counts[at] += 1;
    }
    return counts;
  });
}
