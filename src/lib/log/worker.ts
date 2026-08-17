import { parse } from './parse';
import type { WorkerRequest, WorkerResponse } from './types';

const post = (message: WorkerResponse, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer });

self.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  const { id, text, options } = data;
  try {
    const { text: _sent, ...parsed } = parse(text, options, {
      onProgress: (done, total) => post({ id, kind: 'progress', done, total })
    });
    post({ id, kind: 'done', parsed }, [
      parsed.times.buffer as ArrayBuffer,
      parsed.starts.buffer as ArrayBuffer,
      parsed.ends.buffer as ArrayBuffer,
      parsed.lines.buffer as ArrayBuffer
    ]);
  } catch (error) {
    post({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
