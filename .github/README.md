<h1 align="center">Parallax 🔭</h1>
<p align="center">
<i>Merge logs from several machines, and line up their clocks</i>
<br />
<b>🌐 <a href="https://parallax.peng.ly/">parallax.peng.ly</a></b><br />
</p>

## About

Drop in up to six logs, read them as one timeline, and nudge the ones whose clock drifted.

<p align="center">
  <a href="https://parallax.peng.ly/">
    <img src="https://pixelflare.cc/iain/screenshots/parallax" width="700" />
  </a>
</p>

---

## Deployment

### Option 1: Quick deploy

Fork the repo, login to any static hosting provider, and import it. Or just use the 1-click deploy button below 👇

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNotAFlightRisk%2Fparallax)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=NotAFlightRisk/parallax)

For Cloudflare it's `npm run build` then `npx wrangler deploy`, the config is already in `wrangler.jsonc`.

### Option 2: Docker

There's a light-weight multi-arch image on [DockerHub](https://hub.docker.com/r/notaflightrisk/parallax) and GHCR ([`ghcr.io/notaflightrisk/parallax`](https://github.com/NotAFlightRisk/parallax/pkgs/container/parallax)).
Providing you've got Docker installed, just run:

```shell
docker run -p 8080:8080 notaflightrisk/parallax
```

### Option 3: From a release

Grab `site.zip` off the [latest release](https://github.com/NotAFlightRisk/parallax/releases/latest), unzip it, and point any static host at the folder.

### Option 4: Build from source

Follow the [Development](#development) steps, then run `npm run build`, and then serve up the `build/` directory.

---

## Development

You'll need [Node](https://nodejs.org/) 22 or newer, plus [Git](https://git-scm.com/). The app is built with [SvelteKit](https://svelte.dev/docs/kit).

```bash
git clone git@github.com:NotAFlightRisk/parallax.git
cd parallax
npm install
npm run dev
```

The dev server is then on [localhost:5173](http://localhost:5173).<br>
Before committing, you should also run: `npm run check` (types), `npm test` (tests) and `npm run preview` (serve a production build locally).

You can also build the container with `docker build -t parallax .`

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/NotAFlightRisk/parallax)

---

## Credits

##### Contributors

[![contributors badge](https://readme-contribs.as93.net/contributors/NotAFlightRisk/parallax?shape=squircle)](https://github.com/NotAFlightRisk/parallax/graphs/contributors)

---

<!-- License + Copyright -->
<p  align="center">
  <a href="https://github.com/NotAFlightRisk"><img width="64" src="https://pixelflare.cc/iain/gif/penguin-dance.gif" /></a><br>
  <sup>
    <i>Licensed under <a href="../LICENSE">MIT</a>, © <a href="https://peng.ly">NotAFlightRisk</a> 2026</i>
  </sup>
</p>

<!--
oooh, hello there! hope you're having a nice day :)
   |\__      |\___
 (:> __)X  (:o ___(
   |/        |/
-->
