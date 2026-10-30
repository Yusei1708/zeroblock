/**
 * ZeroBlock Icon Generator
 * Native Node.js PNG rasterizer synthesizing shield icons (16, 32, 48, 128px)
 * Zero external image processing dependencies required.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, '../icons');

function isInsideShield(nx, ny, scale = 1.0) {
  // Arched top
  const topArch = -0.78 * scale - 0.08 * (1 - nx * nx);
  if (ny < topArch || ny > 0.92 * scale) return false;

  // Curving tapered sides towards bottom tip
  let maxWidth = 0.82 * scale;
  if (ny > 0) {
    const t = ny / (0.92 * scale);
    maxWidth = 0.82 * scale * Math.max(0, 1 - Math.pow(t, 1.45));
  }
  return Math.abs(nx) <= maxWidth;
}

function isInsideEmblem(nx, ny) {
  // Stylized Z / Slash
  // Top bar: ny between -0.45 and -0.25, nx between -0.45 and 0.45
  if (ny >= -0.45 && ny <= -0.25 && nx >= -0.42 && nx <= 0.42) return true;
  // Bottom bar: ny between 0.25 and 0.45, nx between -0.45 and 0.45
  if (ny >= 0.25 && ny <= 0.45 && nx >= -0.42 && nx <= 0.42) return true;
  // Diagonal slash: line from (0.35, -0.35) to (-0.35, 0.35)
  // Distance to line nx + ny = 0
  const d = Math.abs(nx + ny);
  if (d <= 0.22 && nx >= -0.42 && nx <= 0.42 && ny >= -0.42 && ny <= 0.42) return true;

  return false;
}

function createPng(width, height) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth: 8
  ihdr.writeUInt8(6, 9); // color type: 6 (RGBA)
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Scanlines with filter byte 0 (None)
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData.writeUInt8(0, offset++); // filter byte
    for (let x = 0; x < width; x++) {
      const nx = (x / (width - 1) - 0.5) * 2;
      const ny = (y / (height - 1) - 0.5) * 2;

      const outer = isInsideShield(nx, ny, 1.0);
      const inner = isInsideShield(nx, ny, 0.82);

      if (outer) {
        if (!inner) {
          // Shield Border: Radiant Cyan to Electric Blue gradient
          const borderT = (ny + 1) / 2;
          const r = Math.round(14 + 20 * (1 - borderT));
          const g = Math.round(165 + 40 * (1 - borderT));
          const b = Math.round(233 + 22 * borderT);
          rawData.writeUInt8(r, offset++);
          rawData.writeUInt8(g, offset++);
          rawData.writeUInt8(b, offset++);
          rawData.writeUInt8(255, offset++);
        } else {
          // Inside Shield Core
          const emblem = isInsideEmblem(nx, ny);
          if (emblem) {
            // Glowing White to Neon Cyan Emblem
            const embT = (nx + ny + 1) / 2;
            const r = Math.round(220 + 35 * embT);
            const g = Math.round(245 + 10 * embT);
            const b = 255;
            rawData.writeUInt8(r, offset++);
            rawData.writeUInt8(g, offset++);
            rawData.writeUInt8(b, offset++);
            rawData.writeUInt8(255, offset++);
          } else {
            // Dark Cyber Navy Glass core
            const depth = Math.min(1, Math.max(0, (ny + 0.5) * 0.5));
            const r = Math.round(15 + 15 * depth);
            const g = Math.round(23 + 20 * depth);
            const b = Math.round(42 + 30 * depth);
            rawData.writeUInt8(r, offset++);
            rawData.writeUInt8(g, offset++);
            rawData.writeUInt8(b, offset++);
            rawData.writeUInt8(255, offset++);
          }
        }
      } else {
        // Transparent
        rawData.writeUInt8(0, offset++);
        rawData.writeUInt8(0, offset++);
        rawData.writeUInt8(0, offset++);
        rawData.writeUInt8(0, offset++);
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const crcBody = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcBody), 0);

  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate complete icon sizes: 16, 32, 48, 128
const sizes = [16, 32, 48, 128];
for (const s of sizes) {
  const png = createPng(s, s);
  const filePath = path.join(iconsDir, `icon${s}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated ${filePath} (${s}x${s})`);
}
console.log('Shield emblem icons generated successfully.');
