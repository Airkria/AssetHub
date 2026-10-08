// 生成一张 1024x1024 的纯色（紫）源图，供 `tauri icon` 生成全套图标
const zlib = require("zlib")
const fs = require("fs")

const W = 1024
const H = 1024
const raw = Buffer.alloc(H * (1 + W * 4))

for (let y = 0; y < H; y++) {
  const row = y * (1 + W * 4)
  raw[row] = 0 // filter: none
  // 垂直渐变：浅紫 → 深紫
  const t = y / H
  const r = Math.round(139 + (76 - 139) * t)
  const g = Math.round(92 + (29 - 92) * t)
  const b = Math.round(246 + (136 - 246) * t)
  for (let x = 0; x < W; x++) {
    const p = row + 1 + x * 4
    raw[p] = r
    raw[p + 1] = g
    raw[p + 2] = b
    raw[p + 3] = 255
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, "ascii")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8
ihdr[9] = 6 // RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
])

fs.writeFileSync("icon-source.png", png)
console.log("generated icon-source.png", png.length, "bytes")
