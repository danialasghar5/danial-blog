#!/usr/bin/env node
// Site-wide security check (TOOLS_ROADMAP.md §11.10). No dependencies.
//
//   node scripts/security-check.mjs                     # build mode: inspect dist/ and src/
//   node scripts/security-check.mjs --live https://danialasghar.com
//
// Build mode
//   1. dist/_headers carries every required header on /* (§11.4); CSP script-src
//      has no 'unsafe-inline' / 'unsafe-eval'.
//   2. Every executable inline <script> in dist/**/*.html is hashed in the CSP.
//   3. dist/ holds no source maps, dotfiles, node_modules, draft pages or secrets.
//   4. src/ uses no banned APIs; set:html / innerHTML only per the allowlist (§11.6).
//   5. External <script src> origins are allowed and carry integrity (SRI).
//   6. npm audit --audit-level=high passes (skip with --no-audit).
// Live mode
//   Required headers on sample routes, http→https redirect, sensitive paths
//   blocked, DNSSEC (DS) and CAA records (warnings until done).
//
// Exit codes: 0 pass, 1 failures, 2 setup error. Warnings never fail.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const DIST = valueOf('--dist') ?? 'dist';
const SRC = 'src';
const LIVE = valueOf('--live');

// --- Policy (keep in sync with TOOLS_ROADMAP.md §11.4–§11.6) -----------------

const REQUIRED_HEADERS = {
	'strict-transport-security': (v) => /max-age=\d+/.test(v) || 'needs max-age',
	'content-security-policy': () => true, // detailed checks below
	'x-content-type-options': (v) => v.toLowerCase() === 'nosniff' || 'must be nosniff',
	'x-frame-options': (v) => v.toUpperCase() === 'DENY' || 'must be DENY',
	'referrer-policy': (v) => v === 'strict-origin-when-cross-origin' || 'must be strict-origin-when-cross-origin',
	'cross-origin-opener-policy': (v) => v === 'same-origin' || 'must be same-origin',
	'permissions-policy': (v) =>
		['camera=()', 'microphone=()', 'geolocation=()'].every((p) => v.includes(p)) || 'must disable camera, microphone, geolocation',
};

// File → maximum number of allowed uses. A new use anywhere fails the check.
const SET_HTML_ALLOWLIST = {
	'src/components/BaseHead.astro': 1, // JSON-LD
	'src/components/Breadcrumbs.astro': 1, // JSON-LD
	'src/layouts/BlogPost.astro': 1, // JSON-LD
	'src/layouts/CaseStudy.astro': 1, // JSON-LD
	'src/pages/services.astro': 1, // JSON-LD
	'src/pages/tools/connection-pool-calculator.astro': 1, // JSON-LD
	'src/pages/topics/index.astro': 1, // JSON-LD
	'src/pages/topics/[slug].astro': 2, // JSON-LD + author intro HTML (src/data/topics.ts)
	'src/components/diagram/figures/DiagnosticDecisionTree.astro': 1, // author SVG
	'src/components/diagram/figures/LatencyExecutionTimeline.astro': 1, // author SVG
	'src/components/diagram/figures/SolidQueueSidekiqMatrix.astro': 1, // author SVG
	'src/components/diagram/figures/PushVsPollComparison.astro': 1, // author SVG
	'src/layouts/ToolLayout.astro': 1, // JSON-LD via jsonLd() (escaped)
};
const INNER_HTML_ALLOWLIST = {
	'src/pages/tools/connection-pool-calculator.astro': 1, // constant string; migrate in Wave 2 (#10)
};
const BANNED = [
	[/\beval\s*\(/, 'eval()'],
	[/\bnew\s+Function\s*\(/, 'new Function()'],
	[/\bset(?:Timeout|Interval)\s*\(\s*['"`]/, 'setTimeout/setInterval with a string'],
	[/\.outerHTML\s*=/, 'outerHTML assignment'],
	[/\binsertAdjacentHTML\s*\(/, 'insertAdjacentHTML()'],
	[/\bdocument\.write(?:ln)?\s*\(/, 'document.write()'],
];
const SCRIPT_ORIGINS = ['https://static.cloudflareinsights.com'];
const SRI_EXCEPTIONS = []; // origins exempt from SRI, each backed by a §17 decision (D11)
const SECRET_PATTERNS = [
	[/-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/, 'private key'],
	[/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
	[/\bgh[pousr]_[A-Za-z0-9]{36}\b/, 'GitHub token'],
	[/\bgithub_pat_[A-Za-z0-9_]{60,}\b/, 'GitHub fine-grained token'],
	[/\bsk_live_[A-Za-z0-9]{20,}\b/, 'Stripe live secret key'],
	[/\bxox[abposr]-[A-Za-z0-9-]{10,}\b/, 'Slack token'],
];

// --- Reporting ----------------------------------------------------------------

let failures = 0;
let warnings = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => {
	failures++;
	console.log(`  ✕ ${msg}`);
};
const warn = (msg) => {
	warnings++;
	console.log(`  ! ${msg}`);
};
const section = (title) => console.log(`\n${title}`);

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		out.push(p);
		if (statSync(p).isDirectory()) out.push(...walk(p));
	}
	return out;
}
const rel = (p) => relative('.', p).split(sep).join('/');

// --- Headers ------------------------------------------------------------------

// Cloudflare _headers format: a path line, then indented "Name: value" lines.
export function parseHeadersFile(text) {
	const rules = new Map();
	let current = null;
	for (const raw of text.split('\n')) {
		const line = raw.replace(/\s+#.*$/, '').replace(/^#.*$/, '');
		if (!line.trim()) continue;
		if (!/^\s/.test(line)) {
			current = line.trim();
			if (!rules.has(current)) rules.set(current, {});
			continue;
		}
		const m = line.trim().match(/^([^:]+):\s*(.*)$/);
		if (m && current) rules.get(current)[m[1].trim().toLowerCase()] = m[2].trim();
	}
	return rules;
}

export function cspDirectives(csp) {
	const out = {};
	for (const part of csp.split(';')) {
		const [name, ...values] = part.trim().split(/\s+/);
		if (name) out[name.toLowerCase()] = values;
	}
	return out;
}

function checkHeaderSet(headers, where) {
	for (const [name, test] of Object.entries(REQUIRED_HEADERS)) {
		const value = headers[name];
		if (value === undefined) {
			if (name === 'content-security-policy' && headers['content-security-policy-report-only'] !== undefined) {
				warn(`${where}: CSP is Report-Only (switch to enforcing, §11.5)`);
			} else bad(`${where}: missing ${name}`);
			continue;
		}
		const result = test(value);
		if (result === true) ok(`${where}: ${name}`);
		else bad(`${where}: ${name} ${result} (got "${value}")`);
	}
	const csp = headers['content-security-policy'] ?? headers['content-security-policy-report-only'];
	if (!csp) return null;
	const d = cspDirectives(csp);
	const scriptSrc = d['script-src'] ?? d['default-src'] ?? [];
	for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'"]) {
		if (scriptSrc.includes(unsafe)) bad(`${where}: CSP script-src contains ${unsafe}`);
	}
	if (!(d['frame-ancestors'] ?? []).includes("'none'")) bad(`${where}: CSP frame-ancestors must be 'none'`);
	if (!d['object-src'] && !(d['default-src'] ?? []).includes("'none'")) warn(`${where}: CSP has no object-src`);
	return scriptSrc;
}

// --- Build mode ---------------------------------------------------------------

export function inlineScripts(html) {
	const found = [];
	for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
		const attrs = m[1];
		if (/\bsrc\s*=/.test(attrs)) continue;
		const type = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
		const executable = !type || type === 'module' || type === 'text/javascript' || type === 'application/javascript';
		if (executable && m[2].length > 0) found.push(m[2]);
	}
	return found;
}
const sha256 = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

function buildMode() {
	if (!existsSync(DIST)) {
		console.error(`security-check: ${DIST}/ not found — run \`astro build\` first.`);
		process.exit(2);
	}
	const files = walk(DIST);
	const htmlFiles = files.filter((f) => f.endsWith('.html'));

	section('1. Security headers (dist/_headers, rule /*)');
	let scriptSrc = null;
	const headersPath = join(DIST, '_headers');
	if (!existsSync(headersPath)) bad('dist/_headers not found');
	else {
		const all = parseHeadersFile(readFileSync(headersPath, 'utf8')).get('/*');
		if (!all) bad('no /* rule in _headers (headers must cover every route)');
		else scriptSrc = checkHeaderSet(all, '/*');
	}

	section('2. Inline scripts covered by CSP hashes');
	const hashes = new Map();
	for (const f of htmlFiles) {
		for (const s of inlineScripts(readFileSync(f, 'utf8'))) {
			const h = sha256(s);
			if (!hashes.has(h)) hashes.set(h, rel(f));
		}
	}
	if (!scriptSrc) bad(`cannot check ${hashes.size} unique inline script(s): no CSP`);
	else {
		const missing = [...hashes].filter(([h]) => !scriptSrc.includes(h));
		if (missing.length === 0) ok(`all ${hashes.size} unique inline scripts hashed`);
		for (const [h, file] of missing) bad(`inline script not in CSP: ${h} (first seen in ${file})`);
	}

	section('3. Nothing sensitive in dist/');
	let exposed = 0;
	for (const f of files) {
		const r = relative(DIST, f).split(sep);
		const base = r[r.length - 1];
		const hidden = r.some((part) => part.startsWith('.') && part !== '.well-known');
		if (hidden || r.includes('node_modules') || base.endsWith('.map')) {
			bad(`exposed: ${rel(f)}`);
			exposed++;
		}
	}
	const textFiles = files.filter((f) => /\.(html|js|mjs|css|json|xml|txt|webmanifest|svg)$/.test(f) || f.endsWith('_headers'));
	for (const f of textFiles) {
		const body = readFileSync(f, 'utf8');
		for (const [re, label] of SECRET_PATTERNS) {
			if (re.test(body)) {
				bad(`possible ${label} in ${rel(f)}`);
				exposed++;
			}
		}
	}
	for (const [dir, route, isDraft] of [
		['src/content/blog', 'blog', (fm) => /^draft:\s*true\b/m.test(fm)],
		['src/content/tools', 'tools', (fm) => /^status:\s*['"]?draft\b/m.test(fm) || !/^status:\s*['"]?live\b/m.test(fm)],
	]) {
		if (!existsSync(dir)) continue;
		for (const name of readdirSync(dir).filter((n) => /\.mdx?$/.test(n))) {
			const fm = readFileSync(join(dir, name), 'utf8').split('---')[1] ?? '';
			const slug = name.replace(/\.mdx?$/, '');
			if (isDraft(fm) && existsSync(join(DIST, route, slug, 'index.html'))) {
				bad(`draft published: /${route}/${slug}/`);
				exposed++;
			}
		}
	}
	if (exposed === 0) ok(`${files.length} files: no source maps, dotfiles, drafts or secrets`);

	section('4. Banned APIs and set:html / innerHTML allowlist (src/)');
	const counts = { set: {}, inner: {} };
	let banned = 0;
	for (const f of walk(SRC).filter((p) => /\.(astro|ts|js|mjs|mdx|tsx|jsx)$/.test(p))) {
		const r = rel(f);
		const lines = readFileSync(f, 'utf8').split('\n');
		lines.forEach((line, i) => {
			const code = line.replace(/\/\/.*$/, '');
			for (const [re, label] of BANNED) {
				if (re.test(code)) {
					bad(`${r}:${i + 1} uses ${label}`);
					banned++;
				}
			}
			counts.set[r] = (counts.set[r] ?? 0) + (code.match(/\bset:html\s*=/g)?.length ?? 0);
			counts.inner[r] = (counts.inner[r] ?? 0) + (code.match(/\.innerHTML\s*=/g)?.length ?? 0);
		});
	}
	for (const [kind, allow, label] of [
		['set', SET_HTML_ALLOWLIST, 'set:html'],
		['inner', INNER_HTML_ALLOWLIST, 'innerHTML'],
	]) {
		for (const [file, n] of Object.entries(counts[kind])) {
			if (n > (allow[file] ?? 0)) {
				bad(`${file}: ${n} ${label} use(s), allowlist permits ${allow[file] ?? 0} (§11.6)`);
				banned++;
			}
		}
	}
	if (banned === 0) ok('no banned APIs; set:html and innerHTML within the allowlist');

	section('5. External scripts');
	let externals = 0;
	for (const f of htmlFiles) {
		for (const m of readFileSync(f, 'utf8').matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
			if (!/^https?:\/\//i.test(m[1])) continue;
			externals++;
			const origin = new URL(m[1]).origin;
			if (!SCRIPT_ORIGINS.includes(origin)) bad(`${rel(f)}: script from unapproved origin ${origin}`);
			else if (!/\bintegrity\s*=/.test(m[0]) && !SRI_EXCEPTIONS.includes(origin)) bad(`${rel(f)}: ${origin} script without integrity (SRI)`);
		}
	}
	if (externals === 0) ok('no external scripts');

	section('6. npm audit (high and critical)');
	if (flag('--no-audit')) warn('skipped (--no-audit)');
	else {
		try {
			execFileSync('npm', ['audit', '--audit-level=high'], { stdio: 'pipe' });
			ok('npm audit --audit-level=high: clean');
		} catch (e) {
			bad(`npm audit --audit-level=high failed:\n${String(e.stdout).trim().split('\n').slice(-3).join('\n')}`);
		}
	}
}

// --- Live mode ----------------------------------------------------------------

async function liveMode(base) {
	const site = new URL(base);
	const routes = ['/', '/blog/', '/blog/rails-deadlock-activerecord/', '/topics/background-jobs/', '/tools/', '/tools/connection-pool-calculator/', '/no-such-page-security-check/'];

	section(`1. Security headers on ${site.origin}`);
	let assetPath = null;
	for (const route of routes) {
		const res = await fetch(new URL(route, site), { redirect: 'manual' });
		const headers = Object.fromEntries([...res.headers].map(([k, v]) => [k.toLowerCase(), v]));
		checkHeaderSet(headers, `${route} (${res.status})`);
		if (route === '/' && res.ok) assetPath = (await res.text()).match(/\/_astro\/[^"']+\.js/)?.[0] ?? null;
	}

	section('2. HTTPS redirect');
	const http = await fetch(`http://${site.host}/`, { redirect: 'manual' }).catch(() => null);
	const loc = http?.headers.get('location') ?? '';
	if (http && [301, 308].includes(http.status) && loc.startsWith(`https://${site.host}`)) ok(`http:// → ${loc} (${http.status})`);
	else bad(`http:// did not permanently redirect to https (status ${http?.status ?? 'error'}, location "${loc}")`);

	section('3. Sensitive paths blocked');
	const probes = ['/.git/HEAD', '/.git/config', '/.env', '/package.json', '/package-lock.json', '/astro.config.mjs', '/src/consts.ts', '/wrangler.toml'];
	if (assetPath) probes.push(`${assetPath}.map`);
	for (const p of probes) {
		const res = await fetch(new URL(p, site), { redirect: 'manual' });
		if (res.status === 200) bad(`${p} is publicly readable (200)`);
		else ok(`${p} → ${res.status}`);
	}

	section('4. DNS');
	const dig = (type) => {
		try {
			return execFileSync('dig', ['+short', type, site.hostname], { encoding: 'utf8' }).trim();
		} catch {
			return null;
		}
	};
	const ds = dig('DS');
	if (ds === null) warn('dig not available; DNS checks skipped');
	else {
		ds ? ok('DNSSEC: DS record published') : warn('DNSSEC: no DS record (owner action I-2)');
		dig('CAA') ? ok('CAA records present') : warn('no CAA records (owner action I-8)');
	}
}

// --- Main -----------------------------------------------------------------------

if (LIVE) await liveMode(LIVE);
else buildMode();
console.log(`\nsecurity-check: ${failures} failure(s), ${warnings} warning(s).`);
process.exit(failures ? 1 : 0);
