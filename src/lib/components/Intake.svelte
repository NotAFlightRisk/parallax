<script lang="ts">
  import type { Workspace } from '../state/workspace.svelte';

  let {
    workspace,
    rows = 6,
    ondone
  }: { workspace: Workspace; rows?: number; ondone?: () => void } = $props();

  let text = $state('');
  let name = $state('');

  function take(raw: string) {
    workspace.add(name.trim(), raw.replace(/\r/g, ''));
    text = '';
    name = '';
    ondone?.();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (text.trim()) take(text);
  }

  /** Straight from the clipboard to a source. A 15MB textarea takes half a minute to lay out */
  function paste(event: ClipboardEvent) {
    const raw = event.clipboardData?.getData('text') ?? '';
    if (!raw.trim()) return;
    event.preventDefault();
    take(raw);
  }
</script>

<form onsubmit={submit}>
  <textarea
    bind:value={text}
    {rows}
    spellcheck="false"
    onpaste={paste}
    aria-label="Log text"
    placeholder="Paste a log here"></textarea>
  <div class="foot">
    <input bind:value={name} aria-label="Source name" placeholder="Name this source" />
    <button type="submit" disabled={!text.trim()}>Add source</button>
  </div>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-sunken);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: var(--text-base);
    line-height: 1.6;
    resize: vertical;

    &::placeholder {
      color: var(--text-faint);
    }
  }

  .foot {
    display: flex;
    gap: var(--space-2);
  }

  input {
    flex: 1;
    min-width: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-sunken);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: var(--text-sm);

    &::placeholder {
      color: var(--text-faint);
    }
  }

  button {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: var(--accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 600;
    transition: opacity 150ms var(--ease);

    &:hover:not(:disabled) {
      opacity: 0.88;
    }

    &:disabled {
      border-color: var(--border);
      background: none;
      color: var(--text-faint);
      cursor: default;
    }
  }
</style>
