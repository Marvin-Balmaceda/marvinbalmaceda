#!/usr/bin/env node
/*
 * One-time markup generator. NOT a build step — run it, paste the output into
 * index.html / work.html, commit the HTML.
 *
 * Why the cards are static HTML rather than rendered from this data at runtime:
 * the client names ARE the SEO asset. If they only exist inside a JS array,
 * they are not in the source, and the whole point of the name wall collapses.
 * So JS stays pure progressive enhancement and the markup carries the content.
 *
 *   node tools/generate-cards.js cards 9   > /tmp/cards-home.html
 *   node tools/generate-cards.js cards     > /tmp/cards-all.html
 *   node tools/generate-cards.js panels    > /tmp/panels.html
 *   node tools/generate-cards.js counts
 */
const fs = require('fs');
const path = require('path');

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'work-data.json'), 'utf8')
);

/* The nine that lead on the homepage — chosen for name recognition while still
   covering all four categories, so the filter chips have something to show. */
const FEATURED = [
  'frank-kern', 'dean-graziosi', 'jj-virgin',
  'david-bach', 'ocean-unite', 'certus-trading',
  'grillmaster', 'lifeboost-coffee', 'dropship-club',
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const commas = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/* Pan distance as a percentage of the image's own height, so it stays correct
   at every viewport width without measuring anything in JS.
   frame is 3:4  ->  pan% = (1 - (4 * w) / (3 * h)) * 100                     */
const panPct = (w, h) => Math.max(0, (1 - (4 * w) / (3 * h)) * 100).toFixed(2);

function card(item, i, eager) {
  const pan = panPct(item.cardW, item.cardH);
  const priority = i < eager;
  return `        <article class="work-card reveal" data-cat="${item.category}" style="--pan:${pan}%;--reveal-delay:${(i % 3) * 60}ms">
          <a class="work-card__link" href="#p-${item.slug}" data-piece="${item.slug}">
            <span class="work-card__chrome">
              <span class="work-card__client">${esc(item.client)}</span>
              <span class="work-card__cat">${esc(item.categoryLabel)}</span>
            </span>
            <span class="work-card__frame">
              <picture>
                <source srcset="img/work/${item.slug}.avif" type="image/avif">
                <source srcset="img/work/${item.slug}.webp" type="image/webp">
                <img src="img/work/${item.slug}.jpg" alt="${esc(item.alt)}"
                     width="${item.cardW}" height="${item.cardH}"
                     ${priority ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
              </picture>
            </span>
            <span class="work-card__spec">
              <span class="work-card__height">${item.role ? esc(item.role) : ''}</span>
              <span class="work-card__view">Open</span>
            </span>
          </a>
        </article>`;
}

/* ---- Diagonal marquee wall ------------------------------------------------
   A vanilla port of the React DiagonalMarqueeCarousel: five rows on a -25deg
   rotation, alternating direction, staggered speeds, hover to pause.

   Row composition matters for DOM weight. The original triples the full set and
   renders it twice per row — 720 nodes at our 24 pieces. Instead each row takes
   a 12-piece window at a different offset, duplicated once for the seamless
   -50% loop: 24 nodes a row, 120 total, and still only 24 unique images for the
   browser to fetch. One window (~5,200px) already exceeds 200vw, so the loop
   never shows a gap. */
const ROWS = [
  { offset: 0,  dir: 'left',  speed: 120 },
  { offset: 12, dir: 'right', speed: 105, reverse: true },
  { offset: 6,  dir: 'left',  speed: 135 },
  { offset: 18, dir: 'right', speed: 114, reverse: true },
  { offset: 3,  dir: 'left',  speed: 144 },
];
const WINDOW = 12;

function mqCard(item, dup) {
  return `          <a class="mq-card" href="#p-${item.slug}" data-piece="${item.slug}"${dup ? ' aria-hidden="true" tabindex="-1"' : ''}>
            <picture>
              <source srcset="img/work/${item.slug}.avif" type="image/avif">
              <source srcset="img/work/${item.slug}.webp" type="image/webp">
              <img src="img/work/${item.slug}.jpg" alt="${dup ? '' : esc(item.alt)}"
                   width="${item.cardW}" height="${item.cardH}" loading="lazy" decoding="async">
            </picture>
            <span class="mq-card__label">${esc(item.client)}</span>
          </a>`;
}

function marquee() {
  return ROWS.map((row) => {
    let win = Array.from({ length: WINDOW },
      (_, i) => data[(row.offset + i) % data.length]);
    if (row.reverse) win = win.reverse();
    const half = (dup) => win.map((it) => mqCard(it, dup)).join('\n');
    return `      <div class="mq-row">
        <div class="mq-track mq-track--${row.dir}" style="--speed:${row.speed}s">
${half(false)}
${half(true)}
        </div>
      </div>`;
  }).join('\n');
}

/* The lightbox panels double as the no-JS fallback: each is a :target section
   holding the full capture. They are display:none until targeted, so browsers
   never fetch those images until one is actually opened. */
function panel(item) {
  return `      <section class="lightbox" id="p-${item.slug}" aria-label="${esc(item.client)} — full page">
        <a class="lightbox__scrim" href="#work" aria-label="Close"></a>
        <div class="lightbox__inner" role="group" aria-labelledby="lb-${item.slug}">
          <header class="lightbox__bar">
            <span class="lightbox__meta">
              <strong id="lb-${item.slug}">${esc(item.client)}</strong>
              <span class="micro">${esc(item.categoryLabel)}${item.role ? ' &middot; ' + esc(item.role) : ''}</span>
            </span>
            <a class="lightbox__close" href="#work" aria-label="Close full page view">Close</a>
          </header>
          <div class="lightbox__scroll">
            <picture>
              <source srcset="img/work/${item.slug}-full.avif" type="image/avif">
              <source srcset="img/work/${item.slug}-full.webp" type="image/webp">
              <img src="img/work/${item.slug}-full.jpg" alt="${esc(item.alt)}"
                   width="${item.fullW}" height="${item.fullH}" loading="lazy" decoding="async">
            </picture>
          </div>
        </div>
      </section>`;
}

/* Every distinct client BRAND in the portfolio folders, product variants
   collapsed (four Peng Joon funnels are one brand, not four). Verified against
   the filenames — this is why the site says 79 and not "100+": a real count is
   more credible than a rounded claim, and it matches the spec-sheet tone. */
const CLIENTS = [
  'Adam Roa', 'Agent Academy', 'Alex Charfen', 'Alexis Neely', 'Allen Brouwer',
  'Amazing Selling Machine', 'Beneath the Waves', 'BodyFX', 'Brad Chandler',
  'Camp Maverick', 'Certus Trading', 'Conscious Copy', 'Cynthia Stadd',
  'Dan Lok', 'Dane Maxwell', 'David Bach', 'David Brown', 'David Schwind',
  'Dean Graziosi', 'Doren Aldana', 'Double Your Dating', 'Evo Planner',
  'Evolved Enterprise', 'Expert Agents Only', 'Express Home Buyer',
  'Fit Father Project', 'Fit Mother Project', 'Food Revolution', 'Frank Kern',
  'Glow 15', 'Grillmaster University', 'Healthy Yoga Life', 'Hope to Haiti',
  'Influence Agent', 'James Guldan', 'Jason Hornung', 'Jesse Elder',
  'JJ Virgin', 'Jules Schroeder', 'Kent Clothier', 'Kevin Harrington',
  'KG Foundation', 'Lifeboost Coffee', 'Lukaijah', 'Mark Kohler', 'Matt Clark',
  'Matt Kreinhelder', 'Matt Morris', 'Maverick 1000', 'Melinda Wittstock',
  'Mike Dillard', 'Mike Koenigs', 'Nest Above', 'Ocean Unite', 'Order in Life',
  'Patrick Combs', 'Peng Joon', 'Rain Catcher', 'Revolution Golf', 'RSD',
  'Ryan Blair', 'Ryan Stewman', 'Saltstong', 'Self Storage Investing',
  'SellerCon', 'Sterling Griffin', 'Strength Doctor', 'Suzanne Evans',
  'Ted McGrath', 'The Doers Way', 'The Dropship Club', 'Thrive Dentist',
  'Tim Atkinson', 'Top Performance Group', 'Underground', 'Voxient',
  'Well Org', 'Xpill', 'Yanik Silver',
];

/* Brands whose gallery piece is filed under a longer product name. */
const BRAND_ALIAS = { 'Well Org': 'wellorg-media' };

function names() {
  const bySlug = {};
  data.forEach((d) => { bySlug[d.client] = d.slug; });
  return CLIENTS.map((n) => {
    const slug = bySlug[n] || BRAND_ALIAS[n];
    return slug
      ? `<a href="#p-${slug}">${esc(n)}</a>`
      : `<span>${esc(n)}</span>`;
  }).join('<i>&middot;</i>\n        ');
}

const [mode, limitArg] = process.argv.slice(2);
const set = limitArg
  ? FEATURED.map((s) => data.find((d) => d.slug === s)).filter(Boolean)
  : data;

if (mode === 'cards') {
  console.log(set.map((it, i) => card(it, i, 3)).join('\n'));
} else if (mode === 'panels') {
  console.log(set.map(panel).join('\n'));
} else if (mode === 'marquee') {
  console.log(marquee());
} else if (mode === 'names') {
  console.log('        ' + names());
} else if (mode === 'counts') {
  console.log(`clients: ${CLIENTS.length} brands, ` +
    `${CLIENTS.filter((n) => data.some((d) => d.client === n) || BRAND_ALIAS[n]).length} linked to a gallery piece`);
  const c = {};
  data.forEach((d) => { c[d.category] = (c[d.category] || 0) + 1; });
  console.log(`All (${data.length})`);
  Object.entries(c).forEach(([k, v]) => {
    const label = data.find((d) => d.category === k).categoryLabel;
    console.log(`${label} (${v})  [${k}]`);
  });
  const missing = data.filter((d) => !d.role).length;
  if (missing) console.log(`\nNOTE: ${missing}/${data.length} pieces have no role/credit set.`);
} else {
  console.log('usage: generate-cards.js cards [9] | panels | marquee | names | counts');
}
