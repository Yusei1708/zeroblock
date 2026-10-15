import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, '../icons');

function createPng(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth: 8
  ihdr.writeUInt8(6, 9); // color type: 6 (RGBA)
  ihdr.writeUInt8(0, 10); // compression method
  ihdr.writeUInt8(0, 11); // filter method
  ihdr.writeUInt8(0, 12); // interlace method
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Scanlines with filter byte 0 (None)
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData.writeUInt8(0, offset++); // filter byte
    for (let x = 0; x < width; x++) {
      // Draw shield icon / rounded badge
      const nx = (x / width - 0.5) * 2;
      const ny = (y / height - 0.5) * 2;
      const dist = Math.sqrt(nx * nx + ny * ny);

      // Check if inside shield / circle
      if (dist <= 0.85) {
        // Gradient badge: vibrant cyan-blue shield
        const grad = Math.min(1, Math.max(0, 0.5 + ny * 0.4));
        const red = Math.round(r * (1 - grad * 0.3));
        const green = Math.round(g * (1 - grad * 0.2));
        const blue = Math.round(b);
        rawData.writeUInt8(red, offset++);
        rawData.writeUInt8(green, offset++);
        rawData.writeUInt8(blue, offset++);
        rawData.writeUInt8(255, offset++);
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

// Brand color: Royal Ruby Shield (#880015 or #0f766e or #4338ca)
const sizes = [16, 48, 128];
for (const s of sizes) {
  const png = createPng(s, s, 37, 99, 235); // Beautiful electric blue (#2563eb)
  const filePath = path.join(iconsDir, `icon${s}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated ${filePath} (${s}x${s})`);
}
console.log('Icons generated successfully.');
