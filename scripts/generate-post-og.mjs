// Generate the post-specific OG image (public/og/idempotent-ai-workers-rails.png)
// and a preview raster of the architecture SVG for visual review.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(join(pub, 'og'), { recursive: true });

const mark = `<g fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
  <path d="M34 40 L34 88"/><path d="M34 40 C 62 40, 62 88, 34 88"/>
  <path d="M70 88 L82 40 L94 88"/><path d="M74 69 L90 69"/></g>`;

const S = 'font-family="Helvetica, Arial, sans-serif"';
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0E0F0D"/>
  <!-- faint system-design pipeline motif (not generic AI imagery) -->
  <g opacity="0.12" stroke="#6FB39A" fill="none" stroke-width="2">
    <rect x="835" y="96" width="250" height="58" rx="10"/>
    <path d="M960 154 V206" marker-end=""/>
    <rect x="835" y="206" width="250" height="58" rx="10"/>
    <path d="M960 264 V316"/>
    <rect x="820" y="316" width="280" height="62" rx="10" stroke="#8FBFAD"/>
    <path d="M960 378 V430"/>
    <rect x="835" y="430" width="250" height="58" rx="10"/>
    <path d="M1120 447 H1150 V347 H1108" stroke="#6FB39A"/>
  </g>
  <!-- DA monogram -->
  <g transform="translate(80 70) scale(0.469)"><rect width="128" height="128" rx="28" fill="#2F5E4E"/>${mark}</g>
  <text x="164" y="112" ${S} font-size="26" font-weight="700" fill="#ECECE6">Danial Asghar</text>
  <text x="164" y="140" ${S} font-size="17" font-weight="500" fill="#8FBFAD" letter-spacing="1">SENIOR BACKEND ENGINEER</text>

  <text x="80" y="238" ${S} font-size="20" font-weight="700" fill="#6FB39A" letter-spacing="2.5">BACKEND ENGINEERING · RAILS · SIDEKIQ</text>

  <text x="80" y="316" ${S} font-size="60" font-weight="700" fill="#ECECE6">Idempotent Background Workers</text>
  <text x="80" y="386" ${S} font-size="60" font-weight="700" fill="#ECECE6">for LLM Calls in Rails</text>

  <text x="80" y="452" ${S} font-size="25" font-weight="400" fill="#A6A69E">At-least-once delivery, the completion gate, and safe LLM retries.</text>

  <rect x="80" y="516" width="1040" height="1.5" fill="#262723"/>
  <text x="80" y="566" ${S} font-size="22" font-weight="500" fill="#A6A69E">Sidekiq · PostgreSQL · OpenAI Structured Outputs</text>
  <text x="1120" y="566" text-anchor="end" ${S} font-size="22" font-weight="600" fill="#6FB39A">danialasghar.com</text>
</svg>`;

writeFileSync(join(pub, 'og', 'idempotent-ai-workers-rails.png'), await sharp(Buffer.from(og)).png().toBuffer());

console.log('✓ Generated public/og/idempotent-ai-workers-rails.png');
