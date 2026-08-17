/** Keeps a dragged control from queueing more work than the browser can draw */
export function perFrame<T>(apply: (value: T) => void) {
  let pending: T;
  let queued = false;
  return (value: T) => {
    pending = value;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply(pending);
    });
  };
}
