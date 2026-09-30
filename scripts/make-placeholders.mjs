#!/usr/bin/env node
// Generates the placeholder JPEGs referenced by content/seed.json into
// content/seed-images/. Pure JS (jpeg-js, a dev dependency); no native modules.
// Output is small on purpose: all files together stay well under 50 KB.
//
//   node scripts/make-placeholders.mjs
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "seed-images");

// name, width, height, sky top, sky bottom, land colours (back to front)
const IMAGES = [
  ["seed-art-1.jpg", 400, 500, [196, 214, 222], [236, 226, 204], [[120, 146, 140], [74, 104, 92], [44, 66, 58]]],
  ["seed-art-2.jpg", 520, 390, [238, 196, 160], [250, 232, 206], [[168, 132, 120], [118, 96, 96], [70, 62, 72]]],
  ["seed-art-3.jpg", 440, 440, [150, 176, 200], [214, 222, 226], [[96, 124, 148], [64, 92, 110], [36, 58, 70]]],
  ["seed-hero.jpg", 720, 405, [210, 222, 214], [244, 238, 222], [[150, 170, 150], [100, 128, 106], [58, 84, 70]]],
  ["seed-about.jpg", 400, 500, [226, 214, 196], [244, 238, 228], [[170, 150, 120], [128, 110, 88], [84, 72, 60]]],
];

const lerp = (a, b, t) => a + (b - a) * t;

function render(w, h, top, bottom, lands, seed) {
  const data = Buffer.alloc(w * h * 4);
  // Layered ridgelines made of a few sines; deterministic per image.
  const ridges = lands.map((_, i) => {
    const base = 0.45 + i * 0.16;
    const a = [0.05, 0.03, 0.015].map((x, k) => x * (1 + ((seed * (k + 3) + i * 7) % 5) / 5));
    const f = [1.3 + i * 0.4 + seed * 0.1, 3.1 + i, 7.7 + seed];
    return (x) => base + a[0] * Math.sin(x * f[0] + seed) + a[1] * Math.sin(x * f[1] + i) + a[2] * Math.sin(x * f[2]);
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      let c = top.map((t, k) => lerp(t, bottom[k], v));
      for (let i = 0; i < lands.length; i++) {
        if (v > ridges[i](u * Math.PI * 2)) c = lands[i].map((l, k) => lerp(l, c[k] * 0.2 + l * 0.8, 0.3 * (1 - v)));
      }
      const o = (y * w + x) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
  }
  return jpeg.encode({ data, width: w, height: h }, 40).data;
}

mkdirSync(outDir, { recursive: true });
let total = 0;
IMAGES.forEach(([name, w, h, top, bottom, lands], i) => {
  const file = join(outDir, name);
  writeFileSync(file, render(w, h, top, bottom, lands, i + 1));
  const size = statSync(file).size;
  total += size;
  console.log(`${name} ${w}x${h} ${size} bytes`);
});
console.log(`total ${total} bytes`);
if (total > 50_000) {
  console.error("Placeholders exceed 50 KB; lower the size or quality.");
  process.exit(1);
}
