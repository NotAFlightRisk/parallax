/** Index of the last entry starting at or before `position` */
export function entryAt(starts: Uint32Array, position: number) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= position) low = mid;
    else high = mid - 1;
  }
  return low;
}

const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One pass over the whole text for every match, then a binary search per hit.
 * Calling indexOf once per entry is quadratic when the term is rare, and matching
 * against a lowercased copy would break the offsets, since toLowerCase can change
 * a string's length.
 */
export function matchMask(text: string, needle: string, starts: Uint32Array, ends: Uint32Array) {
  const mask = new Uint8Array(starts.length);
  if (!starts.length) return mask;
  if (!needle) return mask.fill(1);

  const pattern = new RegExp(escape(needle), 'gi');
  for (let hit = pattern.exec(text); hit; hit = pattern.exec(text)) {
    const entry = entryAt(starts, hit.index);
    if (hit.index < ends[entry]) mask[entry] = 1;
    if (pattern.lastIndex === hit.index) pattern.lastIndex += 1;
  }
  return mask;
}
