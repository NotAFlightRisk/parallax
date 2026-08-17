const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    formatters.set(zone, formatter);
  }
  return formatter;
}

function partsAt(instant: number, zone: string) {
  const parts = formatterFor(zone).formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second')
  );
}

/** Milliseconds the zone is ahead of UTC at that instant */
export function offsetAt(instant: number, zone: string) {
  return partsAt(instant, zone) - Math.floor(instant / 1000) * 1000;
}

/**
 * Wall-clock fields in a zone back to an instant. Two passes because the offset
 * we need depends on the answer we are trying to find.
 */
export function fromZoned(utcGuess: number, zone: string) {
  const first = utcGuess - offsetAt(utcGuess, zone);
  return utcGuess - offsetAt(first, zone);
}

export function isValidZone(zone: string) {
  try {
    formatterFor(zone);
    return true;
  } catch {
    return false;
  }
}

export function localZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Every zone the engine knows, UTC first. Deterministic, so it survives hydration */
export function zoneChoices() {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const all = supported ? supported('timeZone') : [];
  return ['UTC', ...all.filter((zone) => zone !== 'UTC')];
}
