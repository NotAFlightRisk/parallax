import { parse } from './parse';
import type { WorkerRequest, WorkerResponse } from './types';

const post = (message: WorkerResponse, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer });

self.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  const { id, text, options } = data;
  try {
    const parsed = parse(text, options, {
      onProgress: (done, total) => post({ id, kind: 'progress', done, total })
    });
    post({ id, kind: 'done', parsed }, [
      parsed.times.buffer,
      parsed.starts.buffer,
      parsed.ends.buffer,
      parsed.lines.buffer
    ]);
  } catch (error) {
    post({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
