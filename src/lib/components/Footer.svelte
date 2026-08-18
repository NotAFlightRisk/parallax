<script lang="ts">
  const REPO = 'https://github.com/NotAFlightRisk/parallax';
  const PANELS = ['Self-host', 'Privacy', 'Terms'] as const;

  type Panel = (typeof PANELS)[number];

  const year = new Date().getFullYear();

  let panel = $state<Panel | null>(null);
  let sheet = $state<HTMLDialogElement | null>(null);

  function open(name: Panel) {
    panel = name;
    sheet?.showModal();
  }
</script>

<footer class="site">
  <p class="legal">
    Licensed under <a href="{REPO}/blob/main/LICENSE">MIT</a> © {year}
    <span class="dot" aria-hidden="true">•</span>
    <a href={REPO}>Source on GitHub</a>
  </p>

  <p class="docs">
    {#each PANELS as name, i (name)}
      {#if i > 0}<span class="dot" aria-hidden="true">•</span>{/if}
      <button onclick={() => open(name)}>{name}</button>
    {/each}
  </p>
</footer>

<dialog bind:this={sheet} aria-labelledby="sheet-title" onclose={() => (panel = null)}>
  <h2 id="sheet-title">{panel}</h2>

  {#if panel === 'Self-host'}
    <p>
      It's a static site with no backend, so anything that can serve files will run it. The quickest
      is Docker:
    </p>
    <p class="run"><code>docker run -p 8080:8080 notaflightrisk/parallax</code></p>
    <p>
      Or grab the zip off the <a href="{REPO}/releases/latest">latest release</a> and point a static
      host at the folder. The <a href="{REPO}#deployment">readme</a> has the rest, including Vercel, Netlify
      and Cloudflare.
    </p>
  {:else if panel === 'Privacy'}
    <p>
      There's nothing to collect. Your logs are read here in this tab, by your own browser, and they
      never go anywhere near a server of ours.
    </p>
    <p>
      No cookies, no accounts, no analytics, nothing saved between visits. Close the tab and it's
      gone.
    </p>
  {:else if panel === 'Terms'}
    <p>
      Free to use for anything, work included, under the <a href="{REPO}/blob/main/LICENSE"
        >MIT licence</a
      >.
    </p>
    <p>
      It comes with no warranty though. If a timestamp comes out wrong or a line lands in the wrong
      place, check it against the original log before you act on it.
    </p>
  {/if}

  <button class="close" onclick={() => sheet?.close()}>Close</button>
</dialog>

<style>
  .site {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    grid-column: 1 / -1;
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--border);
    background: var(--surface-sunken);
    color: var(--text-muted);
    font-size: var(--text-xs);

    p {
      margin: 0;
    }
  }

  .docs {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .dot {
    color: var(--text-faint);
  }

  a,
  .docs button {
    border: none;
    background: none;
    padding: 0;
    color: inherit;
    cursor: pointer;
    font-size: inherit;
    text-decoration: underline;
    text-decoration-color: var(--border-strong);
    text-underline-offset: 0.25em;
    transition: color 150ms var(--ease);

    &:hover {
      color: var(--accent);
      text-decoration-color: currentColor;
    }
  }

  dialog {
    max-width: min(34rem, calc(100vw - var(--space-8)));
    padding: var(--space-6);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-raised);
    color: var(--text-muted);
    font-size: var(--text-base);
    line-height: 1.6;
    opacity: 0;
    translate: 0 var(--space-2);
    transition:
      opacity 160ms var(--ease),
      translate 160ms var(--ease),
      display 160ms allow-discrete,
      overlay 160ms allow-discrete;

    &[open] {
      opacity: 1;
      translate: 0 0;

      @starting-style {
        opacity: 0;
        translate: 0 var(--space-2);
      }
    }

    &::backdrop {
      background: color-mix(in srgb, #000 55%, transparent);
    }

    h2 {
      margin: 0 0 var(--space-4);
      color: var(--text);
      font-size: var(--text-md);
      font-weight: 600;
    }

    p {
      margin: 0 0 var(--space-3);
      max-width: 60ch;
    }

    a {
      color: var(--accent);
    }
  }

  .run code {
    display: inline-block;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius);
    background: var(--surface-sunken);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    user-select: all;
  }

  .close {
    display: block;
    margin-top: var(--space-2);
    margin-inline-start: auto;
    padding: var(--space-1) var(--space-3);
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
</style>
