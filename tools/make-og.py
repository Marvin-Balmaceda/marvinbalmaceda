#!/usr/bin/env python3
"""
One-time generator for the Open Graph / Twitter card images.

Emits 1200x630 JPEGs into img/og/ — the size every major platform crops from.
Run it when the wording or the palette changes, then commit the output.

Pillow cannot read woff2, so the two webfonts are converted to temporary TTFs
in memory-adjacent temp files via fontTools and discarded afterwards.
"""
import os
import tempfile

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "img", "og")

W, H = 1200, 630
COCOA, SAND, CAMEL, BRICK = "#322C2B", "#EDE0CE", "#AF8260", "#803D3B"


def ttf(woff2_name):
    """woff2 -> temporary ttf path that Pillow can load."""
    src = os.path.join(ROOT, "fonts", woff2_name)
    f = TTFont(src)
    fd, path = tempfile.mkstemp(suffix=".ttf")
    os.close(fd)
    f.flags = getattr(f, "flags", 0)
    f.save(path)
    return path


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# Page -> (kicker, headline, filename)
CARDS = [
    ("Web developer for personal brands", "Marvin Balmaceda", "og-home.jpg"),
    ("Selected work", "Twenty-four builds for brands you already know", "og-work.jpg"),
    ("Services", "Design comes in. A working, tracked, fast site goes out.", "og-services.jpg"),
    ("About", "One developer, fifteen years, no hand-offs", "og-about.jpg"),
    ("Start a project", "Tell me what you're building", "og-start.jpg"),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    display = ttf("archivo-var.woff2")
    text_f = ttf("schibsted-var.woff2")

    portrait = Image.open(os.path.join(ROOT, "img", "marvin-hero.png")).convert("RGBA")
    portrait = portrait.crop(portrait.getchannel("A").getbbox())
    ph = 600
    portrait = portrait.resize((round(portrait.width * ph / portrait.height), ph), Image.LANCZOS)

    for kicker, headline, name in CARDS:
        im = Image.new("RGB", (W, H), COCOA)
        d = ImageDraw.Draw(im)

        # Faceted ground, echoing the hero. Kept very low contrast so the type
        # stays the subject at thumbnail size.
        for pts, tone in (
            ([(0, 0), (430, 0), (150, 330)], "#3A3331"),
            ([(430, 0), (980, 0), (520, 300)], "#2C2726"),
            ([(0, 330), (200, 630), (0, 630)], "#3A3331"),
            ([(900, 630), (1200, 380), (1200, 630)], "#2C2726"),
        ):
            d.polygon(pts, fill=tone)

        # Portrait bleeds off the right edge, as on the site.
        im.paste(portrait, (W - portrait.width + 40, H - ph), portrait)

        # Scrim so long headlines stay readable over the figure.
        veil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(veil).rectangle([0, 0, 760, H], fill=(50, 44, 43, 210))
        im = Image.alpha_composite(im.convert("RGBA"), veil).convert("RGB")
        d = ImageDraw.Draw(im)

        pad, maxw = 72, 620
        f_kick = ImageFont.truetype(text_f, 26)
        f_head = ImageFont.truetype(display, 66)
        f_foot = ImageFont.truetype(text_f, 24)

        d.text((pad, 92), kicker.upper(), font=f_kick, fill=CAMEL)

        lines = wrap(d, headline, f_head, maxw)
        y = 148
        for ln in lines:
            d.text((pad, y), ln, font=f_head, fill=SAND)
            y += 78

        d.rectangle([pad, H - 132, pad + 54, H - 129], fill=BRICK)
        d.text((pad, H - 108), "marvinbalmaceda.com", font=f_foot, fill=CAMEL)

        im.save(os.path.join(OUT, name), "JPEG", quality=86, optimize=True)
        kb = os.path.getsize(os.path.join(OUT, name)) / 1024
        print(f"  {name:18} {W}x{H}  {kb:5.0f} KB  ({len(lines)} line{'s' if len(lines) > 1 else ''})")

    for p in (display, text_f):
        os.unlink(p)


if __name__ == "__main__":
    main()
