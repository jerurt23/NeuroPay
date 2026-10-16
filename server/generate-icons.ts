/**
 * Genera los iconos PNG de la app sin dependencias externas.
 *
 * Escribe un PNG valido usando solo zlib de Node (disponible de serie),
 * rasterizando a mano el logo: cuadrado con esquinas redondeadas,
 * degradado azul -> indigo y una "N" blanca.
 *
 * Ejecutar: npx tsx server/generate-icons.ts
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/* ---------- Codificador PNG ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** rgba: Uint8Array de width*height*4 */
function encodePNG(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filter
  ihdr[12] = 0; // no interlace

  // Cada scanline lleva un byte de filtro (0 = sin filtro)
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const o = y * (width * 4 + 1);
    raw[o] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), o + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- Dibujo ---------- */

const BLUE = [37, 99, 235] as const;   // blue-600  #2563eb
const INDIGO = [99, 102, 241] as const; // indigo-500 #6366f1
const WHITE = [255, 255, 255] as const;

type RGB = readonly [number, number, number];

/** Degradado diagonal: azul abajo-izquierda -> indigo arriba-derecha (to-tr) */
function gradient(u: number, v: number): RGB {
  const t = Math.max(0, Math.min(1, (u + (1 - v)) / 2));
  return [
    Math.round(BLUE[0] + (INDIGO[0] - BLUE[0]) * t),
    Math.round(BLUE[1] + (INDIGO[1] - BLUE[1]) * t),
    Math.round(BLUE[2] + (INDIGO[2] - BLUE[2]) * t),
  ];
}

/** Punto dentro de un cuadrado con esquinas redondeadas. */
function inRounded(x: number, y: number, size: number, r: number): boolean {
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * La "N": dos barras verticales y una diagonal.
 * Se evalua por punto, lo que permite antialias por supermuestreo.
 */
function inLetterN(x: number, y: number, x0: number, y0: number, w: number, h: number): boolean {
  const bar = w;
  const t = (y - y0) / h; // 0 arriba, 1 abajo

  // Barra izquierda y derecha
  if (x >= x0 && x <= x0 + bar) return true;
  if (x >= x0 + w - bar && x <= x0 + w) return true;

  // Diagonal de arriba-izquierda a abajo-derecha.
  // Su centro avanza de x0+bar/2 hasta x0+w-bar/2 conforme baja.
  const center = x0 + bar / 2 + (w - bar) * t;
  return Math.abs(x - center) <= bar / 2;
}

function renderIcon(size: number, maskable: boolean): Uint8Array {
  const SS = 3; // supermuestreo 3x3
  const out = new Uint8Array(size * size * 4);
  const radius = maskable ? 0 : size * 0.2237; // estilo iOS/Android

  // Zona segura: Android recorta los iconos maskable, el logo debe
  // caber dentro del circulo central (~80% del ancho).
  const inset = maskable ? size * 0.22 : 0;
  const boxSize = size - inset * 2;
  const barW = boxSize * 0.17;
  const nx = inset + boxSize * 0.28;
  const ny = inset + boxSize * 0.25;
  const nh = boxSize * 0.5;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;

          let inside: boolean;
          if (maskable) {
            inside = true; // full bleed
          } else {
            inside = inRounded(x, y, size, radius);
          }
          if (!inside) continue;

          const col = inLetterN(x, y, nx, ny, barW, nh) ? WHITE : gradient(x / size, y / size);
          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }

      const n = SS * SS;
      const o = (py * size + px) * 4;
      if (a === 0) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      } else {
        const cov = a / n; // cobertura 0..255
        // Promediamos solo los samples que入会aron (alpha real)
        const inside_n = a / 255;
        out[o] = Math.round(r / inside_n);
        out[o + 1] = Math.round(g / inside_n);
        out[o + 2] = Math.round(b / inside_n);
        out[o + 3] = Math.round(cov);
      }
    }
  }
  return out;
}

/* ---------- Escritura ---------- */

const OUT_DIR = path.resolve(process.cwd(), 'public');
mkdirSync(OUT_DIR, { recursive: true });

const TARGETS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

for (const t of TARGETS) {
  const rgba = renderIcon(t.size, t.maskable);
  const png = encodePNG(t.size, t.size, rgba);
  writeFileSync(path.join(OUT_DIR, t.file), png);
  console.log(`  ${t.file.padEnd(26)} ${t.size}x${t.size}  ${(png.length / 1024).toFixed(1)} KB`);
}

console.log('\nIconos generados en public/');