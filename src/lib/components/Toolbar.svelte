<script lang="ts">
  import { copy, download } from '../files';
  import { render } from '../log/render';
  import type { Workspace } from '../state/workspace.svelte';

  const DEBOUNCE = 120;

  let { workspace }: { workspace: Workspace } = $props();

  let field = $state<HTMLInputElement | null>(null);
  let typed = $state('');
  let timer: ReturnType<typeof setTimeout>;

  const skewed = $derived(workspace.sources.some((source) => source.offset !== 0));

  function search(value: string) {
    typed = value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      workspace.query = value;
      workspace.cursor = 0;
    }, DEBOUNCE);
  }

  function merged() {
    return render(workspace.lanes, workspace.merged, {
      zone: workspace.zone,
      names: workspace.visible.map((source) => source.name),
      delta: workspace.showDelta
    });
  }

  async function toClipboard() {
    const ok = await copy(merged());
    workspace.notice = ok ? 'Merged view copied' : 'The browser would not let us copy';
  }

  function focusSearch(event: KeyboardEvent) {
    if (event.key !== '/' || (event.target as HTMLElement).matches('input, textarea, select')) {
      return;
    }
    event.preventDefault();
    field?.focus();
  }
</script>

<svelte:window onkeydown={focusSearch} />

<div class="toolbar">
  <label class="search">
    <span class="sr">Filter lines</span>
    <input
      bind:this={field}
      type="search"
      value={typed}
      placeholder="Filter  /"
      spellcheck="false"
      oninput={(event) => search(event.currentTarget.value)}
    />
  </label>

  <button
    class="chip"
    class:on={workspace.anchoring}
    onclick={() => {
      workspace.anchoring = !workspace.anchoring;
      workspace.anchor = null;
      workspace.notice = workspace.anchoring ? 'Click the same event in two sources' : '';
    }}
  >
    Anchor
  </button>

  <button
    class="chip"
    class:on={workspace.showDelta}
    onclick={() => (workspace.showDelta = !workspace.showDelta)}
  >
    Delta
  </button>

  <button class="chip" disabled={!skewed} onclick={() => workspace.resetOffsets()}>
    Reset skew
  </button>

  <div class="spacer"></div>

  <span class="tally">{workspace.merged.order.length.toLocaleString()} lines</span>
  <button class="chip" onclick={toClipboard}>Copy</button>
  <button class="chip" onclick={() => download('parallax-merged.log', merged())}>Download</button>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--border);
    background: var(--surface-raised);
  }

  .search {
    flex: 0 1 22rem;

    input {
      width: 100%;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: var(--text-sm);

      &::placeholder {
        color: var(--text-faint);
      }
    }
  }

  .chip {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: var(--text-sm);
    white-space: nowrap;
    transition:
      background 150ms var(--ease),
      color 150ms var(--ease);

    &:hover:not(:disabled) {
      background: var(--surface-hover);
      color: var(--text);
    }

    &.on {
      border-color: var(--accent);
      background: var(--accent-quiet);
      color: var(--text);
    }

    &:disabled {
      color: var(--text-faint);
      cursor: default;
      opacity: 0.6;
    }
  }

  .spacer {
    flex: 1;
  }

  .tally {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
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
