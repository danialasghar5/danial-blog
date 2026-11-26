// Astro integration: finish the Content-Security-Policy in dist/_headers after
// every build (TOOLS_ROADMAP.md §11.5, DEC-18).
//
// public/_headers carries the policy with the placeholder `'__CSP_SCRIPT_HASHES__'`
// in script-src. After the build this hook hashes every executable inline
// <script> in the emitted HTML (JSON-LD data blocks are skipped — they never
// execute) and substitutes the sorted, de-duplicated `'sha256-…'` list. Running
// as a build hook means it applies whichever command runs `astro build`.
//
// The build fails if the placeholder is missing, survives substitution, or the
// resulting header line exceeds the size budget.

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLACEHOLDER = "'__CSP_SCRIPT_HASHES__'";
// Cloudflare does not document a per-header limit for _headers; keep the
// policy line well under common 8 KB proxy limits (TOOLS_ROADMAP.md A16).
const MAX_HEADER_BYTES = 6000;

export function inlineScriptHashes(html) {
	const hashes = new Set();
	for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
		const attrs = m[1];
		if (/\bsrc\s*=/i.test(attrs) || !m[2]) continue;
		const type = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
		if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
		hashes.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
	}
	return hashes;
}

async function htmlFiles(dir) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await htmlFiles(p)));
		else if (entry.name.endsWith('.html')) out.push(p);
	}
	return out;
}

export default function cspHashes() {
	return {
		name: 'csp-hashes',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const root = fileURLToPath(dir);
				const all = new Set();
				for (const file of await htmlFiles(root)) for (const h of inlineScriptHashes(await readFile(file, 'utf8'))) all.add(h);

				const headersPath = join(root, '_headers');
				const headers = await readFile(headersPath, 'utf8').catch(() => '');
				if (!headers.includes(PLACEHOLDER)) throw new Error(`csp-hashes: ${PLACEHOLDER} not found in dist/_headers`);
				const list = [...all].sort().join(' ');
				const out = headers.replaceAll(PLACEHOLDER, list);
				const longest = Math.max(...out.split('\n').map((l) => Buffer.byteLength(l)));
				if (longest > MAX_HEADER_BYTES) throw new Error(`csp-hashes: a header line is ${longest} bytes (budget ${MAX_HEADER_BYTES}); reduce inline scripts`);
				await writeFile(headersPath, out);
				logger.info(`CSP: ${all.size} inline script hash(es) written to dist/_headers`);
			},
		},
	};
}
