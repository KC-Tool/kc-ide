// Koder 应用图标生成器
// 使用 Node.js 内置模块生成 256x256 PNG 图标
// 运行：node scripts/generate-icon.js

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIZE = 256;
const HALF = SIZE / 2;

// ---- CRC32 ----
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcBuf]);
}

// ---- 像素渲染 ----

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 点到线段距离
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// 数字到线段距离（半透明抗锯齿）
function lineField(px, py, x1, y1, x2, y2, thick) {
  const d = distToSeg(px, py, x1, y1, x2, y2);
  return clamp((thick + 1 - d) / 2, 0, 1);
}

function generatePixels() {
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const CR = 80; // corner radius

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;

      // Rounded rect distance
      let rx = x, ry = y;
      if (rx < CR) rx = CR - Math.abs(rx - CR);
      if (rx > SIZE - CR) rx = CR - Math.abs(rx - (SIZE - CR));
      if (ry < CR) ry = CR - Math.abs(ry - CR);
      if (ry > SIZE - CR) ry = CR - Math.abs(ry - (SIZE - CR));
      const distRounded = Math.hypot(Math.abs(x - HALF) - (HALF - CR),
                                      Math.abs(y - HALF) - (HALF - CR));
      const inside = distRounded <= CR;
      const fade = clamp((CR + 2 - distRounded) / 4, 0, 1);

      if (!inside && fade <= 0) {
        pixels[idx + 3] = 0;
        continue;
      }

      // Diagonal gradient: #6366f1 → #3b82f6
      const t = (x + y) / (2 * SIZE);
      const r = Math.round(lerp(99, 59, t));
      const g = Math.round(lerp(102, 130, t));
      const b = Math.round(lerp(241, 246, t));
      const alpha = Math.round(255 * fade);

      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = alpha;
    }
  }

  // === 绘制 "K" 字母 ===
  const kLines = [
    // Vertical bar: x=82~106, y=72~184
    { x1: 94, y1: 72, x2: 94, y2: 184, thick: 10 },
    // Upper arm: from middle going upper-right
    { x1: 100, y1: 128, x2: 175, y2: 72, thick: 9 },
    // Lower arm: from middle going lower-right
    { x1: 100, y1: 128, x2: 175, y2: 184, thick: 9 },
  ];

  // Code bracket accent </> at smaller opacity
  const bracketLines = [
    { x1: 48, y1: 104, x2: 30, y2: 128, thick: 5 },
    { x1: 30, y1: 128, x2: 48, y2: 152, thick: 5 },
    { x1: 208, y1: 104, x2: 226, y2: 128, thick: 5 },
    { x1: 226, y1: 128, x2: 208, y2: 152, thick: 5 },
  ];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;
      if (pixels[idx + 3] === 0) continue;

      // Draw bracket lines (semi-transparent)
      for (const l of bracketLines) {
        const lf = lineField(x, y, l.x1, l.y1, l.x2, l.y2, l.thick);
        if (lf > 0) {
          const a = pixels[idx + 3] / 255;
          // Mix white (semi-transparent) over background
          const w = 0.4 * lf * a;
          const bgR = pixels[idx] / 255;
          const bgG = pixels[idx + 1] / 255;
          const bgB = pixels[idx + 2] / 255;
          pixels[idx] = Math.round(255 * (bgR * (1 - w) + w));
          pixels[idx + 1] = Math.round(255 * (bgG * (1 - w) + w));
          pixels[idx + 2] = Math.round(255 * (bgB * (1 - w) + w));
        }
      }

      // Draw K lines (white)
      for (const l of kLines) {
        const lf = lineField(x, y, l.x1, l.y1, l.x2, l.y2, l.thick);
        if (lf > 0) {
          const a = pixels[idx + 3] / 255;
          const w = 0.95 * lf * a;
          const bgR = pixels[idx] / 255;
          const bgG = pixels[idx + 1] / 255;
          const bgB = pixels[idx + 2] / 255;
          pixels[idx] = Math.round(255 * (bgR * (1 - w) + w));
          pixels[idx + 1] = Math.round(255 * (bgG * (1 - w) + w));
          pixels[idx + 2] = Math.round(255 * (bgB * (1 - w) + w));
        }
      }
    }
  }

  return pixels;
}

// ---- PNG 编码 ----

function encodePNG(pixels, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // color type: RGBA
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace

  // Raw scanlines: filter byte (0 = None) + RGBA pixels per row
  const rowLen = 1 + width * 4;
  const raw = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowLen;
    raw[rowStart] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = rowStart + 1 + x * 4;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 主逻辑 ----

const outDir = path.join(__dirname, '..', 'build');
const outFile = path.join(outDir, 'icon.png');

console.log(`[icon-gen] Generating ${SIZE}x${SIZE} PNG icon...`);
const pixels = generatePixels();
const png = encodePNG(pixels, SIZE, SIZE);

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
fs.writeFileSync(outFile, png);
console.log(`[icon-gen] Done: ${outFile} (${png.length} bytes)`);
