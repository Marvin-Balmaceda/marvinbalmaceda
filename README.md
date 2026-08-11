# marvinbalmaceda.com

Static site. Plain HTML, CSS and JavaScript — no framework, no build step.
What is committed is exactly what is served.

## Run locally

    python3 -m http.server 8000

Do not open the files over `file://` — it breaks `history.pushState` in the
lightbox and some fetch behaviour.

## Authoring tools (`tools/`)

These are run by hand and their output is committed. Nothing here runs at
request time.

| Command | What it does |
|---|---|
| `python3 tools/process-images.py` | Rebuilds `img/work/` (AVIF + WebP + JPEG, card and lightbox sizes) and rewrites `tools/work-data.json`. Needs Pillow + pillow-avif-plugin. |
| `node tools/generate-cards.js counts` | Prints per-category counts — use these to update the filter chip labels. |
| `node tools/inject.js` | Splices the shared head/nav/footer and the generated gallery, name wall and form into every page. Idempotent. |

Edit the shared chrome in `tools/partials/`, then run `node tools/inject.js`.
Editing nav markup directly in a page will be overwritten on the next run.

The gallery cards and the client name wall are committed as **static HTML** on
purpose: the client names are the SEO asset, so they must be in the source
rather than assembled by JavaScript at runtime.

## Deploy

Netlify, publish directory `.`, no build command. The inquiry form uses Netlify
Forms — enable form detection, then send a real test inquiry and confirm the
notification email arrives before launch.
