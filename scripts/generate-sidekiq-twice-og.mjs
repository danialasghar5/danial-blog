// Generate the post-specific OG image for "Why Your Sidekiq Job Runs Twice".
// Mirrors scripts/generate-post-og.mjs (same dark theme, monogram, typography,
// footer). The only topic-specific change is the faint right-side motif: a
// retry loop around two offset job cards — "the job runs again, and again"
// — instead of the sibling's architecture pipeline. No generic imagery.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(join(pub, 'og'), { recursive: true });

// Shared DA monogram (identical to the sibling generator).
const mark = `<g fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
  <path d="M34 40 L34 88"/><path d="M34 40 C 62 40, 62 88, 34 88"/>
  <path d="M70 88 L82 40 L94 88"/><path d="M74 69 L90 69"/></g>`;

const S = 'font-family="Helvetica, Arial, sans-serif"';

// Faint retry-loop motif: two offset "job" cards (the duplicate) inside a
// near-full circular arrow (the retry). Topic-specific, editorial, not stock.
const motif = `<g opacity="0.13">
    <!-- circular retry arrow (clockwise, gap at top for the arrowhead) -->
    <path d="M1012 205 A 118 118 0 1 1 918 205" fill="none" stroke="#6FB39A" stroke-width="2.6" marker-end="url(#ogArw)"/>
    <!-- back job card (the duplicate) -->
    <rect x="928" y="250" width="118" height="66" rx="12" fill="none" stroke="#8FBFAD" stroke-width="2"/>
    <!-- front job card -->
    <rect x="908" y="272" width="118" height="66" rx="12" fill="#0E0F0D" stroke="#6FB39A" stroke-width="2.2"/>
    <path d="M926 298 H1008" stroke="#6FB39A" stroke-width="2"/>
    <path d="M926 316 H986" stroke="#8FBFAD" stroke-width="2"/>
  </g>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <marker id="ogArw" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
      <path d="M0 0 L10 5 L0 10 z" fill="#6FB39A"/>
    </marker>
  </defs>
  <rect width="1200" height="630" fill="#0E0F0D"/>
  ${motif}
  <!-- DA monogram -->
  <g transform="translate(80 70) scale(0.469)"><rect width="128" height="128" rx="28" fill="#2F5E4E"/>${mark}</g>
  <text x="164" y="112" ${S} font-size="26" font-weight="700" fill="#ECECE6">Danial Asghar</text>
  <text x="164" y="140" ${S} font-size="17" font-weight="500" fill="#8FBFAD" letter-spacing="1">SENIOR BACKEND ENGINEER</text>

  <text x="80" y="238" ${S} font-size="20" font-weight="700" fill="#6FB39A" letter-spacing="2.5">BACKEND ENGINEERING · SIDEKIQ · RELIABILITY</text>

  <text x="80" y="316" ${S} font-size="60" font-weight="700" fill="#ECECE6">Why Your Sidekiq</text>
  <text x="80" y="386" ${S} font-size="60" font-weight="700" fill="#ECECE6">Job Runs Twice</text>

  <text x="80" y="452" ${S} font-size="25" font-weight="400" fill="#A6A69E">At-least-once delivery, the retry windows, and the real fix.</text>

  <rect x="80" y="516" width="1040" height="1.5" fill="#262723"/>
  <text x="80" y="566" ${S} font-size="22" font-weight="500" fill="#A6A69E">Sidekiq · Redis · At-Least-Once Delivery</text>
  <text x="1120" y="566" text-anchor="end" ${S} font-size="22" font-weight="600" fill="#6FB39A">danialasghar.com</text>
</svg>`;

const out = join(pub, 'og', 'sidekiq-job-runs-twice-at-least-once-delivery.png');
writeFileSync(out, await sharp(Buffer.from(og)).png().toBuffer());
console.log('✓ Generated', out);
