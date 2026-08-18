import { browser } from '$app/environment';
import { density, merge, sourceOf, spanOf, type Lane } from '../log/merge';
import { matchMask } from '../log/search';
import { fromSession, toSession } from '../log/session';
import { localZone } from '../log/zone';
import type { ParseOptions, Source, WorkerRequest, WorkerResponse } from '../log/types';

export const PALETTE = ['#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#bb9af7', '#7dcfff'];
export const MAX_SOURCES = PALETTE.length;
const DENSITY_BUCKETS = 240;

let counter = 0;
const nextId = () => `s${(counter += 1)}`;

/** First colour nobody is using, so a source that goes hands its own back */
const freeColour = (sources: Source[]) =>
  PALETTE.find((colour) => !sources.some((source) => source.colour === colour)) ?? PALETTE[0];

/** Same idea for the name a pasted source gets when nobody titled it */
const freeName = (sources: Source[]) => {
  let at = 1;
  while (sources.some((source) => source.name === `source ${at}`)) at += 1;
  return `source ${at}`;
};

export class Workspace {
  /** Raw, because a source holds megabytes of text and typed arrays */
  sources = $state.raw<Source[]>([]);
  zone = $state(browser ? localZone() : 'UTC');
  query = $state('');
  range = $state.raw<[number, number] | null>(null);
  cursor = $state(0);
  showDelta = $state(true);
  anchor = $state.raw<{ source: string; time: number } | null>(null);
  anchoring = $state(false);
  notice = $state('');

  /** Live parse per source, so a superseded run cannot land after the one that replaced it */
  private runs = new Map<string, { run: number; worker: Worker }>();
  private counter = 0;

  lanes: Lane[] = $derived.by(() => {
    const needle = this.query.trim().toLowerCase();
    return this.visible.map((source) => ({
      parsed: source.parsed!,
      offset: source.offset,
      mask: needle
        ? matchMask(source.text, needle, source.parsed!.starts, source.parsed!.ends)
        : undefined
    }));
  });

  visible = $derived(this.sources.filter((source) => source.enabled && source.parsed));
  merged = $derived(merge(this.lanes, this.range));
  /** The whole span, ignoring filters, so zooming out again is always possible */
  span = $derived(spanOf(this.lanes));
  bands = $derived(this.span ? density(this.lanes, this.span, DENSITY_BUCKETS) : []);

  sourceAt(row: number) {
    return this.visible[sourceOf(this.merged.order[row])];
  }

  add(name: string, text: string, options?: Partial<ParseOptions>) {
    const title = name || freeName(this.sources);
    if (this.sources.length >= MAX_SOURCES) {
      this.notice = `Six sources is the limit, so ${title} was left out`;
      return;
    }
    const source: Source = {
      id: nextId(),
      name: title,
      colour: freeColour(this.sources),
      text: text.includes('\r') ? text.replace(/\r/g, '') : text,
      options: { format: 'auto', zone: this.zone, ...options },
      offset: 0,
      enabled: true,
      progress: 0
    };
    this.sources = [...this.sources, source];
    this.parse(source.id);
  }

  update(id: string, patch: Partial<Source>) {
    this.sources = this.sources.map((source) =>
      source.id === id ? { ...source, ...patch } : source
    );
  }

  remove(id: string) {
    this.runs.get(id)?.worker.terminate();
    this.runs.delete(id);
    this.sources = this.sources.filter((source) => source.id !== id);
    if (this.anchor?.source === id) this.anchor = null;
  }

  reparse(id: string, options: Partial<ParseOptions>) {
    const source = this.sources.find((entry) => entry.id === id);
    if (!source) return;
    this.update(id, { options: { ...source.options, ...options }, error: undefined });
    this.parse(id);
  }

  /** One worker per request, so six pasted files parse at once */
  private parse(id: string) {
    const source = this.sources.find((entry) => entry.id === id);
    if (!source) return;
    this.runs.get(id)?.worker.terminate();
    this.update(id, { progress: 0, error: undefined });

    const run = (this.counter += 1);
    const worker = new Worker(new URL('../log/worker.ts', import.meta.url), { type: 'module' });
    this.runs.set(id, { run, worker });
    const current = () => this.runs.get(id)?.run === run;

    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (!current()) return;
      if (data.kind === 'progress') {
        this.update(id, { progress: data.done / Math.max(1, data.total) });
        return;
      }
      worker.terminate();
      this.runs.delete(id);
      if (data.kind === 'error') {
        this.update(id, { error: data.message, progress: undefined, parsed: undefined });
      } else {
        this.update(id, { parsed: { ...data.parsed, text: source.text }, progress: undefined });
      }
    };
    worker.onerror = () => {
      if (!current()) return;
      worker.terminate();
      this.runs.delete(id);
      this.update(id, { error: 'The parser worker could not start', progress: undefined });
    };
    const request: WorkerRequest = { id, run, text: source.text, options: source.options };
    worker.postMessage(request);
  }

  /** Anchor mode: first click remembers a line, second works out the offset */
  anchorAt(id: string, time: number) {
    if (!this.anchor) {
      this.anchor = { source: id, time };
      this.notice = 'Now click the same event in another source';
      return;
    }
    if (this.anchor.source === id) {
      this.anchor = { source: id, time };
      return;
    }
    const target = this.sources.find((source) => source.id === id);
    if (target) {
      this.update(id, { offset: target.offset + (this.anchor.time - time) });
      this.notice = `${target.name} shifted to match`;
    }
    this.anchor = null;
  }

  resetOffsets() {
    this.sources = this.sources.map((source) => ({ ...source, offset: 0 }));
  }

  session() {
    return JSON.stringify(toSession(this.sources, this.zone), null, 2);
  }

  loadSession(text: string) {
    const session = fromSession(text);
    this.zone = session.zone;
    this.sources = this.sources.map((source, at) => {
      const saved = session.sources[at];
      if (!saved) return source;
      return { ...source, name: saved.name, colour: saved.colour, offset: saved.offset };
    });
    session.sources.forEach((saved, at) => {
      const source = this.sources[at];
      if (source) this.reparse(source.id, saved.options);
    });
    const applied = Math.min(session.sources.length, this.sources.length);
    const spare = session.sources.length - applied;
    this.notice = `Loaded settings for ${applied} of your sources${
      spare ? `, ${spare} in the file had nothing to attach to` : ''
    }`;
  }
}
