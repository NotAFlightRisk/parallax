<script lang="ts">
  import SourceCard from './SourceCard.svelte';
  import { download, readFiles, takeFiles } from '../files';
  import { zoneChoices } from '../log/zone';
  import { MAX_SOURCES, type Workspace } from '../state/workspace.svelte';

  let { workspace, onpaste }: { workspace: Workspace; onpaste: () => void } = $props();

  const zones = zoneChoices();
  const room = $derived(MAX_SOURCES - workspace.sources.length);

  let logInput = $state<HTMLInputElement | null>(null);
  let sessionInput = $state<HTMLInputElement | null>(null);

  async function addFiles(files: File[]) {
    for (const file of await readFiles(files, room)) workspace.add(file.name, file.text);
  }

  async function loadSession(files: File[]) {
    if (!files.length) return;
    try {
      workspace.loadSession(await files[0].text());
    } catch (error) {
      workspace.notice = error instanceof Error ? error.message : 'That session would not load';
    }
  }
</script>

<aside class="rail">
  <header>
    <h2>Sources</h2>
    <span class="count">{workspace.sources.length} of {MAX_SOURCES}</span>
  </header>

  <div class="list">
    {#each workspace.sources as source (source.id)}
      <SourceCard {workspace} {source} />
    {/each}
  </div>

  <div class="add">
    <button class="ghost" disabled={room <= 0} onclick={() => logInput?.click()}>Add files</button>
    <button class="ghost" disabled={room <= 0} onclick={onpaste}>Paste text</button>
    <input
      bind:this={logInput}
      type="file"
      multiple
      accept=".log,.txt,text/*"
      hidden
      onchange={(event) => addFiles(takeFiles(event.currentTarget))}
    />
  </div>

  <footer>
    <label class="zone">
      <span>Display in</span>
      <select bind:value={workspace.zone}>
        {#each zones as zone (zone)}
          <option value={zone}>{zone}</option>
        {/each}
      </select>
    </label>
    <div class="session">
      <button class="link" onclick={() => download('parallax-session.json', workspace.session())}>
        Save session
      </button>
      <button class="link" onclick={() => sessionInput?.click()}>Load session</button>
      <input
        bind:this={sessionInput}
        type="file"
        accept="application/json,.json"
        hidden
        onchange={(event) => loadSession(takeFiles(event.currentTarget))}
      />
    </div>
    <p class="fineprint">
      A session holds names, colours, formats and offsets. Never the logs themselves.
    </p>
  </footer>
</aside>

<style>
  .rail {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    border-inline-end: 1px solid var(--border);
    background: var(--surface-raised);
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);

    h2 {
      margin: 0;
      font-size: var(--text-sm);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .count {
      color: var(--text-faint);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }
  }

  .list {
    overflow-y: auto;
    min-height: 0;
  }

  .add {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--border);
  }

  .ghost {
    flex: 1;
    padding: var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: none;
    color: var(--text);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: background 150ms var(--ease);

    &:hover:not(:disabled) {
      background: var(--surface-hover);
    }

    &:disabled {
      border-color: var(--border);
      color: var(--text-faint);
      cursor: default;
    }
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--border);
    background: var(--surface-sunken);
  }

  .zone {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-faint);
    font-size: var(--text-xs);

    select {
      flex: 1;
      min-width: 0;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      font-size: var(--text-sm);
    }
  }

  .session {
    display: flex;
    gap: var(--space-4);
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
    font-size: var(--text-xs);

    &:hover {
      text-decoration: underline;
    }
  }

  .fineprint {
    margin: 0;
    color: var(--text-faint);
    font-size: var(--text-xs);
    line-height: 1.45;
  }
</style>
