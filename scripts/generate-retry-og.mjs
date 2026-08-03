// Generate the post-specific OG image for "Sidekiq Retry Strategy:
// Transient vs Permanent Failures" (public/og/sidekiq-retry-strategy.png).
// Same template as scripts/generate-sidekiq-twice-og.mjs; the faint right-side
// motif is a transient-retry / permanent-discard branch — on-topic, not stock.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(join(pub, 'og'), { recursive: true });

const S = 'font-family="Helvetica, Arial, sans-serif"';

// Faint motif: a decision that branches to a retry loop (transient) and a
// dashed discard/dead-set box (permanent).
const motif = `<g opacity="0.13">
    <rect x="898" y="120" width="134" height="44" rx="10" fill="none" stroke="#8FBFAD" stroke-width="2"/>
    <path d="M965 164 V194" stroke="#6FB39A" stroke-width="2.4" fill="none" marker-end="url(#rArw)"/>
    <path d="M965 198 L1012 238 L965 278 L918 238 Z" fill="none" stroke="#6FB39A" stroke-width="2.2"/>
    <path d="M918 238 H852 V142 H894" stroke="#6FB39A" stroke-width="2.4" fill="none" marker-end="url(#rArw)"/>
    <path d="M965 278 V312" stroke="#8FBFAD" stroke-width="2.2" fill="none" marker-end="url(#rArw)"/>
    <rect x="908" y="314" width="114" height="40" rx="10" fill="none" stroke="#8FBFAD" stroke-width="2" stroke-dasharray="5 4"/>
  </g>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <marker id="rArw" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
      <path d="M0 0 L10 5 L0 10 z" fill="#6FB39A"/>
    </marker>
  </defs>
  <rect width="1200" height="630" fill="#0E0F0D"/>
  ${motif}
  <text x="80" y="170" ${S} font-size="20" font-weight="700" fill="#6FB39A" letter-spacing="2.5">BACKEND ENGINEERING · SIDEKIQ · RELIABILITY</text>

  <text x="80" y="248" ${S} font-size="60" font-weight="700" fill="#ECECE6">Sidekiq Retry Strategy</text>
  <text x="80" y="318" ${S} font-size="60" font-weight="700" fill="#ECECE6">Transient vs Permanent</text>

  <text x="80" y="384" ${S} font-size="25" font-weight="400" fill="#A6A69E">What to retry, how to back off, and when to stop.</text>

  <rect x="80" y="448" width="1040" height="1.5" fill="#262723"/>
  <text x="80" y="498" ${S} font-size="22" font-weight="500" fill="#A6A69E">Sidekiq · Active Job · Dead Set</text>
  <text x="1120" y="498" text-anchor="end" ${S} font-size="22" font-weight="600" fill="#6FB39A">danialasghar.com</text>
</svg>`;

const out = join(pub, 'og', 'sidekiq-retry-strategy.png');
writeFileSync(out, await sharp(Buffer.from(og)).png().toBuffer());
console.log('✓ Generated', out);
