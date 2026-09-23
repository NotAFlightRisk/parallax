import { expect, it, vi } from 'vitest';
import { MAX_SOURCES, Workspace } from '../../src/lib/state/workspace.svelte';
import { parse } from '../../src/lib/log/parse';

/** Nothing here waits on a parse, so the worker only has to exist */
class Idle {
  postMessage() {}
  terminate() {}
}

vi.stubGlobal('Worker', Idle);

const field = (workspace: Workspace, key: 'colour' | 'name') =>
  workspace.sources.map((source) => source[key]);

const filled = (name: (at: number) => string) => {
  const workspace = new Workspace();
  for (let at = 0; at < MAX_SOURCES; at += 1) workspace.add(name(at), '');
  return workspace;
};

it('hands a removed source its colour back', () => {
  const workspace = filled((at) => `s${at}`);
  const freed = workspace.sources[1].colour;
  workspace.remove(workspace.sources[1].id);
  workspace.add('late', '');
  expect(field(workspace, 'colour').at(-1)).toBe(freed);
});

it('keeps the six colours distinct however sources come and go', () => {
  const workspace = filled((at) => `s${at}`);
  for (const id of [workspace.sources[0].id, workspace.sources[2].id]) workspace.remove(id);
  workspace.add('one', '');
  workspace.add('two', '');
  expect(new Set(field(workspace, 'colour')).size).toBe(MAX_SOURCES);
});

it('numbers an untitled source from the first spare', () => {
  const workspace = filled(() => '');
  expect(field(workspace, 'name')).toEqual(
    ['1', '2', '3', '4', '5', '6'].map((n) => `source ${n}`)
  );
  workspace.remove(workspace.sources[1].id);
  workspace.add('', '');
  expect(field(workspace, 'name').at(-1)).toBe('source 2');
});

const LOG = [
  '2026-08-17T00:00:01Z boot',
  '2026-08-17T00:00:02Z start',
  '2026-08-17T00:00:03Z boot'
].join('\n');

const parsedLog = () => parse(LOG, { format: 'auto', zone: 'UTC' });

const loaded = () => {
  const workspace = new Workspace();
  workspace.add('log', LOG);
  workspace.update(workspace.sources[0].id, { parsed: parsedLog() });
  return workspace;
};

it('reuses the filter mask while only an offset moves', () => {
  const workspace = loaded();
  workspace.query = 'boot';
  const mask = workspace.lanes[0].mask;
  workspace.update(workspace.sources[0].id, { offset: 250 });
  expect(workspace.lanes[0].mask).toBe(mask);
  workspace.query = 'start';
  expect(workspace.lanes[0].mask).not.toBe(mask);
});

it('drops the mask when the source is parsed again', () => {
  const workspace = loaded();
  workspace.query = 'boot';
  const mask = workspace.lanes[0].mask;
  workspace.update(workspace.sources[0].id, { parsed: parsedLog() });
  expect(workspace.lanes[0].mask).not.toBe(mask);
});
