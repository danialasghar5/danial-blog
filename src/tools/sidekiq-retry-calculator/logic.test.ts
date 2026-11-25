import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	DEFAULTS,
	HASH_KEYS,
	POLY,
	buildReport,
	buildSchedule,
	delayRange,
	parseInput,
	toHashState,
	zonedWallClockToDate,
	type Parsed,
	type RawInput,
} from './logic.ts';
import { decodeHashState, encodeHashState } from '../_shared/hash-state.ts';

const ok = (raw: RawInput): Parsed => {
	const r = parseInput(raw);
	if (!r.ok) assert.fail(`expected valid input, got ${JSON.stringify(r.errors)}`);
	return r.value;
};
const near = (actual: number, expected: number, msg = '') => assert.ok(Math.abs(actual - expected) < 1e-9, `${msg} ${actual} != ${expected}`);
const schedule = (raw: RawInput) => buildSchedule(ok(raw));

test('oracle: Sidekiq default 25 retries, no jitter (min) = 1,763,395 s (~20.41 days)', () => {
	const s = schedule({ engine: 'sidekiq', version: '8.x', retry: '25' });
	assert.equal(s.retries, 25);
	assert.equal(s.total.min, 1763395);
	assert.equal(s.rows.length, 25);
	assert.equal(s.rows[0].min, 15); // 0^4 + 15
	assert.equal(s.rows[1].min, 16); // 1^4 + 15
	assert.equal((s.total.min / 86400).toFixed(2), '20.41');
});

test('oracle: Sidekiq 7.x jitter expected 1,462.5 s, max 2,925 s', () => {
	const s = schedule({ engine: 'sidekiq', version: '7.x', retry: '25' });
	near(s.total.expected - s.total.min, 1462.5, 'expected jitter');
	near(s.total.max - s.total.min, 2925, 'max jitter');
	assert.equal(s.rows[0].max - s.rows[0].min, 9); // 9 × (0+1)
});

test('oracle: Sidekiq 8.x jitter expected 1,612.5 s, max 3,225 s', () => {
	const s = schedule({ engine: 'sidekiq', version: '8.x', retry: '25' });
	near(s.total.expected - s.total.min, 1612.5, 'expected jitter');
	near(s.total.max - s.total.min, 3225, 'max jitter');
	assert.equal(s.rows[0].max - s.rows[0].min, 9); // 10 × 1 − 1
	assert.equal(s.rows[0].expected - s.rows[0].min, 4.5);
});

test('oracle: retry 0 gives an empty schedule and an immediate Dead set', () => {
	const r = buildReport(ok({ engine: 'sidekiq', retry: '0' }));
	assert.equal(r.schedule.retries, 0);
	assert.deepEqual(r.schedule.rows, []);
	assert.equal(r.schedule.total.min, 0);
	assert.equal(r.schedule.total.max, 0);
	assert.match(r.verdict, /immediately/);
});

test('oracle: Active Job attempts 5, polynomially_longer, jitter 0.15', () => {
	const s = schedule({ engine: 'activejob', attempts: '5', wait: POLY, jitter: '0.15' });
	assert.equal(s.retries, 4);
	assert.deepEqual(
		s.rows.map((r) => r.min),
		[3, 18, 83, 258],
	);
	assert.equal(s.total.min, 362);
	near(s.total.max - s.total.min, 53.1, 'max jitter');
	near(s.total.max, 415.1, 'max total');
	near(s.total.expected, 388.55, 'expected total');
});

test('oracle: Active Job defaults (wait 3 s, attempts 5, jitter 0.15) give 12 s minimum, 13.8 s maximum', () => {
	const s = schedule({ engine: 'activejob' });
	assert.equal(DEFAULTS.attempts, 5);
	assert.equal(s.total.min, 12);
	near(s.total.max, 13.8, 'max total');
});

test('Active Job fixed wait: min W, max W + W·jitter', () => {
	const r = delayRange({ ...DEFAULTS, engine: 'activejob', wait: 10, jitter: 0.5 }, 1);
	assert.deepEqual(r, { min: 10, expected: 12.5, max: 15 });
});

test('custom sidekiq_retry_in: constant N seconds and a·count^p + b', () => {
	const constant = schedule({ engine: 'custom', version: '7.x', retry: '3', a: '0', p: '0', b: '10' });
	assert.deepEqual(
		constant.rows.map((r) => r.min),
		[10, 10, 10],
	);
	const poly = schedule({ engine: 'custom', version: '8.x', retry: '3', a: '2', p: '2', b: '5' });
	assert.deepEqual(
		poly.rows.map((r) => r.min),
		[5, 7, 13],
	); // 2·0²+5, 2·1²+5, 2·2²+5
});

test('Sidekiq jitter is added to custom delays too', () => {
	const s = schedule({ engine: 'custom', version: '7.x', retry: '1', a: '0', p: '0', b: '10' });
	assert.equal(s.rows[0].max, 19);
});

test('CTA: long dead-set window or more than 25 retries flips the tone to risk', () => {
	const long = buildReport(ok({ engine: 'sidekiq', retry: '25' }));
	assert.equal(long.cta, true);
	assert.equal(long.tone, 'risk');
	const many = buildReport(ok({ engine: 'sidekiq', retry: '26', version: '7.x' }));
	assert.equal(many.cta, true);
	const short = buildReport(ok({ engine: 'sidekiq', retry: '3' }));
	assert.equal(short.cta, false);
	assert.equal(short.tone, 'ok');
	const aj = buildReport(ok({ engine: 'activejob', attempts: '5', wait: '3', jitter: '0.15' }));
	assert.equal(aj.cta, false);
});

test('retry above 25 warns but is accepted', () => {
	const r = parseInput({ engine: 'sidekiq', retry: '30' });
	assert.ok(r.ok);
	assert.equal(r.warnings.length, 1);
});

test('invalid inputs give field-level errors, never a throw', () => {
	const cases: [RawInput, string][] = [
		[{ engine: 'sidekiq', retry: '101' }, 'retry'],
		[{ engine: 'sidekiq', retry: '-1' }, 'retry'],
		[{ engine: 'sidekiq', retry: '2.5' }, 'retry'],
		[{ engine: 'sidekiq', retry: 'abc' }, 'retry'],
		[{ engine: 'sidekiq', retry: '' }, 'retry'],
		[{ engine: 'sidekiq', version: '6.x' }, 'version'],
		[{ engine: 'nope' }, 'engine'],
		[{ engine: 'activejob', attempts: '0' }, 'attempts'],
		[{ engine: 'activejob', attempts: '101' }, 'attempts'],
		[{ engine: 'activejob', wait: '86401' }, 'wait'],
		[{ engine: 'activejob', wait: '-3' }, 'wait'],
		[{ engine: 'activejob', jitter: '1.5' }, 'jitter'],
		[{ engine: 'custom', a: '-1' }, 'a'],
		[{ engine: 'custom', p: '7' }, 'p'],
		[{ engine: 'custom', b: '-2' }, 'b'],
		[{ engine: 'sidekiq', start: 'not-a-date' }, 'start'],
		[{ engine: 'sidekiq', start: '2026-02-30T10:00' }, 'start'],
		[{ engine: 'sidekiq', start: '2026-11-26T14:05', timeZone: 'Mars/Olympus' }, 'timeZone'],
	];
	for (const [raw, field] of cases) {
		const r = parseInput(raw);
		assert.equal(r.ok, false, JSON.stringify(raw));
		if (!r.ok) assert.ok(r.errors.some((e) => e.field === field), `${JSON.stringify(raw)} → ${JSON.stringify(r.errors)}`);
	}
});

test('fields the engine does not use cannot block the result', () => {
	assert.ok(parseInput({ engine: 'activejob', retry: 'abc', attempts: '5' }).ok);
	assert.ok(parseInput({ engine: 'sidekiq', attempts: '999', wait: 'x', a: '-9' }).ok);
});

test('time zone and start: wall clock is converted in the chosen zone', () => {
	const utc = zonedWallClockToDate('2026-11-26T14:05', 'UTC');
	assert.equal(utc?.toISOString(), '2026-11-26T14:05:00.000Z');
	const ny = zonedWallClockToDate('2026-11-26T14:05', 'America/New_York'); // EST, UTC−5
	assert.equal(ny?.toISOString(), '2026-11-26T19:05:00.000Z');
	const summer = zonedWallClockToDate('2026-07-01T12:00', 'Europe/Berlin'); // CEST, UTC+2
	assert.equal(summer?.toISOString(), '2026-07-01T10:00:00.000Z');
});

test('start gives absolute ranges per retry, from start + cumulative min to start + cumulative max', () => {
	const s = schedule({ engine: 'sidekiq', version: '8.x', retry: '2', start: '2026-11-26T14:00', timeZone: 'UTC' });
	const start = Date.parse('2026-11-26T14:00:00Z');
	assert.equal(s.rows[0].from?.getTime(), start + 15 * 1000);
	assert.equal(s.rows[0].to?.getTime(), start + 24 * 1000); // max 15 + 9
	assert.equal(s.rows[1].from?.getTime(), start + 31 * 1000); // 15 + 16
	assert.equal(s.rows[1].to?.getTime(), start + 59 * 1000); // 24 + (16 + 19)
});

test('absurd schedules: absolute times beyond the Date range are left undefined, not thrown', () => {
	const s = schedule({ engine: 'custom', retry: '100', a: '1000000', p: '6', b: '0', start: '2026-11-26T14:05', timeZone: 'UTC' });
	assert.equal(s.rows[99].from, undefined);
	assert.ok(Number.isFinite(s.total.max));
});

test('no start: rows carry no absolute times', () => {
	const s = schedule({ engine: 'sidekiq', retry: '2' });
	assert.equal(s.rows[0].from, undefined);
});

test('share state round-trips through the hash', () => {
	const raw: RawInput = { engine: 'custom', version: '7.x', retry: '12', attempts: '4', wait: POLY, jitter: '0.3', a: '2', p: '3', b: '9' };
	const parsed = ok(raw);
	const hash = encodeHashState(toHashState(parsed.settings));
	assert.ok(hash);
	const decoded = decodeHashState(hash ?? '', HASH_KEYS);
	assert.ok(decoded);
	assert.deepEqual(ok(decoded ?? {}).settings, parsed.settings);
});

test('corrupt share state is rejected by validation, not by a throw', () => {
	const decoded = decodeHashState('#v=1&engine=sidekiq&retry=999999', HASH_KEYS);
	assert.ok(decoded);
	assert.equal(parseInput(decoded ?? {}).ok, false);
});

test('snippets: sidekiq_options, sidekiq_retry_in and retry_on', () => {
	const sk = buildReport(ok({ engine: 'sidekiq', retry: '7' }));
	assert.match(sk.snippet, /sidekiq_options retry: 7/);
	const custom = buildReport(ok({ engine: 'custom', retry: '7', a: '0', p: '0', b: '60' }));
	assert.match(custom.snippet, /sidekiq_retry_in do \|count, exception, jobhash\|/);
	assert.match(custom.snippet, /^ {4}60 /m);
	const aj = buildReport(ok({ engine: 'activejob', attempts: '5', wait: POLY, jitter: '0.15' }));
	assert.match(aj.snippet, /retry_on TransientError, wait: :polynomially_longer, attempts: 5, jitter: 0.15/);
	const fixed = buildReport(ok({ engine: 'activejob', attempts: '3', wait: '3', jitter: '0' }));
	assert.match(fixed.snippet, /wait: 3\.seconds, attempts: 3, jitter: 0\.0/);
});

test('no NaN, Infinity or undefined in any output, across the input space', () => {
	const engines = ['sidekiq', 'custom', 'activejob'];
	const versions = ['7.x', '8.x'];
	const values = ['0', '1', '25', '100', '0.15', '1', '86400', POLY, '6'];
	let checked = 0;
	for (const engine of engines)
		for (const version of versions)
			for (const retry of ['0', '1', '25', '100'])
				for (const wait of values)
					for (const a of ['0', '1000000'])
						for (const p of ['0', '6']) {
							const r = parseInput({ engine, version, retry, attempts: '100', wait, jitter: '1', a, p, b: '1000000', start: '2026-11-26T14:05', timeZone: 'Europe/London' });
							assert.ok(r.ok, JSON.stringify(r.ok ? '' : r.errors));
							const rep = buildReport(r.value);
							const text = [rep.verdict, rep.verdictWord, rep.snippet, rep.plainText, ...rep.notes].join('\n');
							assert.doesNotMatch(text, /NaN|Infinity|undefined|null/);
							for (const row of rep.schedule.rows) {
								for (const v of [row.min, row.expected, row.max, row.cumMin, row.cumExpected, row.cumMax]) assert.ok(Number.isFinite(v));
							}
							assert.ok(Number.isFinite(rep.schedule.total.max));
							checked++;
						}
	assert.ok(checked > 0);
});

test('Active Job attempts 1 allows no retries', () => {
	const rep = buildReport(ok({ engine: 'activejob', attempts: '1' }));
	assert.equal(rep.schedule.retries, 0);
	assert.match(rep.verdict, /re-raised at once/);
});
