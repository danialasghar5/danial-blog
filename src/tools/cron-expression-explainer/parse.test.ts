import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCron } from './parse.ts';
import { natToCron } from './nat.ts';

const load = <T>(name: string): T =>
	JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as T;

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

test('valid fixtures parse to the expected sets', () => {
	type Valid = Record<string, unknown> & { input: string };
	for (const f of load<Valid[]>('parse.valid.json')) {
		const r = parseCron(f.input);
		assert.equal(r.ok, true, `${f.input} should parse`);
		if (!r.ok) continue;
		for (const [key, expected] of Object.entries(f)) {
			if (key === 'input') continue;
			const actual = key === 'macro' || key === 'timeZone' || key === 'withSeconds' ? r.cron[key as 'macro'] : r.cron[key as 'minutes'];
			assert.deepEqual(actual, expected, `${f.input}: ${key}`);
		}
	}
});

test('error fixtures report field index, column and message', () => {
	type Err = { input: string; field: number; column: number; message: string };
	for (const f of load<Err[]>('parse.errors.json')) {
		const r = parseCron(f.input);
		assert.equal(r.ok, false, `${f.input} should fail`);
		if (r.ok) continue;
		assert.deepEqual(
			{ field: r.error.field, column: r.error.column, message: r.error.message },
			{ field: f.field, column: f.column, message: f.message },
			f.input,
		);
	}
});

test('macros expand to their schedules', () => {
	const yearly = parseCron('@yearly');
	assert.ok(yearly.ok);
	if (yearly.ok) assert.deepEqual(yearly.cron.months, [1]);
	const monthly = parseCron('@monthly');
	assert.ok(monthly.ok);
	if (monthly.ok) assert.deepEqual(monthly.cron.daysOfMonth, [1]);
	const hourly = parseCron('@hourly');
	assert.ok(hourly.ok);
	if (hourly.ok) assert.deepEqual(hourly.cron.hours, ALL_HOURS);
});

test('macro with a time zone keeps the zone', () => {
	const r = parseCron('@daily Europe/London');
	assert.ok(r.ok);
	if (r.ok) assert.equal(r.cron.timeZone, 'Europe/London');
});

test('day of month and day of week stars are recorded for the OR rule', () => {
	const both = parseCron('0 0 1,15 * 5');
	const dom = parseCron('0 0 * * 5');
	const stepped = parseCron('0 0 */2 * 1');
	assert.ok(both.ok && dom.ok && stepped.ok);
	if (both.ok) assert.deepEqual([both.cron.fields.dayOfMonth.star, both.cron.fields.dayOfWeek.star], [false, false]);
	if (dom.ok) assert.equal(dom.cron.fields.dayOfMonth.star, true);
	if (stepped.ok) assert.equal(stepped.cron.fields.dayOfMonth.star, true, '*/2 counts as unrestricted (Vixie)');
});

test('step info is kept for single stepped items only', () => {
	const r = parseCron('*/15 9-17 * * 1-5');
	assert.ok(r.ok);
	if (r.ok) assert.deepEqual(r.cron.fields.minute, { star: true, step: 15 });
	const list = parseCron('0,30 * * * *');
	assert.ok(list.ok);
	if (list.ok) assert.equal(list.cron.fields.minute.step, null);
});

test('six-field form adds seconds first and shifts field numbers', () => {
	const r = parseCron('60 0 * * * *');
	assert.equal(r.ok, false);
	if (!r.ok) assert.equal(r.error.field, 1);
	const seven = parseCron('0 0 * * * * * UTC');
	assert.equal(seven.ok, false);
	if (!seven.ok) assert.match(seven.error.message, /Expected 5 fields/);
});

test('every Fugit extension is rejected with the not-evaluated message', () => {
	for (const expr of ['0 9 * * mon&fri', '0 9 * * 1%2', '0 9 * * ~', '0 9 * * MON#2', '0 0 L * *']) {
		const r = parseCron(expr);
		assert.equal(r.ok, false, expr);
		if (!r.ok) assert.match(r.error.message, /Fugit extension, not evaluated by this tool/, expr);
	}
});

test('unknown time zone and extra tokens are reported', () => {
	const r = parseCron('0 5 * * * Nowhere/City');
	assert.equal(r.ok, false);
	if (!r.ok) assert.equal(r.error.message, 'Unknown time zone "Nowhere/City"');
	const extra = parseCron('@daily UTC extra');
	assert.equal(extra.ok, false);
});

test('parse errors never throw on odd input', () => {
	for (const expr of ['   ', '@', '*', '1-', '/', ',', '0 0 * * * * * *', '\u0000 * * * *', '99999999999999999999 * * * *']) {
		assert.doesNotThrow(() => parseCron(expr), expr);
		assert.equal(parseCron(expr).ok, false, expr);
	}
});

test('natural-language fixtures convert to the exact cron text', () => {
	type Nat = { input: string; cron?: string; unsupported?: boolean; error?: string };
	for (const f of load<Nat[]>('nat.expected.json')) {
		const r = natToCron(f.input);
		if (f.cron !== undefined) {
			assert.deepEqual(r, { ok: true, cron: f.cron }, f.input);
		} else if (f.error !== undefined) {
			assert.deepEqual(r, { ok: false, message: f.error, link: 'https://github.com/floraison/fugit#fugitnat' }, f.input);
		} else {
			assert.equal(r.ok, false, f.input);
			if (!r.ok) {
				assert.equal(r.message, 'Not supported here — Fugit may still accept it');
				assert.equal(r.link, 'https://github.com/floraison/fugit#fugitnat');
			}
		}
	}
});

test('natural-language output parses as cron', () => {
	for (const f of load<{ input: string; cron?: string }[]>('nat.expected.json')) {
		if (!f.cron) continue;
		assert.equal(parseCron(f.cron).ok, true, `${f.cron} from "${f.input}"`);
	}
});
