// OG image for "How Solid Queue Works Under the Hood (Rails 8)"
// (public/og/how-solid-queue-works.png). Topic-first card (no personal-brand
// lockup), matching the cleaned retry card. Motif: the queue-as-a-table, with
// one row claimed.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(join(pub, 'og'), { recursive: true });

const S = 'font-family="Helvetica, Arial, sans-serif"';

// Faint motif: a database table holding the queue; one row is claimed (sage).
const motif = `<g opacity="0.14">
    <rect x="884" y="150" width="232" height="196" rx="12" fill="none" stroke="#6FB39A" stroke-width="2.4"/>
    <line x1="884" y1="190" x2="1116" y2="190" stroke="#6FB39A" stroke-width="1.8"/>
    <rect x="886" y="230" width="228" height="34" fill="#6FB39A" fill-opacity="0.5"/>
    <line x1="884" y1="230" x2="1116" y2="230" stroke="#8FBFAD" stroke-width="1.4"/>
    <line x1="884" y1="264" x2="1116" y2="264" stroke="#8FBFAD" stroke-width="1.4"/>
    <line x1="884" y1="298" x2="1116" y2="298" stroke="#8FBFAD" stroke-width="1.4"/>
    <path d="M1132 247 H1156 V209 H1120" stroke="#6FB39A" stroke-width="2.2" fill="none" marker-end="url(#sqArw)"/>
  </g>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <marker id="sqArw" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
      <path d="M0 0 L10 5 L0 10 z" fill="#6FB39A"/>
    </marker>
  </defs>
  <rect width="1200" height="630" fill="#0E0F0D"/>
  ${motif}
  <text x="80" y="170" ${S} font-size="20" font-weight="700" fill="#6FB39A" letter-spacing="2.5">BACKEND ENGINEERING · RAILS 8 · SOLID QUEUE</text>

  <text x="80" y="248" ${S} font-size="60" font-weight="700" fill="#ECECE6">How Solid Queue</text>
  <text x="80" y="318" ${S} font-size="60" font-weight="700" fill="#ECECE6">Works Under the Hood</text>

  <text x="80" y="384" ${S} font-size="25" font-weight="400" fill="#A6A69E">The database is the queue: SKIP LOCKED, execution tables, heartbeats.</text>

  <rect x="80" y="448" width="1040" height="1.5" fill="#262723"/>
  <text x="80" y="498" ${S} font-size="22" font-weight="500" fill="#A6A69E">Rails · Active Job · PostgreSQL</text>
  <text x="1120" y="498" text-anchor="end" ${S} font-size="22" font-weight="600" fill="#6FB39A">danialasghar.com</text>
</svg>`;

const out = join(pub, 'og', 'how-solid-queue-works.png');
writeFileSync(out, await sharp(Buffer.from(og)).png().toBuffer());
console.log('✓ Generated', out);
