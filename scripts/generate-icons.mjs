// Regenerate all favicon/app-icon formats from the DA monogram.
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const mark = `
  <g fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
    <path d="M34 40 L34 88"/>
    <path d="M34 40 C 62 40, 62 88, 34 88"/>
    <path d="M70 88 L82 40 L94 88"/>
    <path d="M74 69 L90 69"/>
  </g>`;

const ACCENT = '#2F5E4E'; // editorial green (solid — no gradients)

// Rounded (browser tab / PNG fallbacks) and full-bleed (Apple, which rounds it itself)
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="${ACCENT}"/>${mark}</svg>`;
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="${ACCENT}"/>${mark}</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

// PNG-wrapped ICO (valid in all modern browsers)
function pngToIco(pngBuf, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8); entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuf]);
}

const apple = await png(fullBleed, 180);
writeFileSync(join(pub, 'apple-touch-icon.png'), apple);
writeFileSync(join(pub, 'favicon-32x32.png'), await png(rounded, 32));
writeFileSync(join(pub, 'favicon-16x16.png'), await png(rounded, 16));
writeFileSync(join(pub, 'favicon.ico'), pngToIco(await png(rounded, 32), 32));

// 1200x630 OpenGraph card (editorial, solid colors)
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0E0F0D"/>
  <g transform="translate(96 210) scale(1.4)"><rect width="128" height="128" rx="28" fill="${ACCENT}"/>${mark}</g>
  <text x="290" y="300" fill="#ECECE6" font-family="Helvetica, Arial, sans-serif" font-size="76" font-weight="700">Danial Asghar</text>
  <text x="292" y="360" fill="#A6A69E" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="500">Senior Backend Engineer &#183; Rails &#183; AWS &#183; SaaS</text>
  <rect x="96" y="470" width="1008" height="2" fill="#262723"/>
  <text x="96" y="530" fill="#6FB39A" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="600">danialasghar.com</text>
</svg>`;
writeFileSync(join(pub, 'og-default.png'), await sharp(Buffer.from(og)).png().toBuffer());

console.log('✓ Generated: favicon.ico, favicon-16/32.png, apple-touch-icon.png, og-default.png');
