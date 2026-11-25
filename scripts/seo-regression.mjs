#!/usr/bin/env node
// SEO regression check (TOOLS_ROADMAP.md §14.8).
//
// Snapshots the SEO-relevant parts of every page in the built sitemap and
// fails if a protected page changes. Run after `astro build`:
//
//   node scripts/seo-regression.mjs --baseline   # write .seo-baseline/baseline.json
//   node scripts/seo-regression.mjs              # compare dist/ against the baseline
//
// Per page it captures: <title>, meta description/robots, og:* and twitter:*,
// canonical, every JSON-LD block, the H1 text, the heading id list (anchors),
// and the sitemap <lastmod>. A page in the baseline that is missing or differs
// is a failure. Pages new since the baseline are reported, not failed.
// Approved changes: re-run with --baseline and commit the new snapshot together
// with a §17 decision-log entry.
//
// Exit codes: 0 clean, 1 differences found, 2 setup error.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const writeBaseline = args.includes('--baseline');
const distDir = valueOf('--dist') ?? 'dist';
const baselineFile = valueOf('--file') ?? '.seo-baseline/baseline.json';

function valueOf(flag) {
	const i = args.indexOf(flag);
	return i >= 0 ? args[i + 1] : undefined;
}

function fail(message) {
	console.error(`seo-regression: ${message}`);
	process.exit(2);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(text) {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
		if (e[0] === '#') {
			const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isNaN(code) ? m : String.fromCodePoint(code);
		}
		return ENTITIES[e.toLowerCase()] ?? m;
	});
}

function attrs(tag) {
	const out = {};
	const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
	// Skip the tag name itself.
	const body = tag.replace(/^<\s*[\w-]+/, '').replace(/\/?>$/, '');
	for (const m of body.matchAll(re)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
	return out;
}

const text = (html) => decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

// Sort object keys recursively so JSON-LD compares by content, not key order.
function canonical(value) {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
	}
	return value;
}

export function extract(html) {
	const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? '';
	const page = {
		title: text(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
		canonical: null,
		meta: {},
		jsonLd: [],
		h1: [],
		headingIds: [],
	};
	for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
		const a = attrs(tag);
		const key = a.property ?? a.name;
		if (!key || a.content === undefined) continue;
		if (key === 'description' || key === 'robots' || key.startsWith('og:') || key.startsWith('twitter:')) {
			page.meta[key] = page.meta[key] === undefined ? a.content : [].concat(page.meta[key], a.content);
		}
	}
	for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
		const a = attrs(tag);
		if ((a.rel ?? '').split(/\s+/).includes('canonical')) page.canonical = a.href ?? null;
	}
	for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
		if (attrs(`<script ${m[1]}>`).type !== 'application/ld+json') continue;
		try {
			page.jsonLd.push(canonical(JSON.parse(m[2])));
		} catch {
			page.jsonLd.push({ invalidJson: m[2].trim() });
		}
	}
	for (const m of html.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)) {
		if (m[1] === '1') page.h1.push(text(m[3]));
		const id = attrs(`<h ${m[2]}>`).id;
		if (id) page.headingIds.push(id);
	}
	page.meta = canonical(page.meta);
	return page;
}

function readSitemap() {
	if (!existsSync(distDir)) fail(`${distDir}/ not found — run \`astro build\` first.`);
	const files = readdirSync(distDir).filter((f) => /^sitemap-\d+\.xml$/.test(f)).sort();
	if (files.length === 0) fail(`no sitemap-N.xml in ${distDir}/`);
	const urls = new Map();
	for (const f of files) {
		const xml = readFileSync(join(distDir, f), 'utf8');
		for (const [, entry] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
			const loc = decode(entry.match(/<loc>([\s\S]*?)<\/loc>/)?.[1] ?? '').trim();
			const lastmod = entry.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1]?.trim() ?? null;
			if (loc) urls.set(new URL(loc).pathname, { loc, lastmod });
		}
	}
	return urls;
}

function htmlFor(pathname) {
	const file = pathname.endsWith('.html') ? join(distDir, pathname) : join(distDir, pathname, 'index.html');
	return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function snapshot() {
	const pages = {};
	for (const [pathname, { loc, lastmod }] of [...readSitemap()].sort(([a], [b]) => a.localeCompare(b))) {
		const html = htmlFor(pathname);
		pages[pathname] = html ? { loc, lastmod, ...extract(html) } : { loc, lastmod, missingHtml: true };
	}
	return pages;
}

function diff(before, after, path = '') {
	const out = [];
	if (JSON.stringify(before) === JSON.stringify(after)) return out;
	const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
	if (isObj(before) && isObj(after)) {
		for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
			out.push(...diff(before[k], after[k], path ? `${path}.${k}` : k));
		}
		return out;
	}
	out.push({ path, before, after });
	return out;
}

function main() {
	const current = snapshot();
	if (writeBaseline) {
		mkdirSync(baselineFile.replace(/\/[^/]+$/, ''), { recursive: true });
		writeFileSync(baselineFile, `${JSON.stringify(current, null, '\t')}\n`);
		console.log(`seo-regression: baseline written for ${Object.keys(current).length} URLs → ${baselineFile}`);
		return;
	}
	if (!existsSync(baselineFile)) fail(`${baselineFile} not found — run with --baseline first.`);
	const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));

	let problems = 0;
	for (const [pathname, expected] of Object.entries(baseline)) {
		const actual = current[pathname];
		if (!actual) {
			problems++;
			console.log(`✕ ${pathname} — no longer in the sitemap`);
			continue;
		}
		const changes = diff(expected, actual);
		if (changes.length === 0) continue;
		problems++;
		console.log(`✕ ${pathname}`);
		for (const c of changes) {
			console.log(`    ${c.path}\n      before: ${JSON.stringify(c.before)}\n      after:  ${JSON.stringify(c.after)}`);
		}
	}
	const added = Object.keys(current).filter((p) => !(p in baseline));
	for (const p of added) console.log(`+ ${p} (new, not protected yet)`);

	const total = Object.keys(baseline).length;
	if (problems) {
		console.log(`\nseo-regression: ${problems} of ${total} protected URLs changed.`);
		process.exit(1);
	}
	console.log(`seo-regression: all ${total} protected URLs unchanged${added.length ? `, ${added.length} new` : ''}.`);
}

main();
