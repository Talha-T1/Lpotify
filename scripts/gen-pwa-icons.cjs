// Lpotify mobil/PWA ikonlarini uretir. Saf Node.js — dis bagimlilik yok.
// Kullanim: node scripts/gen-pwa-icons.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const circle = { cx: 50, cy: 50, r: 48 };
const arcs = [
  { p0: [73, 40], c: [50, 53], p1: [25, 44], w: 8 },
  { p0: [70, 28], c: [50, 39], p1: [29, 32], w: 7 },
  { p0: [66, 17], c: [50, 26], p1: [33, 20], w: 6 },
];

function distToQuad(px, py, a) {
  let min = Infinity;
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const mt = 1 - t;
    const x = mt * mt * a.p0[0] + 2 * mt * t * a.c[0] + t * t * a.p1[0];
    const y = mt * mt * a.p0[1] + 2 * mt * t * a.c[1] + t * t * a.p1[1];
    const d = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
    if (d < min) min = d;
  }
  return min;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function render(size, maskable) {
  const SCALE = size / 100;
  const pad = maskable ? 8 : 0;
  const objR = circle.r - pad / SCALE;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / SCALE;
      const v = (y + 0.5) / SCALE;
      const dc = Math.sqrt((u - circle.cx) ** 2 + (v - circle.cy) ** 2);
      const circleCov = clamp01(objR + 0.5 - dc);
      let ink = 0;
      for (const a of arcs) {
        const d = distToQuad(u, v, a);
        ink = Math.max(ink, clamp01(a.w / 2 + 0.5 - d));
      }
      const idx = (y * size + x) * 4;
      const r = Math.round(0x1d + (0 - 0x1d) * ink);
      const g = Math.round(0xb9 + (0 - 0xb9) * ink);
      const b = Math.round(0x54 + (0 - 0x54) * ink);
      pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b;
      pixels[idx + 3] = Math.round(255 * circleCov);
    }
  }
  return pixels;
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crcBuf]);
}
function writePng(filePath, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
[[192, 'icon-192.png', false], [512, 'icon-512.png', false], [512, 'icon-maskable-512.png', true]].forEach(([size, name, mask]) => {
  writePng(path.join(out, name), size, size, render(size, mask));
  console.log('Yazildi:', name);
});