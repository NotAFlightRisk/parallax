<script lang="ts">
  import { entryForRow, indexOf, sourceOf } from '../log/merge';
  import { lineText } from '../log/lines';
  import { clock, formatDelta } from '../log/time';
  import type { Workspace } from '../state/workspace.svelte';

  const ROW = 24;
  const OVERSCAN = 12;

  let { workspace }: { workspace: Workspace } = $props();

  let viewport = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let height = $state(600);

  const stamp = $derived(clock(workspace.zone));
  const merged = $derived(workspace.merged);
  const first = $derived(Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN));
  const last = $derived(Math.min(merged.rows, Math.ceil((scrollTop + height) / ROW) + OVERSCAN));

  type Row = {
    row: number;
    entry: number;
    line: number;
    name: string;
    colour: string;
    time: number;
    delta: number;
    text: string;
  };

  const rows = $derived.by((): Row[] => {
    if (!merged.rows) return [];
    const out: Row[] = [];
    let entry = entryForRow(merged.rowStarts, first);
    for (let row = first; row < last; row += 1) {
      while (entry + 1 < merged.order.length && merged.rowStarts[entry + 1] <= row) entry += 1;
      const slot = merged.order[entry];
      const source = workspace.visible[sourceOf(slot)];
      const line = row - merged.rowStarts[entry];
      out.push({
        row,
        entry,
        line,
        name: source.name,
        colour: source.colour,
        time: merged.times[entry],
        delta: entry > 0 ? merged.times[entry] - merged.times[entry - 1] : NaN,
        text: lineText(source.parsed!, indexOf(slot), line)
      });
    }
    return out;
  });

  export function seek(entry: number) {
    if (!viewport || !merged.order.length) return;
    const clamped = Math.min(Math.max(0, entry), merged.order.length - 1);
    workspace.cursor = clamped;
    const top = merged.rowStarts[clamped] * ROW;
    if (top < scrollTop || top > scrollTop + height - ROW * 2) {
      viewport.scrollTop = Math.max(0, top - height / 3);
    }
  }

  /** Next entry from the same source as the one under the cursor */
  function step(direction: number) {
    const order = merged.order;
    if (!order.length) return;
    const lane = sourceOf(order[workspace.cursor]);
    for (let at = workspace.cursor + direction; at >= 0 && at < order.length; at += direction) {
      if (sourceOf(order[at]) === lane) return seek(at);
    }
  }

  const keys: Record<string, () => void> = {
    j: () => seek(workspace.cursor + 1),
    ArrowDown: () => seek(workspace.cursor + 1),
    k: () => seek(workspace.cursor - 1),
    ArrowUp: () => seek(workspace.cursor - 1),
    n: () => step(1),
    p: () => step(-1),
    g: () => seek(0),
    G: () => seek(merged.order.length - 1)
  };

  function onKey(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement).matches('input, textarea, select')) return;
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function pick(entry: number) {
    workspace.cursor = entry;
    if (!workspace.anchoring) return;
    const slot = merged.order[entry];
    workspace.anchorAt(workspace.visible[sourceOf(slot)].id, merged.times[entry]);
    if (!workspace.anchor) workspace.anchoring = false;
  }
</script>

<svelte:window onkeydown={onKey} />

<div
  class="viewport"
  class:anchoring={workspace.anchoring}
  bind:this={viewport}
  bind:clientHeight={height}
  onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}
  style:--row="{ROW}px"
>
  <div
    class="scroller"
    role="listbox"
    tabindex="0"
    aria-label="Merged log"
    aria-activedescendant="line-{workspace.cursor}"
    style:height="{merged.rows * ROW}px"
  >
    <!-- unkeyed on purpose: the window recycles its rows instead of rebuilding them -->
    {#each rows as item}
      <div
        id={item.line === 0 ? `line-${item.entry}` : undefined}
        class="line"
        class:current={item.entry === workspace.cursor}
        class:attached={item.line > 0}
        style:top="{item.row * ROW}px"
        style:--gutter={item.colour}
        role="option"
        tabindex="-1"
        aria-selected={item.entry === workspace.cursor}
        onclick={() => pick(item.entry)}
        onkeydown={(event) => event.key === 'Enter' && pick(item.entry)}
      >
        <span class="gutter" aria-hidden="true"></span>
        {#if item.line === 0}
          <time class="stamp" datetime={new Date(item.time).toISOString()}>
            {stamp.full(item.time)}
          </time>
          {#if workspace.showDelta}<span class="delta">{formatDelta(item.delta)}</span>{/if}
          <span class="name">{item.name}</span>
        {:else}
          <span class="stamp"></span>
          {#if workspace.showDelta}<span class="delta"></span>{/if}
          <span class="name"></span>
        {/if}
        <span class="text">{item.text}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .viewport {
    overflow: auto;
    height: 100%;
    background: var(--surface);
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-variant-numeric: tabular-nums;
    overscroll-behavior: contain;
  }

  .viewport.anchoring {
    cursor: crosshair;
  }

  .scroller {
    position: relative;
    outline-offset: -2px;
  }

  .line {
    position: absolute;
    left: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: max-content;
    min-width: 100%;
    height: var(--row);
    padding-inline-end: var(--space-6);
    white-space: pre;

    &:hover {
      background: var(--surface-hover);
    }

    &.current {
      background: var(--surface-active);
    }

    .gutter {
      flex: none;
      width: 2px;
      height: 100%;
      margin-inline-end: var(--space-2);
      background: var(--gutter);
    }

    &.attached .gutter {
      opacity: 0.3;
    }

    .stamp,
    .delta,
    .name {
      flex: none;
      color: var(--text-faint);
    }

    .stamp {
      width: 24ch;
    }

    .delta {
      width: 8ch;
      text-align: right;
    }

    .name {
      width: 10ch;
      overflow: hidden;
      color: var(--text-muted);
      text-overflow: ellipsis;
    }

    &.current :is(.stamp, .delta) {
      color: var(--text-muted);
    }

    .text {
      color: var(--text);
    }

    &.attached .text {
      color: var(--text-muted);
    }
  }
</style>
