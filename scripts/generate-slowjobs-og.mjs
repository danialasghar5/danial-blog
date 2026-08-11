// OG image for "Why Your Rails Background Jobs Are Slow"
// (public/og/why-background-jobs-are-slow.png). Topic-first card, matching the
// cleaned Solid Queue / retry cards. Motif: the two-span timeline — a job
// waited (clay) then ran (sage).
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(join(pub, 'og'), { recursive: true });

const S = 'font-family="Helvetica, Arial, sans-serif"';

// Faint motif: a job's timeline, split into wait (clay) and run (sage) spans.
const motif = `<g opacity="0.16">
    <line x1="884" y1="300" x2="1120" y2="300" stroke="#6E6E67" stroke-width="1.8"/>
    <rect x="884" y="250" width="120" height="26" rx="5" fill="#B5675C" fill-opacity="0.55" stroke="#B5675C" stroke-width="1.6"/>
    <rect x="1004" y="250" width="116" height="26" rx="5" fill="#6FB39A" fill-opacity="0.55" stroke="#6FB39A" stroke-width="1.6"/>
    <line x1="884" y1="292" x2="884" y2="308" stroke="#6E6E67" stroke-width="1.6"/>
    <line x1="1004" y1="292" x2="1004" y2="308" stroke="#6E6E67" stroke-width="1.6"/>
    <line x1="1120" y1="292" x2="1120" y2="308" stroke="#6E6E67" stroke-width="1.6"/>
  </g>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0E0F0D"/>
  ${motif}
  <text x="80" y="170" ${S} font-size="20" font-weight="700" fill="#6FB39A" letter-spacing="2.5">BACKEND ENGINEERING · RAILS · PERFORMANCE</text>

  <text x="80" y="248" ${S} font-size="60" font-weight="700" fill="#ECECE6">Why Your Rails Jobs</text>
  <text x="80" y="318" ${S} font-size="60" font-weight="700" fill="#ECECE6">Are Slow</text>

  <text x="80" y="384" ${S} font-size="25" font-weight="400" fill="#A6A69E">Queue latency vs. execution time: measure which, then fix the right thing.</text>

  <rect x="80" y="448" width="1040" height="1.5" fill="#262723"/>
  <text x="80" y="498" ${S} font-size="22" font-weight="500" fill="#A6A69E">Sidekiq · Solid Queue · Active Job</text>
  <text x="1120" y="498" text-anchor="end" ${S} font-size="22" font-weight="600" fill="#6FB39A">danialasghar.com</text>
</svg>`;

const out = join(pub, 'og', 'why-background-jobs-are-slow.png');
writeFileSync(out, await sharp(Buffer.from(og)).png().toBuffer());
console.log('✓ Generated', out);
