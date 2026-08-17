export const FORMAT_IDS = ['iso', 'journalctl', 'syslog', 'clf', 'go', 'epoch', 'custom'] as const;

export type FormatId = (typeof FORMAT_IDS)[number];

export type ParseOptions = {
  format: FormatId | 'auto';
  /** IANA zone for formats that carry no offset of their own */
  zone: string;
  /** Only used when format is 'custom' */
  pattern?: string;
};

/** One parsed line plus any unparseable lines that trailed it */
export type Entry = {
  time: number;
  start: number;
  end: number;
  lines: number;
};

/** Parallel arrays over one source, indexed together. Cheap to transfer. */
export type Parsed = {
  text: string;
  times: Float64Array;
  starts: Uint32Array;
  ends: Uint32Array;
  lines: Uint32Array;
  format: FormatId;
  detected: boolean;
  total: number;
  unmatched: number;
};

export type Source = {
  id: string;
  name: string;
  colour: string;
  text: string;
  options: ParseOptions;
  offset: number;
  enabled: boolean;
  parsed?: Parsed;
  error?: string;
  progress?: number;
};

export type WorkerRequest = {
  id: string;
  text: string;
  options: ParseOptions;
};

export type WorkerResponse =
  | { id: string; kind: 'progress'; done: number; total: number }
  | { id: string; kind: 'done'; parsed: Parsed }
  | { id: string; kind: 'error'; message: string };
