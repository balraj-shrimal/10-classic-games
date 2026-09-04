const fs = require('fs');
const zlib = require('zlib');

function createPNG(width, height) {
  // Simple uncompressed or raw filtered scanlines
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      // Gradient background #1e1b4b -> #0f172a
      const t = (x + y) / (width + height);
      const r = Math.floor(30 * (1 - t) + 15 * t);
      const g = Math.floor(27 * (1 - t) + 23 * t);
      const b = Math.floor(75 * (1 - t) + 42 * t);
      
      // Center icon: circle or arcade motif
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      const radius = width * 0.35;

      if (dist < radius) {
        // Inner circle with neon purple/cyan
        const angle = Math.atan2(y - cy, x - cx);
        const ring = Math.abs(dist - radius * 0.7);
        if (ring < width * 0.04) {
          rawData[pixelOffset] = 236; // #ec4899
          rawData[pixelOffset + 1] = 72;
          rawData[pixelOffset + 2] = 153;
        } else if (dist < radius * 0.5) {
          rawData[pixelOffset] = 6; // #06b6d4
          rawData[pixelOffset + 1] = 182;
          rawData[pixelOffset + 2] = 212;
        } else {
          rawData[pixelOffset] = 30;
          rawData[pixelOffset + 1] = 41;
          rawData[pixelOffset + 2] = 59;
        }
      } else {
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
      }
      rawData[pixelOffset + 3] = 255;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const full = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(full), 0);
    return Buffer.concat([len, full, crcBuf]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPNG(512, 512));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180));
console.log('PNG Icons generated successfully in public/');
