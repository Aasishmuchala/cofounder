// Minimal, dependency-free ZIP writer (store method — no compression).
// Enough to bundle a generated Next.js project for download.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u16 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
const u32 = (n: number) =>
  new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);

function concat(arrs: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of arrs) len += a.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

/** Build a valid .zip (store/no-compression) from in-memory text files. */
export function makeZip(files: { name: string; content: string }[]): Buffer {
  const enc = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.content);
    const crc = crc32(data);
    const lfh = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), name, data,
    ]);
    local.push(lfh);
    central.push(
      concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
      ]),
    );
    offset += lfh.length;
  }

  const centralBuf = concat(central);
  const eocd = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBuf.length), u32(offset), u16(0),
  ]);
  return Buffer.from(concat([...local, centralBuf, eocd]));
}
