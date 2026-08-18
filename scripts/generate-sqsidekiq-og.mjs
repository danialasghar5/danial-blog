// OG image for "Solid Queue vs Sidekiq: How to Actually Decide (Rails 8)"
// (public/og/solid-queue-vs-sidekiq.png). Topic-first card, matching the
// cluster cards. Motif: the two backends as opposing chips — Sidekiq/Redis
// (clay, push) vs Solid Queue/database (sage, poll).
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(join(pub, 'og'), { recursive: true });

const S = 'font-family="Helvetica, Arial, sans-serif"';

// Faint motif: two backends as opposing chips — push (clay) vs poll (sage).
const motif = `<g opacity="0.16">
    <rect x="884" y="212" width="232" height="46" rx="9" fill="#B5675C" fill-opacity="0.5" stroke="#B5675C" stroke-width="1.8"/>
    <rect x="884" y="286" width="232" height="46" rx="9" fill="#6FB39A" fill-opacity="0.5" stroke="#6FB39A" stroke-width="1.8"/>
    <text x="1000" y="240" text-anchor="middle" font-family="monospace" font-size="19" fill="#B5675C">push · Redis</text>
    <text x="1000" y="314" text-anchor="middle" font-family="monospace" font-size="19" fill="#6FB39A">poll · database</text>
  </g>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0E0F0D"/>
  ${motif}
  <text x="80" y="170" ${S} font-size="20" font-weight="700" fill="#6FB39A" letter-spacing="2.5">BACKEND ENGINEERING · RAILS 8 · ACTIVE JOB</text>

  <text x="80" y="248" ${S} font-size="60" font-weight="700" fill="#ECECE6">Solid Queue vs Sidekiq</text>
  <text x="80" y="318" ${S} font-size="60" font-weight="700" fill="#ECECE6">How to Actually Decide</text>

  <text x="80" y="384" ${S} font-size="25" font-weight="400" fill="#A6A69E">Not a throughput number: where complexity lives, and if your DB can absorb it.</text>

  <rect x="80" y="448" width="1040" height="1.5" fill="#262723"/>
  <text x="80" y="498" ${S} font-size="22" font-weight="500" fill="#A6A69E">Sidekiq · Solid Queue · PostgreSQL</text>
  <text x="1120" y="498" text-anchor="end" ${S} font-size="22" font-weight="600" fill="#6FB39A">danialasghar.com</text>
</svg>`;

const out = join(pub, 'og', 'solid-queue-vs-sidekiq.png');
writeFileSync(out, await sharp(Buffer.from(og)).png().toBuffer());
console.log('✓ Generated', out);
