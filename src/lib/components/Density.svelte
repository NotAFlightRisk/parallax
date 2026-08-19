<script lang="ts">
  import { entryForTime } from '../log/merge';
  import { clock } from '../log/time';
  import type { Workspace } from '../state/workspace.svelte';

  const LANE = 22;
  const DRAG_FLOOR = 4;

  let { workspace, onseek }: { workspace: Workspace; onseek: (entry: number) => void } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  /** The plot's own width, since the strip around it is padded */
  let width = $state(800);
  let drag = $state<{ from: number; to: number } | null>(null);

  const span = $derived(workspace.span);
  const stamp = $derived(clock(workspace.zone));
  const lanes = $derived(workspace.visible);
  const heightPx = $derived(Math.max(LANE, lanes.length * LANE));

  const timeAt = (x: number) =>
    span ? span[0] + (Math.min(Math.max(x, 0), width) / width) * (span[1] - span[0]) : 0;

  $effect(() => {
    const context = canvas?.getContext('2d');
    const bands = workspace.bands;
    if (!context || !span) return;

    const ratio = window.devicePixelRatio || 1;
    canvas!.width = width * ratio;
    canvas!.height = heightPx * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, heightPx);

    bands.forEach((counts, lane) => {
      const peak = Math.max(1, ...counts);
      const step = width / counts.length;
      context.fillStyle = lanes[lane].colour;
      for (let bucket = 0; bucket < counts.length; bucket += 1) {
        if (!counts[bucket]) continue;
        const tall = Math.max(2, (counts[bucket] / peak) * (LANE - 6));
        context.globalAlpha = 0.35 + 0.65 * (counts[bucket] / peak);
        context.fillRect(
          bucket * step,
          lane * LANE + (LANE - 4 - tall),
          Math.max(1, step - 0.5),
          tall
        );
      }
    });
    context.globalAlpha = 1;
  });

  function relative(event: PointerEvent) {
    return event.clientX - (event.currentTarget as HTMLElement).getBoundingClientRect().left;
  }

  function down(event: PointerEvent) {
    if (!span) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const at = relative(event);
    drag = { from: at, to: at };
  }

  function move(event: PointerEvent) {
    if (drag) drag = { ...drag, to: relative(event) };
  }

  function up(event: PointerEvent) {
    if (!drag || !span) return;
    const { from, to } = drag;
    drag = null;
    if (Math.abs(to - from) < DRAG_FLOOR) {
      onseek(entryForTime(workspace.merged.times, timeAt(relative(event))));
      return;
    }
    workspace.range = [timeAt(Math.min(from, to)), timeAt(Math.max(from, to))];
    workspace.cursor = 0;
  }

  function key(event: KeyboardEvent) {
    if (!span) return;
    const width_ = span[1] - span[0];
    const from = workspace.merged.times[workspace.cursor] ?? span[0];
    const jumps: Record<string, number> = {
      ArrowLeft: from - width_ / 100,
      ArrowRight: from + width_ / 100,
      Home: span[0],
      End: span[1]
    };
    if (!(event.key in jumps)) return;
    event.preventDefault();
    onseek(entryForTime(workspace.merged.times, jumps[event.key]));
  }

  const marker = $derived.by(() => {
    if (!span || !workspace.range) return null;
    const scale = (time: number) => ((time - span[0]) / (span[1] - span[0])) * width;
    return { left: scale(workspace.range[0]), right: width - scale(workspace.range[1]) };
  });
</script>

<div class="density" style:--lane="{LANE}px">
  {#if span}
    <div
      class="plot"
      bind:clientWidth={width}
      style:height="{heightPx}px"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onkeydown={key}
      role="slider"
      tabindex="0"
      aria-label="Seek or zoom the time range"
      aria-valuemin={span[0]}
      aria-valuemax={span[1]}
      aria-valuenow={workspace.merged.times[workspace.cursor] ?? span[0]}
    >
      <canvas bind:this={canvas} style:height="{heightPx}px"></canvas>
      {#if marker}
        <span class="shade" style:left="0" style:width="{marker.left}px"></span>
        <span class="shade" style:right="0" style:width="{marker.right}px"></span>
      {/if}
      {#if drag}
        <span
          class="select"
          style:left="{Math.min(drag.from, drag.to)}px"
          style:width="{Math.abs(drag.to - drag.from)}px"
        ></span>
      {/if}
    </div>
    <div class="axis">
      <span>{stamp.full(span[0])}</span>
      {#if workspace.range}
        <button class="clear" onclick={() => (workspace.range = null)}>
          showing {stamp.time(workspace.range[0])} to {stamp.time(workspace.range[1])} · clear
        </button>
      {:else}
        <span class="hint">drag to zoom, click to seek</span>
      {/if}
      <span>{stamp.full(span[1])}</span>
    </div>
  {/if}
</div>

<style>
  .density {
    padding: var(--space-3) var(--space-4) var(--space-2);
    border-bottom: 1px solid var(--border);
    background: var(--surface-sunken);
    user-select: none;
  }

  .plot {
    position: relative;
    cursor: crosshair;
    touch-action: none;

    canvas {
      display: block;
      width: 100%;
    }
  }

  .shade {
    position: absolute;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--surface-sunken) 78%, transparent);
    pointer-events: none;
  }

  .select {
    position: absolute;
    top: 0;
    bottom: 0;
    border-inline: 1px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    pointer-events: none;
  }

  .axis {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    margin-top: var(--space-1);
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .hint {
    color: var(--text-faint);
  }

  .clear {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
    font: inherit;

    &:hover {
      text-decoration: underline;
    }
  }
</style>
