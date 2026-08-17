<script lang="ts">
  import { CUSTOM_GROUPS, FORMATS } from '../log/formats';
  import { FORMAT_IDS, type FormatId, type Source } from '../log/types';
  import { formatOffset } from '../log/time';
  import { perFrame } from '../raf';
  import { zoneChoices } from '../log/zone';
  import type { Workspace } from '../state/workspace.svelte';

  let { workspace, source }: { workspace: Workspace; source: Source } = $props();

  const zones = zoneChoices();
  const parsed = $derived(source.parsed);
  const bound = $derived(Math.max(60000, Math.ceil(Math.abs(source.offset) / 60000) * 60000));
  const anchored = $derived(workspace.anchor?.source === source.id);

  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const nudge = perFrame((offset: number) => workspace.update(source.id, { offset }));
</script>

<article class="source" class:off={!source.enabled} style:--tint={source.colour}>
  <header>
    <label class="toggle">
      <input
        type="checkbox"
        checked={source.enabled}
        onchange={(event) => workspace.update(source.id, { enabled: event.currentTarget.checked })}
      />
      <span class="swatch"></span>
      <span class="sr">Show {source.name}</span>
    </label>
    <input
      class="name"
      value={source.name}
      aria-label="Source name"
      onchange={(event) => workspace.update(source.id, { name: event.currentTarget.value })}
    />
    <button class="drop" onclick={() => workspace.remove(source.id)} title="Remove {source.name}">
      <span class="sr">Remove {source.name}</span>×
    </button>
  </header>

  {#if source.progress !== undefined}
    <p class="state">Parsing… {percent(source.progress)}</p>
  {:else if source.error}
    <p class="state bad">{source.error}</p>
  {:else if parsed}
    <p class="state">
      {parsed.times.length.toLocaleString()} entries
      {#if parsed.unmatched}<span class="warn">· {parsed.unmatched.toLocaleString()} attached</span
        >{/if}
      {#if parsed.detected}<span class="auto">· detected</span>{/if}
    </p>
  {/if}

  <div class="grid">
    <label>
      <span>Format</span>
      <select
        value={source.options.format}
        onchange={(event) =>
          workspace.reparse(source.id, {
            format: event.currentTarget.value as FormatId | 'auto'
          })}
      >
        <option value="auto">Auto detect</option>
        {#each FORMAT_IDS as id (id)}
          <option value={id}>{FORMATS[id].label}</option>
        {/each}
      </select>
    </label>
    <label>
      <span>Time zone</span>
      <select
        value={source.options.zone}
        onchange={(event) => workspace.reparse(source.id, { zone: event.currentTarget.value })}
      >
        {#each zones as zone (zone)}
          <option value={zone}>{zone}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if source.options.format === 'custom'}
    <label class="pattern">
      <span>Regex with named groups</span>
      <input
        value={source.options.pattern ?? ''}
        spellcheck="false"
        placeholder={FORMATS.custom.hint}
        onchange={(event) => workspace.reparse(source.id, { pattern: event.currentTarget.value })}
      />
      <small>{CUSTOM_GROUPS.join(', ')}</small>
    </label>
  {/if}

  <div class="skew">
    <div class="skew-head">
      <span>Offset</span>
      <output class:zero={source.offset === 0}>{formatOffset(source.offset)}</output>
    </div>
    <input
      class="slider"
      type="range"
      min={-bound}
      max={bound}
      step="10"
      value={source.offset}
      aria-label="Offset for {source.name} in milliseconds"
      oninput={(event) => nudge(Number(event.currentTarget.value))}
    />
    <div class="skew-foot">
      <input
        class="number"
        type="number"
        step="1"
        value={source.offset}
        aria-label="Offset for {source.name} in milliseconds, exact"
        oninput={(event) => nudge(Number(event.currentTarget.value) || 0)}
      />
      <span>ms</span>
      <button
        class="link"
        disabled={source.offset === 0}
        onclick={() => workspace.update(source.id, { offset: 0 })}>reset</button
      >
    </div>
  </div>

  {#if anchored}
    <p class="state anchored">Anchor set here, now click the same event elsewhere</p>
  {/if}
</article>

<style>
  .source {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);

    &.off {
      opacity: 0.5;
    }
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .toggle {
    display: flex;
    align-items: center;
    cursor: pointer;

    input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .swatch {
      width: 10px;
      height: 10px;
      border: 1px solid var(--tint);
      border-radius: 2px;
      background: var(--tint);
    }

    input:not(:checked) + .swatch {
      background: transparent;
    }

    input:focus-visible + .swatch {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .name {
    flex: 1;
    min-width: 0;
    padding: 2px var(--space-1);
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: none;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: var(--text-base);

    &:hover {
      border-color: var(--border);
    }

    &:focus {
      border-color: var(--border-strong);
      background: var(--surface);
      outline: none;
    }
  }

  .drop {
    padding: 0 var(--space-1);
    border: 0;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    font-size: var(--text-md);
    line-height: 1;

    &:hover {
      color: var(--danger);
    }
  }

  .state {
    margin: 0;
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: var(--text-xs);

    .warn {
      color: var(--warn);
    }

    .auto {
      color: var(--text-faint);
    }

    &.bad {
      color: var(--danger);
    }

    &.anchored {
      color: var(--accent);
    }
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-2);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    color: var(--text-faint);
    font-size: var(--text-xs);
  }

  select,
  .pattern input {
    width: 100%;
    min-width: 0;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: var(--text-sm);
  }

  .pattern {
    input {
      font-family: var(--font-mono);
    }

    small {
      color: var(--text-faint);
      font-size: var(--text-xs);
    }
  }

  .skew {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-1);
  }

  .skew-head {
    display: flex;
    justify-content: space-between;
    color: var(--text-faint);
    font-size: var(--text-xs);

    output {
      color: var(--tint);
      font-family: var(--font-mono);

      &.zero {
        color: var(--text-faint);
      }
    }
  }

  .slider {
    width: 100%;
    height: 4px;
    margin: var(--space-1) 0;
    appearance: none;
    border-radius: 2px;
    background: linear-gradient(var(--border), var(--border));
    background-position: center;
    background-repeat: no-repeat;
    background-size: 100% 2px;
    cursor: ew-resize;

    &::-webkit-slider-thumb {
      width: 10px;
      height: 14px;
      appearance: none;
      border-radius: 1px;
      background: var(--tint);
    }

    &::-moz-range-thumb {
      width: 10px;
      height: 14px;
      border: 0;
      border-radius: 1px;
      background: var(--tint);
    }
  }

  .skew-foot {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-faint);
    font-size: var(--text-xs);
  }

  .number {
    width: 8ch;
    padding: 2px var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-align: right;
  }

  .link {
    margin-inline-start: auto;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
    font: inherit;

    &:disabled {
      color: var(--text-faint);
      cursor: default;
    }

    &:hover:not(:disabled) {
      text-decoration: underline;
    }
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
