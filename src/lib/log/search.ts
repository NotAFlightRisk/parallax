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

/**
 * One pass over the whole text for every match, then a binary search per hit.
 * Calling indexOf once per entry is quadratic when the term is rare.
 */
export function matchMask(lower: string, needle: string, starts: Uint32Array, ends: Uint32Array) {
  const mask = new Uint8Array(starts.length);
  if (!starts.length) return mask;
  if (!needle) return mask.fill(1);
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + 1)) {
    const entry = entryAt(starts, at);
    if (at < ends[entry]) mask[entry] = 1;
  }
  return mask;
}
