#!/usr/bin/env python3
"""
Regenerates the Android launcher icons (ic_launcher / ic_launcher_round /
ic_launcher_foreground, all densities) from the same "TC" brand mark used for
the PWA icons in scripts/generate-icons.mjs — a volt-yellow square with a
thick ink border and the letters "TC" in a 5x7 bitmap font.

The APK previously shipped Capacitor's stock placeholder icon (a blue X
mark) because `bunx cap update` / `cap sync` never rewrote the mipmap PNGs
after the project was rebranded — only public/icons (the PWA set) was ever
regenerated. This script produces the equivalent set for android/app so the
installed APK matches the real Terra-Core icon.

Usage:
    python3 scripts/generate-android-icons.py
"""
from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

INK = (0x14, 0x14, 0x14, 255)
VOLT = (0xFF, 0xD4, 0x00, 255)
TRANSPARENT = (0, 0, 0, 0)

GLYPH_T = ["11111", "00100", "00100", "00100", "00100", "00100", "00100"]
GLYPH_C = ["01110", "10001", "10000", "10000", "10000", "10001", "01110"]

# Legacy launcher sizes (square + round use the same full-bleed badge).
LEGACY_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

# Adaptive-icon foreground canvas sizes (108dp asset at each density).
FOREGROUND_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}


def draw_glyph(draw, glyph, x0, y0, cell, color):
    for gy, row in enumerate(glyph):
        for gx, bit in enumerate(row):
            if bit == "1":
                x = x0 + gx * cell
                y = y0 + gy * cell
                draw.rectangle([x, y, x + cell - 1, y + cell - 1], fill=color)


def draw_tc(draw, size, cell, glyph_color, center_box=None):
    """Draw the T C lockup centered in `center_box` (defaults to full size)."""
    glyph_w = 5 * cell
    glyph_h = 7 * cell
    gap = 2 * cell
    total_w = glyph_w * 2 + gap
    if center_box is None:
        cx0, cy0, cx1, cy1 = 0, 0, size, size
    else:
        cx0, cy0, cx1, cy1 = center_box
    x0 = cx0 + (cx1 - cx0 - total_w) // 2
    y0 = cy0 + (cy1 - cy0 - glyph_h) // 2
    draw_glyph(draw, GLYPH_T, x0, y0, cell, glyph_color)
    draw_glyph(draw, GLYPH_C, x0 + glyph_w + gap, y0, cell, glyph_color)


def render_legacy_badge(size):
    """Full-bleed volt square, thick ink border, TC mark — used for the
    legacy square AND round launcher icons (round gets a circular crop)."""
    img = Image.new("RGBA", (size, size), VOLT)
    draw = ImageDraw.Draw(img)
    border = max(2, round(size * 0.0625))
    draw.rectangle([0, 0, size - 1, border - 1], fill=INK)
    draw.rectangle([0, size - border, size - 1, size - 1], fill=INK)
    draw.rectangle([0, 0, border - 1, size - 1], fill=INK)
    draw.rectangle([size - border, 0, size - 1, size - 1], fill=INK)
    cell = max(1, round(size * (40 / 512)))
    draw_tc(draw, size, cell, INK)
    return img


def render_round(size):
    """Circular badge with the TC mark inset a bit further than the square
    badge, so the glyph strokes clear the circular crop cleanly."""
    img = Image.new("RGBA", (size, size), VOLT)
    draw = ImageDraw.Draw(img)
    border = max(2, round(size * 0.07))
    draw.ellipse([0, 0, size - 1, size - 1], fill=VOLT, outline=INK, width=border)
    inset = round(size * 0.16)
    cell = max(1, round(size * (40 / 512) * 0.82))
    draw_tc(draw, size, cell, INK, (inset, inset, size - inset, size - inset))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    out = Image.new("RGBA", (size, size), TRANSPARENT)
    out.paste(img, (0, 0), mask)
    return out


def render_foreground(size):
    """Adaptive-icon foreground: transparent canvas, TC mark confined to the
    ~66% center safe zone so it isn't clipped by launcher icon masks."""
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    safe_margin = round(size * 0.17)
    center_box = (safe_margin, safe_margin, size - safe_margin, size - safe_margin)
    cell = max(1, round(size * (40 / 512) * 0.66))
    draw_tc(draw, size, cell, INK, center_box)
    return img


def main():
    for density, size in LEGACY_SIZES.items():
        d = os.path.join(RES, f"mipmap-{density}")
        os.makedirs(d, exist_ok=True)
        render_legacy_badge(size).save(os.path.join(d, "ic_launcher.png"))
        render_round(size).save(os.path.join(d, "ic_launcher_round.png"))
        print(f"wrote mipmap-{density}/ic_launcher.png + ic_launcher_round.png ({size}x{size})")

    for density, size in FOREGROUND_SIZES.items():
        d = os.path.join(RES, f"mipmap-{density}")
        os.makedirs(d, exist_ok=True)
        render_foreground(size).save(os.path.join(d, "ic_launcher_foreground.png"))
        print(f"wrote mipmap-{density}/ic_launcher_foreground.png ({size}x{size})")


if __name__ == "__main__":
    main()
