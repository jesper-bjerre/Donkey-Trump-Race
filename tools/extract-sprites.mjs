// Builds game sprites from the character sheets in docs/design/graphics.
// Each sheet is 1536x1024: top row = 4 full-body turnaround poses, bottom row = 4 face close-ups.
// Usage: pnpm sprites
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (name) => resolve(root, 'docs/design/graphics', name);
const outDir = resolve(root, 'packages/client-web/public/sprites');

const PANEL_W = 384;
const BODY_H = 580;
const FACE_Y = 600;
const SPRITE_H = 384;

const PLAYER_COLORS = {
  red: '#e53935',
  blue: '#1e88e5',
  green: '#43a047',
  yellow: '#fdd835',
  purple: '#8e24aa',
};

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  h /= 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

/** Crops a region to RGBA with the flat grey studio background flood-filled to transparent. */
async function cutout(file, left, top, width, height) {
  const { data, info } = await sharp(src(file))
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const idx = (x, y) => (y * w + x) * 4;

  // Per-row background luminance, sampled from the sheet's far-left edge (always studio
  // background) and median-smoothed. The studio gradient is vertical, so it applies to all poses.
  const sheet = await sharp(src(file)).raw().toBuffer({ resolveWithObject: true });
  const sheetLum = (y) => {
    let sum = 0;
    for (let x = 0; x < 4; x++) {
      const i = ((top + y) * sheet.info.width + x) * sheet.info.channels;
      sum += (sheet.data[i] + sheet.data[i + 1] + sheet.data[i + 2]) / 3;
    }
    return sum / 4;
  };
  const rowBg = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    const window = [];
    for (let k = Math.max(0, y - 8); k <= Math.min(h - 1, y + 8); k++) window.push(sheetLum(k));
    window.sort((a, b) => a - b);
    rowBg[y] = window[Math.floor(window.length / 2)];
  }
  const isBackground = (x, y) => {
    const i = idx(x, y);
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const lum = (r + g + b) / 3;
    // Near the feet the studio floor has soft grey shadows; key those out too.
    const tolerance = y > h * 0.85 ? 45 : 26;
    return sat <= 18 && Math.abs(lum - rowBg[y]) <= tolerance;
  };

  const visited = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, 0, x, h - 1);
  for (let y = 0; y < h; y++) stack.push(0, y, w - 1, y);
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const k = y * w + x;
    if (visited[k] || !isBackground(x, y)) continue;
    visited[k] = 1;
    data[idx(x, y) + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  // Soften the fringe: pixels touching transparency get partial alpha.
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) alpha[y * w + x] = data[idx(x, y) + 3];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (alpha[y * w + x] === 0) continue;
      let transparent = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (alpha[(y + dy) * w + x + dx] === 0) transparent++;
      if (transparent > 0) data[idx(x, y) + 3] = 255 - transparent * 50;
    }
  }
  return { data, width: w, height: h };
}

/** Recolors the navy suit to a player color while keeping shading. */
function recolorSuit(image, hex) {
  const [th, ts] = hexToHsl(hex);
  const out = Buffer.from(image.data);
  // Skip the head (top ~30%) so blue eyes are not recolored.
  const start = Math.floor(image.height * 0.3) * image.width * 4;
  for (let i = start; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const [h, s, l] = rgbToHsl(out[i], out[i + 1], out[i + 2]);
    const navy =
      (h >= 190 && h <= 270 && s >= 0.03 && l <= 0.42) ||
      (l < 0.16 && ((h >= 180 && h <= 290) || s < 0.1));
    if (!navy) continue;
    const [r, g, b] = hslToRgb(th, Math.min(0.85, ts * 0.9), Math.min(0.62, 0.12 + l * 1.35));
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }
  return { ...image, data: out };
}

async function writeSprite(image, name) {
  await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .trim({ threshold: 1 })
    .resize({ height: SPRITE_H, fit: 'inside' })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toFile(resolve(outDir, name));
  console.log('wrote', name);
}

async function writeFace(file, panel, name) {
  await sharp(src(file))
    .extract({
      left: panel * PANEL_W + 20,
      top: FACE_Y + 10,
      width: PANEL_W - 40,
      height: PANEL_W - 40,
    })
    .resize(192, 192)
    .webp({ quality: 85 })
    .toFile(resolve(outDir, name));
  console.log('wrote', name);
}

// Poses are not perfectly aligned to 384px panels; these crops contain each full figure.
const POSE_CROPS = [
  [0, 400],
  [384, 400],
  [768, 384],
  [1110, 426],
];
const body = (file, panel) => {
  const [left, width] = POSE_CROPS[panel];
  return cutout(file, left, 0, width, BODY_H);
};

await mkdir(outDir, { recursive: true });

const lokkeFront = await body('Løkke.png', 0);
const lokkeBack = await body('Løkke.png', 3);
for (const [id, hex] of Object.entries(PLAYER_COLORS)) {
  await writeSprite(recolorSuit(lokkeFront, hex), `lokke-${id}-front.png`);
  await writeSprite(recolorSuit(lokkeBack, hex), `lokke-${id}-back.png`);
}
await writeSprite(await body('Trump.png', 0), 'trump-front.png');
await writeSprite(await body('Vivian.png', 0), 'motzfeldt-front.png');

await writeFace('Løkke.png', 0, 'face-lokke.webp');
await writeFace('Løkke.png', 2, 'face-lokke-shocked.webp');
await writeFace('Trump.png', 1, 'face-trump-angry.webp');
await writeFace('Trump.png', 2, 'face-trump-yell.webp');
await writeFace('Vivian.png', 0, 'face-motzfeldt.webp');
await writeFace('Vivian.png', 3, 'face-motzfeldt-happy.webp');
