import { indexOf, sourceOf, type Lane, type Merged } from './merge';
import { lineText } from './lines';
import { clock, formatDelta } from './time';

export type RenderOptions = { zone: string; names: string[]; delta: boolean };

/** The merged view as plain text, offsets already baked into the timestamps */
export function render(lanes: Lane[], merged: Merged, options: RenderOptions) {
  const stamp = clock(options.zone);
  const width = Math.max(...options.names.map((name) => name.length), 0);
  const out: string[] = [];
  let previous = NaN;

  for (let row = 0; row < merged.order.length; row += 1) {
    const slot = merged.order[row];
    const lane = lanes[sourceOf(slot)];
    const entry = indexOf(slot);
    const time = merged.times[row];
    const delta = options.delta ? ` ${deltaCell(time - previous)}` : '';
    const name = options.names[sourceOf(slot)].padEnd(width);
    const head = `${stamp.full(time)}${delta}  ${name}  `;
    out.push(head + lineText(lane.parsed, entry, 0));
    for (let line = 1; line < lane.parsed.lines[entry]; line += 1) {
      out.push(' '.repeat(head.length) + lineText(lane.parsed, entry, line));
    }
    previous = time;
  }
  return out.join('\n');
}

function deltaCell(delta: number) {
  return formatDelta(delta).padStart(9);
}
