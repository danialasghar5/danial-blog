import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSize, collect, parseChoice, parseNumberField } from './validate.ts';
import { HASH_STATE_MAX, decodeHashState, encodeHashState } from './hash-state.ts';
import { RECENT_KEY, RECENT_MAX, clearRecent, getRecent, pushRecent } from './recent.ts';
import { formatDuration, formatNumber, formatPercent, isValidTimeZone } from './format.ts';
import { SupersededError, WorkerTimeoutError, createWorkerClient, type WorkerLike } from './worker-client.ts';
import { jsonLd } from '../../utils/json-ld.ts';

test('parseNumberField: valid, thousands separators, optional', () => {
	assert.deepEqual(parseNumberField(' 1,000 ', { field: 'n', label: 'N' }), { ok: true, value: 1000 });
	assert.deepEqual(parseNumberField('2.5e2', { field: 'n', label: 'N' }), { ok: true, value: 250 });
	assert.deepEqual(parseNumberField('', { field: 'n', label: 'N', optional: true }), { ok: true, value: undefined });
});

test('parseNumberField: rejects bad input with field-level messages', () => {
	const r = (raw: string, rule = {}) => parseNumberField(raw, { field: 'n', label: 'Retries', ...rule });
	const msg = (x: ReturnType<typeof r>) => (x.ok ? null : x.error.message);
	assert.equal(msg(r('')), 'Retries is required.');
	assert.equal(msg(r('abc')), 'Retries must be a number.');
	assert.equal(msg(r('1e999')), 'Retries must be a finite number.');
	assert.equal(msg(r('2.5', { integer: true })), 'Retries must be a whole number.');
	assert.equal(msg(r('101', { integer: true, min: 0, max: 100 })), 'Retries must be a whole number from 0 to 100.');
	assert.equal(msg(r('0', { minExclusive: 0 })), 'Retries must be greater than 0.');
	assert.equal(msg(r('NaN')), 'Retries must be a number.');
});

test('parseChoice and collect keep every error', () => {
	assert.deepEqual(parseChoice('b', ['a', 'b'] as const, 'x', 'X'), { ok: true, value: 'b' });
	const res = collect({ a: parseNumberField('x', { field: 'a', label: 'A' }), b: parseChoice('z', ['y'] as const, 'b', 'B') });
	assert.equal(res.ok, false);
	if (!res.ok) assert.deepEqual(res.errors.map((e) => e.field), ['a', 'b']);
	const ok = collect({ a: parseNumberField('1', { field: 'a', label: 'A' }) });
	assert.deepEqual(ok, { ok: true, value: { a: 1 }, warnings: [] });
});

test('checkSize counts UTF-8 bytes', () => {
	assert.equal(checkSize('é'.repeat(3), 6, 'f', 'F').ok, true);
	assert.equal(checkSize('é'.repeat(4), 6, 'f', 'F').ok, false);
});

test('hash state round-trips, is versioned, filters keys and caps size', () => {
	const hash = encodeHashState({ retries: 25, engine: 'sidekiq', on: true, skip: undefined });
	assert.equal(hash, '#v=1&engine=sidekiq&on=true&retries=25');
	assert.deepEqual(decodeHashState(hash!), { engine: 'sidekiq', on: 'true', retries: '25' });
	assert.deepEqual(decodeHashState(hash!, ['retries']), { retries: '25' });
	assert.equal(decodeHashState('#v=2&retries=1'), null);
	assert.equal(decodeHashState(''), null);
	assert.equal(encodeHashState({ big: 'x'.repeat(HASH_STATE_MAX) }), null);
	assert.deepEqual(decodeHashState(encodeHashState({ q: 'a&b=<c>#' })!), { q: 'a&b=<c>#' });
});

function memoryStorage() {
	const m = new Map<string, string>();
	return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

test('recent: most-recent-first, deduped, capped, slugs only, survives bad storage', () => {
	const s = memoryStorage();
	for (let i = 0; i < 8; i++) pushRecent(`tool-${i}`, s);
	pushRecent('tool-3', s);
	const list = getRecent(s);
	assert.equal(list.length, RECENT_MAX);
	assert.equal(list[0], 'tool-3');
	assert.equal(new Set(list).size, list.length);
	assert.deepEqual(pushRecent('<script>', s), list);
	s.m.set(RECENT_KEY, '{not json');
	assert.deepEqual(getRecent(s), []);
	s.m.set(RECENT_KEY, JSON.stringify(['ok-slug', 42, 'Bad Slug']));
	assert.deepEqual(getRecent(s), ['ok-slug']);
	clearRecent(s);
	assert.deepEqual(getRecent(s), []);
	const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
	assert.deepEqual(getRecent(throwing), []);
	assert.deepEqual(pushRecent('a', throwing), ['a']);
	assert.deepEqual(getRecent(null), []);
});

test('format helpers never emit NaN/Infinity', () => {
	assert.equal(formatNumber(1234.567), '1,234.57');
	assert.equal(formatNumber(NaN), '—');
	assert.equal(formatPercent(0.8532), '85.3%');
	assert.equal(formatPercent(Infinity), '—');
	assert.equal(formatDuration(0.25), '250 ms');
	assert.equal(formatDuration(15), '15 s');
	assert.equal(formatDuration(75), '1m 15s');
	assert.equal(formatDuration(3600), '1h');
	assert.equal(formatDuration(1_763_395), '20d 9h 49m');
	assert.equal(formatDuration(-1), '—');
	assert.equal(isValidTimeZone('Europe/London'), true);
	assert.equal(isValidTimeZone('Mars/Base'), false);
});

test('jsonLd escapes script-breaking characters but stays valid JSON', () => {
	const data = { name: '</script><img src=x onerror=alert(1)>', amp: 'a & b', sep: `x${String.fromCharCode(0x2028)}y` };
	const out = jsonLd(data);
	assert.equal(out.includes('<'), false);
	assert.equal(out.includes('>'), false);
	assert.deepEqual(JSON.parse(out), data);
	assert.equal(jsonLd({ a: 1 }), JSON.stringify({ a: 1 }));
});

function fakeWorker(handler: (payload: number) => number | undefined, delayMs = 0): () => WorkerLike {
	return () => {
		const w: WorkerLike = {
			onmessage: null,
			postMessage(msg) {
				const { id, payload } = msg as { id: number; payload: number };
				const result = handler(payload);
				if (result === undefined) return; // simulate a hang
				setTimeout(() => w.onmessage?.({ data: { id, result } }), delayMs);
			},
			terminate() {},
		};
		return w;
	};
}

test('worker client: resolves, falls back, supersedes, times out', async () => {
	const c = createWorkerClient<number, number>({ create: fakeWorker((n) => n * 2), fallback: (n) => -n });
	assert.equal(await c.run(21), 42);

	const inline = createWorkerClient<number, number>({ create: null, fallback: (n) => n + 1 });
	assert.equal(await inline.run(1), 2);

	const slow = createWorkerClient<number, number>({ create: fakeWorker((n) => n, 20), fallback: (n) => n });
	const first = slow.run(1);
	const second = slow.run(2);
	await assert.rejects(first, SupersededError);
	assert.equal(await second, 2);

	const hung = createWorkerClient<number, number>({ create: fakeWorker(() => undefined), fallback: (n) => n, timeoutMs: 20 });
	await assert.rejects(hung.run(1), WorkerTimeoutError);
});
