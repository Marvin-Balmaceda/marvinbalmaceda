#!/usr/bin/env node
/*
 * Splices generated blocks into the HTML pages. Idempotent: each block is
 * fenced by <!--NAME--> ... <!--/NAME--> so re-running replaces rather than
 * duplicates. Run it after process-images.py, then commit the HTML.
 *
 *   node tools/inject.js
 *
 * This is authoring tooling, not a build step. The committed HTML is the site;
 * nothing here runs at request time, and the client names end up in the source
 * where crawlers can actually read them.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const gen = (...args) =>
  execFileSync('node', [path.join(__dirname, 'generate-cards.js'), ...args],
    { encoding: 'utf8' }).replace(/\n$/, '');

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function splice(html, name, content) {
  const open = `<!--${name}-->`;
  const close = `<!--/${name}-->`;
  const block = `${open}\n${content}\n        ${close}`;
  // Literal index search rather than a regex — the markers contain no special
  // characters, and this cannot mis-escape them.
  const i = html.indexOf(open);
  if (i === -1) return html;
  const j = html.indexOf(close, i);
  const end = j === -1 ? i + open.length : j + close.length;
  return html.slice(0, i) + block + html.slice(end);
}

const partial = (n) => read(`tools/partials/${n}.html`).replace(/\n$/, '');

const blocks = {
  CARDS_HOME: gen('cards', '9'),
  CARDS_ALL: gen('cards'),
  PANELS: gen('panels'),
  NAMES: gen('names'),
  MARQUEE: gen('marquee'),
  TESTIMONIALS: partial('testimonials'),
  TIMELINE: partial('timeline'),
  FORM: partial('form'),
  /* Shared chrome. Duplicated into every page so the shipped HTML is complete
     and crawlable — but authored once here, so a nav change is one edit. */
  HEAD: partial('head'),
  NAV: partial('nav'),
  FOOTER: partial('footer'),
};

/* The hero's single card, pulled from the featured set so it can never drift
   out of sync with what the generator produces. */
blocks.HERO_CARD = blocks.CARDS_HOME.split('</article>')[0] + '</article>';

/* Every page gets the shared chrome; page-specific blocks are added on top. */
const common = { HEAD: blocks.HEAD, NAV: blocks.NAV, FOOTER: blocks.FOOTER };

const targets = {
  'index.html': { MARQUEE: blocks.MARQUEE, PANELS: blocks.PANELS,
                  NAMES: blocks.NAMES, FORM: blocks.FORM,
                  TESTIMONIALS: blocks.TESTIMONIALS, TIMELINE: blocks.TIMELINE },
  'work.html': { CARDS: blocks.CARDS_ALL, PANELS: blocks.PANELS, NAMES: blocks.NAMES },
  'services.html': {},
  'about.html': { TESTIMONIALS: blocks.TESTIMONIALS, TIMELINE: blocks.TIMELINE },
  'start.html': { FORM: blocks.FORM },
  'thank-you.html': {},
  'privacy.html': {},
  '404.html': {},
};

for (const [file, map] of Object.entries(targets)) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) { console.log(`skip ${file.padEnd(16)} (not created yet)`); continue; }
  let html = fs.readFileSync(p, 'utf8');
  const done = [];
  for (const [name, content] of Object.entries({ ...common, ...map })) {
    if (html.includes(`<!--${name}-->`)) { html = splice(html, name, content); done.push(name); }
  }
  fs.writeFileSync(p, html);
  console.log(`${file.padEnd(16)} ${done.join(', ') || '(no markers found)'}`);
}
