<script lang="ts">
  import Density from '$lib/components/Density.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Intake from '$lib/components/Intake.svelte';
  import LogView from '$lib/components/LogView.svelte';
  import SourceRail from '$lib/components/SourceRail.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import { DEMO } from '$lib/demo';
  import { readFiles } from '$lib/files';
  import { clock } from '$lib/log/time';
  import { MAX_SOURCES, Workspace } from '$lib/state/workspace.svelte';
  import { description, title } from '$lib/meta';

  const workspace = new Workspace();

  let log = $state<ReturnType<typeof LogView> | null>(null);
  let pasting = $state(false);
  let dropping = $state(false);

  const stamp = $derived(clock(workspace.zone));
  const span = $derived(workspace.span);
  const room = $derived(MAX_SOURCES - workspace.sources.length);

  async function drop(event: DragEvent) {
    event.preventDefault();
    dropping = false;
    const files = event.dataTransfer?.files;
    if (!files) return;
    for (const file of await readFiles(files, room)) workspace.add(file.name, file.text);
  }

  function loadDemo() {
    workspace.zone = 'UTC';
    for (const source of DEMO) workspace.add(source.name, source.text, { zone: 'UTC' });
    workspace.notice = 'Three logs, three clocks. Line them up with Anchor or the offset sliders';
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href="https://parallax.peng.ly/" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://parallax.peng.ly/" />
  <meta name="twitter:card" content="summary" />
</svelte:head>

<div
  class="app"
  class:loaded={workspace.sources.length > 0}
  class:dropping
  ondragover={(event) => {
    event.preventDefault();
    dropping = true;
  }}
  ondragleave={() => (dropping = false)}
  ondrop={drop}
  role="application"
  aria-label="Parallax log aligner"
>
  <header class="bar">
    <h1>parallax</h1>
    <p>the same event, at a different time in every log</p>
    <span class="local">runs entirely in this tab, nothing is uploaded</span>
  </header>

  {#if workspace.sources.length}
    <SourceRail {workspace} onpaste={() => (pasting = !pasting)} />

    <main>
      <Toolbar {workspace} />
      {#if pasting}
        <div class="paste">
          <Intake {workspace} rows={5} ondone={() => (pasting = false)} />
        </div>
      {/if}
      <Density {workspace} onseek={(entry) => log?.seek(entry)} />
      <div class="log">
        {#if workspace.merged.rows}
          <LogView bind:this={log} {workspace} />
        {:else}
          <p class="nothing">
            {workspace.visible.length ? 'Nothing matches those filters' : 'Still parsing'}
          </p>
        {/if}
      </div>
      <footer class="status">
        <span class="notice">{workspace.notice}</span>
        {#if span}
          <span class="range">{stamp.full(span[0])} → {stamp.full(span[1])}</span>
        {/if}
        <span class="keys"
          ><kbd>j</kbd><kbd>k</kbd> line · <kbd>n</kbd><kbd>p</kbd> same source ·
          <kbd>/</kbd> filter</span
        >
      </footer>
    </main>
  {:else}
    <section class="hero">
      <div class="pitch">
        <p>
          Two machines, two clocks, one incident. Drop the logs in, nudge the ones whose clock
          drifted, and read the whole thing as one story.
        </p>
        <ul>
          <li>ISO 8601, syslog, journalctl, access logs, Go, epoch, or your own regex</li>
          <li>Stack traces stay attached to the line that threw them</li>
          <li>Up to six sources, 250,000 lines, parsed off the main thread</li>
        </ul>
        <button class="demo" onclick={loadDemo}>Open the sample incident</button>
      </div>
      <div class="intake">
        <Intake {workspace} rows={9} />
        <p class="drophint">or drop up to six files anywhere on this page</p>
      </div>
    </section>
  {/if}

  <Footer />
</div>

<style>
  .app {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 100dvh;

    &.loaded {
      height: 100dvh;
      grid-template-columns: var(--rail) minmax(0, 1fr);

      .bar {
        grid-column: 1 / -1;
      }
    }

    &.dropping::after {
      content: '';
      position: fixed;
      inset: 0;
      border: 2px dashed var(--accent);
      background: color-mix(in srgb, var(--accent) 6%, transparent);
      pointer-events: none;
    }
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    background: var(--surface-sunken);

    h1 {
      margin: 0;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: var(--text-md);
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    p {
      margin: 0;
      color: var(--text-muted);
      font-size: var(--text-sm);
    }

    .local {
      margin-inline-start: auto;
      color: var(--text-faint);
      font-size: var(--text-xs);
    }
  }

  main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .paste {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    background: var(--surface-raised);
  }

  .log {
    flex: 1;
    min-height: 0;
  }

  .nothing {
    margin: 0;
    padding: var(--space-8) var(--space-4);
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: var(--text-base);
  }

  .status {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--border);
    background: var(--surface-raised);
    color: var(--text-faint);
    font-size: var(--text-xs);

    .notice {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      color: var(--accent);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .range {
      font-family: var(--font-mono);
    }

    kbd {
      padding: 1px 4px;
      border: 1px solid var(--border-strong);
      border-radius: 2px;
      background: var(--surface);
      font-family: var(--font-mono);
      font-size: 0.9em;
    }
  }

  .hero {
    display: grid;
    align-content: start;
    gap: var(--space-8);
    max-width: 68rem;
    padding: clamp(var(--space-6), 6vh, var(--space-8)) var(--space-6);
  }

  @media (min-width: 60rem) {
    .hero {
      grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
      align-content: center;
      gap: var(--space-8);
      margin-inline: auto;
      width: 100%;
    }
  }

  .pitch {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: start;

    p {
      margin: 0;
      max-width: 34ch;
      color: var(--text);
      font-size: var(--text-lg);
      line-height: 1.55;
      text-wrap: balance;
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      color: var(--text-muted);
      font-size: var(--text-sm);
      line-height: 1.5;
    }

    li {
      padding-inline-start: var(--space-4);
      border-inline-start: 1px solid var(--border-strong);
    }
  }

  .demo {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: none;
    color: var(--text);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: background 150ms var(--ease);

    &:hover {
      background: var(--surface-hover);
    }
  }

  .intake {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .drophint {
    margin: 0;
    color: var(--text-faint);
    font-size: var(--text-xs);
  }
</style>
