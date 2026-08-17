import { FORMAT_IDS, type FormatId, type ParseOptions, type Source } from './types';
import { isValidZone } from './zone';

export const SESSION_VERSION = 1;

export type SessionSource = {
  name: string;
  colour: string;
  offset: number;
  options: ParseOptions;
};

export type Session = {
  app: 'parallax';
  version: number;
  zone: string;
  sources: SessionSource[];
};

/** Everything about how the logs are read, and nothing that was in them */
export function toSession(sources: Source[], zone: string): Session {
  return {
    app: 'parallax',
    version: SESSION_VERSION,
    zone,
    sources: sources.map(({ name, colour, offset, options }) => ({
      name,
      colour,
      offset,
      options
    }))
  };
}

const isFormat = (value: unknown): value is FormatId | 'auto' =>
  value === 'auto' || FORMAT_IDS.includes(value as FormatId);

function readSource(raw: unknown, at: number): SessionSource {
  const source = raw as Partial<SessionSource>;
  const options = source?.options;
  if (!source || typeof source.name !== 'string' || !options) {
    throw new Error(`Source ${at + 1} is missing a name or its parse options`);
  }
  if (!isFormat(options.format)) throw new Error(`Source ${at + 1} has an unknown format`);
  if (typeof options.zone !== 'string' || !isValidZone(options.zone)) {
    throw new Error(`Source ${at + 1} has an unknown time zone`);
  }
  return {
    name: source.name,
    colour: typeof source.colour === 'string' ? source.colour : '',
    offset: Number.isFinite(source.offset) ? Number(source.offset) : 0,
    options: {
      format: options.format,
      zone: options.zone,
      pattern: typeof options.pattern === 'string' ? options.pattern : undefined
    }
  };
}

export function fromSession(text: string): Session {
  let raw: Partial<Session>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not JSON');
  }
  if (raw?.app !== 'parallax') throw new Error('That is not a Parallax session file');
  if (raw.version !== SESSION_VERSION) {
    throw new Error(`Session version ${raw.version} is not one this build understands`);
  }
  if (typeof raw.zone !== 'string' || !isValidZone(raw.zone)) {
    throw new Error('The session has an unknown display time zone');
  }
  if (!Array.isArray(raw.sources)) throw new Error('The session has no sources');
  return {
    app: 'parallax',
    version: SESSION_VERSION,
    zone: raw.zone,
    sources: raw.sources.map(readSource)
  };
}
