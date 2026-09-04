// Lpotify logosunu (180° çevrilmiş Spotify logosu) PNG ve ICO olarak üretir.
// Saf Node.js — dış bağımlılık yok. Kullanım: node scripts/gen-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;
const SCALE = SIZE / 100;

// Logo geometrisi (100x100 koordinat sisteminde)
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
    const dx = px - x, dy = py - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < min) min = d;
  }
  return min;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const u = (x + 0.5) / SCALE;
    const v = (y + 0.5) / SCALE;
    // Daire (yeşil) kenar yumuşatmalı
    const dc = Math.sqrt((u - circle.cx) ** 2 + (v - circle.cy) ** 2);
    const circleCov = clamp01(circle.r + 0.5 - dc);
    // Yaylar (siyah) kenar yumuşatmalı
    let ink = 0;
    for (const a of arcs) {
      const d = distToQuad(u, v, a);
      const half = a.w / 2;
      ink = Math.max(ink, clamp01(half + 0.5 - d));
    }
    const idx = (y * SIZE + x) * 4;
    // yeşil #1DB954 üzerinde siyah mürekkep
    const gr = 0x1d, gg = 0xb9, gb = 0x54;
    const r = Math.round(gr + (0 - gr) * ink);
    const g = Math.round(gg + (0 - gg) * ink);
    const b = Math.round(gb + (0 - gb) * ink);
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = Math.round(255 * circleCov);
  }
}

// --- PNG yazıcı ---
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
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(filePath, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter none
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

const buildDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(buildDir, { recursive: true });
const pngPath = path.join(buildDir, 'icon.png');
writePng(pngPath, SIZE, SIZE, pixels);
console.log('PNG yazıldı:', pngPath);

// --- ICO yazıcı (256x256 PNG içinde gömülü — modern Windows destekler) ---
const pngData = fs.readFileSync(pngPath);
const ico = Buffer.alloc(6 + 16 + pngData.length);
ico.writeUInt16LE(0, 0); // reserved
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // count
const entry = ico.slice(6, 22);
entry[0] = 0; entry[1] = 0; // 256 => 0
entry[2] = 0; entry[3] = 0;
entry[4] = 1; entry[5] = 0; // planes
entry[6] = 32; entry[7] = 0; // bpp
entry.writeUInt32LE(pngData.length, 8);
entry.writeUInt32LE(22, 12); // offset
pngData.copy(ico, 22);
const icoPath = path.join(buildDir, 'icon.ico');
fs.writeFileSync(icoPath, ico);
console.log('ICO yazıldı:', icoPath);