import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeHashState } from '../_shared/hash-state.ts';
import { readShareHash, summaryState, summaryText } from './state.ts';
import { analyzeReport } from './analyze.ts';
import { EXAMPLE_REPORT } from './example.ts';

const good = { pattern: 'same-table-row-order', procs: 2, tables: ['accounts', 'ledger_entries'], confidence: 'high' as const };

test('share link round-trips the summary exactly', () => {
	const hash = encodeHashState(summaryState(good));
	assert.ok(hash);
	assert.deepEqual(readShareHash(hash ?? ''), good);
});

test('share link never carries statements or the log', () => {
	const r = analyzeReport(EXAMPLE_REPORT);
	assert.ok(r.ok);
	if (!r.ok) return;
	const hash = encodeHashState(r.state) ?? '';
	assert.ok(hash.length > 0);
	assert.ok(!/UPDATE|balance|Process|STATEMENT|accounts_prod/i.test(decodeURIComponent(hash)), hash);
});

test('tampered or unexpected share values are ignored, never shown', () => {
	const base = { pattern: 'advisory', procs: '2', tables: 'accounts', confidence: 'high', v: '1' };
	const cases: [string, Record<string, string | undefined>][] = [
		['unknown pattern', { ...base, pattern: 'drop-table' }],
		['unknown confidence', { ...base, confidence: 'maybe' }],
		['process count not a number', { ...base, procs: 'two' }],
		['process count too small', { ...base, procs: '1' }],
		['process count too big', { ...base, procs: '9999' }],
		['table name with punctuation', { ...base, tables: 'accounts;drop' }],
		['too many tables', { ...base, tables: Array.from({ length: 11 }, (_, i) => `t${i}`).join(',') }],
		['missing confidence', { ...base, confidence: undefined }],
		['another version', { ...base, v: '2' }],
	];
	for (const [label, values] of cases) {
		const parts = Object.entries(values)
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`);
		assert.equal(readShareHash(`#${parts.join('&')}`), null, label);
	}
	assert.equal(readShareHash(''), null);
	assert.equal(readShareHash('#v=1'), null);
});

test('summary text has no NaN and names the tables or says none were named', () => {
	assert.match(summaryText(good), /Same table, rows locked in opposite order · high confidence · 2 processes · tables: accounts, ledger_entries\./);
	assert.match(summaryText({ ...good, tables: [] }), /tables: not named\./);
	assert.doesNotMatch(summaryText(good), /NaN|undefined/);
});

test('the built-in example analyses as a same-table high-confidence cycle with a CTA-free result', () => {
	const r = analyzeReport(EXAMPLE_REPORT);
	assert.ok(r.ok);
	if (!r.ok) return;
	assert.equal(r.pattern, 'same-table-row-order');
	assert.equal(r.confidence, 'high');
	assert.equal(r.tone, 'risk');
	assert.equal(r.cta, false);
});
