#!/usr/bin/env python3
"""
One-time asset processor. NOT a build step — run it manually when the curated
set changes, then commit the output in img/work/.

Produces, per piece:
  <slug>.avif / .webp / .jpg        760w, FULL height  -> the Scroll Window card
  <slug>-full.avif / .webp / .jpg  1400w, FULL height  -> the lightbox

The card keeps the whole page rather than a crop, because the card IS the
signature: it pans the real capture through a 3:4 frame. AVIF makes that
affordable — a 6,385px-tall page lands at ~50KB.

Also emits tools/work-data.json, the single source of truth for the card
generator (real pixel dimensions, so every <img> can carry width/height and
the grid has zero layout shift).

Requires Pillow + pillow-avif-plugin in a throwaway venv. Nothing from that
venv ships; only the finished images land in the repo.
"""
import json
import os
import sys
from PIL import Image

try:
    import pillow_avif  # noqa: F401  (registers the AVIF plugin)
except ImportError:
    sys.exit("pillow-avif-plugin missing: pip install pillow pillow-avif-plugin")

SRC = "/Users/marvinbalmaceda/Desktop/Office/OUR PORTFOLIO"
OUT = os.path.join(os.path.dirname(__file__), "..", "img", "work")

CARD_W, FULL_W = 760, 1400
Q = {"card": {"avif": 50, "webp": 72, "jpg": 78},
     "full": {"avif": 55, "webp": 78, "jpg": 82}}

# category -> the filter chip it belongs to
# dpr=2 marks a retina capture, so the reported page height is halved to stay
# an honest CSS-pixel figure rather than an image-pixel one.
WORK = [
    # ---- Personal Brand (9) — ordered by name recognition -------------------
    ("frank-kern",        "Frank Kern",          "personal-brand", "PERSONAL BRAND SITES", "Personal Brand Site - Frank Kern.jpg", 1),
    ("dean-graziosi",     "Dean Graziosi",       "personal-brand", "PERSONAL BRAND SITES", "Personal Brand Site - Dean Graziosi.jpg", 1),
    ("jj-virgin",         "JJ Virgin",           "personal-brand", "PERSONAL BRAND SITES", "Personal Brand Site - JJ Virgin.jpg", 2),
    ("david-bach",        "David Bach",          "personal-brand", "PERSONAL BRAND SITES", "Personal Brand Site - David Bach.png", 1),
    ("mike-dillard",      "Mike Dillard",        "personal-brand", "PERSONAL BRAND SITES", "Personal Brand Site - Mike Dillard.jpg", 1),
    ("kent-clothier",     "Kent Clothier",       "personal-brand", "PERSONAL BRAND SITES", "Personal Brand Site - Kent Clothier.png", 1),
    ("ted-mcgrath",       "Ted McGrath",         "personal-brand", "PERSONAL BRAND SITES", "Personal Brand Site - Ted Mcgrath.png", 1),
    ("ryan-blair",        "Ryan Blair",          "personal-brand", "PERSONAL BRAND SITES", "Personal Brand Site - Ryan Blair.png", 1),
    ("matt-morris",       "Matt Morris",         "personal-brand", "PERSONAL BRAND SITES", "Personal Brand Site - Matt Morris.png", 1),

    # ---- Corporate (9) ------------------------------------------------------
    ("ocean-unite",       "Ocean Unite",         "corporate", "CORPORATE BRAND SITES", "Corporate Brand Site - Ocean Unite.jpg", 2),
    ("certus-trading",    "Certus Trading",      "corporate", "CORPORATE BRAND SITES", "Corporate Brand Site - Certus Trading.png", 1),
    ("revolution-golf",   "Revolution Golf",     "corporate", "CORPORATE BRAND SITES", "Corporate Brand Site - Revolution Golf.png", 1),
    ("bodyfx",            "BodyFX",              "corporate", "CORPORATE BRAND SITES", "Corporate Brand Site - BodyFX.png", 1),
    ("fit-mother",        "Fit Mother Project",  "corporate", "CORPORATE BRAND SITES", "Corporate Brand Site - Fit Mother Project.png", 1),
    ("fit-father",        "Fit Father Project",  "corporate", "CORPORATE BRAND SITES", "Corporate Brand Site - Fit Father Project.png", 1),
    ("voxient",           "Voxient",             "corporate", "CORPORATE BRAND SITES", "Corporate Brand Site - Voxient.png", 1),
    ("expert-agents",     "Expert Agents Only",  "corporate", "CORPORATE BRAND SITES", "Corporate Brand Site - Expert Agents Only.png", 1),
    ("hope-to-haiti",     "Hope to Haiti",       "corporate", "CORPORATE BRAND SITES", "Corporate Brand Site - Hope to Haiti.png", 1),

    # ---- Sales & Landing (4) ------------------------------------------------
    ("grillmaster",       "Grillmaster University",     "sales-landing", "SALES PAGES",   "Sales Pages - Grillmaster University Cooking With Smoke.png", 1),
    ("lifeboost-coffee",  "Lifeboost Coffee",           "sales-landing", "LANDING PAGES", "Landing Pages - Lifeboost Coffee.png", 1),
    ("wellorg-media",     "Well Org Media Academy",     "sales-landing", "SALES PAGES",   "Sales Pages - Well Org Media Academy.png", 1),
    ("wellorg-moviemaker","Well Org Movie Maker Academy","sales-landing","SALES PAGES",   "Sales Pages - Well Org Movie Maker Academy.png", 1),

    # ---- Membership (2) -----------------------------------------------------
    ("dropship-club",     "The Dropship Club",          "membership", "MEMBERSHIP SITES", "Membership Sites - The Dropship Club.png", 1),
    ("wellorg-series",    "Well Org Interconnected Series", "membership", "MEMBERSHIP SITES", "Membership Sites - Well Org Interconnected Series Membership Site.png", 1),
]

CATEGORY_LABEL = {
    "personal-brand": "Personal Brand",
    "corporate":      "Corporate",
    "sales-landing":  "Sales & Landing",
    "membership":     "Membership",
}


def emit(im, w, out_base, kind):
    """Write avif/webp/jpg at width w. Returns (w, h) of the emitted image."""
    h = round(im.height * w / im.width)
    r = im.resize((w, h), Image.LANCZOS)
    r.save(f"{out_base}.avif", "AVIF", quality=Q[kind]["avif"], speed=5)
    r.save(f"{out_base}.webp", "WEBP", quality=Q[kind]["webp"], method=5)
    r.save(f"{out_base}.jpg",  "JPEG", quality=Q[kind]["jpg"], optimize=True,
           progressive=True)
    return w, h


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest, missing, total = [], [], 0

    for slug, client, cat, folder, filename, dpr in WORK:
        src = os.path.join(SRC, folder, filename)
        if not os.path.exists(src):
            missing.append(f"{slug}: {src}")
            continue

        im = Image.open(src)
        # Palette PNGs with transparency need RGBA first or Pillow warns and
        # can flatten the alpha to black.
        im = im.convert("RGBA").convert("RGB") if im.mode in ("P", "LA", "RGBA") \
            else im.convert("RGB")

        base = os.path.join(OUT, slug)
        cw, ch = emit(im, min(CARD_W, im.width), base, "card")
        fw, fh = emit(im, min(FULL_W, im.width), base + "-full", "full")

        size = sum(os.path.getsize(f"{base}{s}")
                   for s in (".avif", ".webp", ".jpg",
                             "-full.avif", "-full.webp", "-full.jpg"))
        total += size

        manifest.append({
            "slug": slug,
            "client": client,
            "category": cat,
            "categoryLabel": CATEGORY_LABEL[cat],
            "cardW": cw, "cardH": ch,
            "fullW": fw, "fullH": fh,
            # Honest CSS-pixel page height: retina captures are halved.
            "pageHeight": round(im.height / dpr),
            "sourceW": im.width, "sourceH": im.height,
            # role is intentionally blank. It is a factual claim about who did
            # what on each project, so the owner sets it — the card renders
            # cleanly without it rather than asserting something unverified.
            "role": "",
            "alt": f"{client} — website built by Marvin Balmaceda",
        })
        print(f"  {slug:22} card {cw}x{ch:<6} full {fw}x{fh:<6} {size/1024:6.0f} KB")

    with open(os.path.join(os.path.dirname(__file__), "work-data.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n{len(manifest)} pieces, {total/1048576:.1f} MB total on disk")
    counts = {}
    for m in manifest:
        counts[m["categoryLabel"]] = counts.get(m["categoryLabel"], 0) + 1
    print("counts:", ", ".join(f"{k} ({v})" for k, v in counts.items()))
    if missing:
        print("\nMISSING SOURCES — fix these paths:")
        for m in missing:
            print("  " + m)
        sys.exit(1)


if __name__ == "__main__":
    main()
