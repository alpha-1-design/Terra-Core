/**
 * Generates the Terra-Core PWA icon set (zero dependencies, pure Node).
 *
 * The logo is the app's neobrutalist brand mark: a volt-yellow square with a
 * thick ink border and the letters "TC" set in a 5x7 bitmap font.
 *
 *   bun run scripts/generate-icons.mjs
 *
 * Writes:
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/maskable-512.png   (full-bleed, content inside safe zone)
 *   public/icons/apple-touch-icon.png
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "icons");

const INK = [0x14, 0x14, 0x14, 255];
const VOLT = [0xff, 0xd4, 0x00, 255];

// 5x7 bitmap glyphs, 1 = filled.
const GLYPH_T = ["11111", "00100", "00100", "00100", "00100", "00100", "00100"];
const GLYPH_C = ["01110", "10001", "10000", "10000", "10000", "10001", "01110"];
const FONT = {
  T: GLYPH_T,
  C: GLYPH_C,
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
};

/* ── Minimal PNG encoder (8-bit RGBA, filter 0) ─────────────────── */

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Rasterizer ─────────────────────────────────────────────────── */

function renderBadge(size, { cell, border, maskable }) {
  const px = new Uint8Array(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  };
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) set(x, y, c);
    }
  };

  rect(0, 0, size, size, VOLT);

  if (!maskable && border > 0) {
    rect(0, 0, size, border, INK);
    rect(0, size - border, size, size, INK);
    rect(0, 0, border, size, INK);
    rect(size - border, 0, size, size, INK);
  }

  const glyphW = 5 * cell;
  const glyphH = 7 * cell;
  const gap = 2 * cell;
  const totalW = glyphW * 2 + gap;
  const x0 = Math.floor((size - totalW) / 2);
  const y0 = Math.floor((size - glyphH) / 2);

  const drawGlyph = (glyph, offsetX) => {
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] === "1") {
          rect(
            x0 + offsetX + gx * cell,
            y0 + gy * cell,
            x0 + offsetX + (gx + 1) * cell,
            y0 + (gy + 1) * cell,
            INK,
          );
        }
      }
    }
  };

  drawGlyph(GLYPH_T, 0);
  drawGlyph(GLYPH_C, glyphW + gap);
  return px;
}

/* ── OG / social card (1200x630) ────────────────────────────────── */

function renderOgCard(width, height) {
  const px = new Uint8Array(width * height * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  };
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, c);
  };
  const drawText = (text, cell, startX, startY) => {
    const gap = cell;
    let x = startX;
    for (const ch of text.toUpperCase()) {
      const glyph = FONT[ch];
      if (!glyph) {
        x += gap;
        continue;
      }
      for (let gy = 0; gy < 7; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          if (glyph[gy][gx] === "1") {
            rect(x + gx * cell, startY + gy * cell, x + (gx + 1) * cell, startY + (gy + 1) * cell, INK);
          }
        }
      }
      x += 5 * cell + gap;
    }
  };

  rect(0, 0, width, height, VOLT);
  rect(0, 0, width, 16, INK);
  rect(0, height - 16, width, height, INK);
  rect(0, 0, 16, height, INK);
  rect(width - 16, 0, width, height, INK);

  // TC badge
  const badgeCell = 44;
  const badgeBorder = 16;
  const badgeW = 12 * badgeCell;
  const badgeH = 7 * badgeCell;
  const bx = Math.floor((width - badgeW) / 2);
  const by = 52;
  rect(bx - badgeBorder, by - badgeBorder, bx + badgeW + badgeBorder, by + badgeH + badgeBorder, INK);
  const inner = (x0, y0, x1, y1) => rect(x0, y0, x1, y1, VOLT);
  inner(bx - badgeBorder + 16, by - badgeBorder + 16, bx + badgeW + badgeBorder - 16, by + badgeH + badgeBorder - 16);
  drawText("TC", badgeCell, bx, by);

  // Wordmark
  const word = "TERRA-CORE";
  const cell = 18;
  const wordW = word.length * 6 * cell;
  drawText(word, cell, Math.floor((width - wordW) / 2), 392);
  return px;
}

/* ── Emit ───────────────────────────────────────────────────────── */

mkdirSync(OUT, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, cell: 15, border: 6, maskable: false },
  { file: "icon-512.png", size: 512, cell: 40, border: 16, maskable: false },
  { file: "maskable-512.png", size: 512, cell: 28, border: 0, maskable: true },
  { file: "apple-touch-icon.png", size: 180, cell: 14, border: 6, maskable: false },
];

for (const t of targets) {
  const rgba = renderBadge(t.size, t);
  const png = encodePng(t.size, t.size, rgba);
  writeFileSync(join(OUT, t.file), png);
  console.log(`wrote ${t.file} (${t.size}x${t.size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

const OG_FILE = join(ROOT, "public", "og-image.png");
const og = encodePng(1200, 630, renderOgCard(1200, 630));
writeFileSync(OG_FILE, og);
console.log(`wrote og-image.png (1200x630, ${(og.length / 1024).toFixed(1)} KB)`);
