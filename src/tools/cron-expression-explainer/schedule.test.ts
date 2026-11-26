import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCron, type CronSpec } from './parse.ts';
import { nextRuns, MAX_RUNS } from './schedule.ts';

// ---------------------------------------------------------------------------
// Independent brute-force reference. It steps the UTC clock one minute (or one
// second, with seconds) at a time, reads the local wall clock with its own
// Intl formatter, matches the fields, and applies the same DST rules: a time
// that never appears is skipped (gap), and a wall-clock time that appears
// twice runs only at its first appearance (overlap). Nothing here calls
// schedule.ts.
// ---------------------------------------------------------------------------

const refFormatters = new Map<string, Intl.DateTimeFormat>();
function refWall(ms: number, zone: string) {
	let f = refFormatters.get(zone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-US', {
			timeZone: zone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		refFormatters.set(zone, f);
	}
	const out: Record<string, number> = {};
	for (const p of f.formatToParts(ms)) if (p.type !== 'literal') out[p.type] = Number(p.value);
	return { y: out.year, mo: out.month, d: out.day, h: out.hour, mi: out.minute, s: out.second };
}

function reference(cron: CronSpec, start: Date, zone: string, count: number, maxSteps: number): string[] {
	const stepMs = cron.withSeconds ? 1000 : 60_000;
	const seen = new Set<string>();
	const out: string[] = [];
	let t = Math.floor(start.getTime() / stepMs) * stepMs + stepMs; // strictly after start
	for (let i = 0; i < maxSteps && out.length < count; i++, t += stepMs) {
		const w = refWall(t, zone);
		if (!cron.months.includes(w.mo)) continue;
		const dow = new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay();
		const domOk = cron.daysOfMonth.includes(w.d);
		const dowOk = cron.daysOfWeek.includes(dow);
		const dayOk = cron.fields.dayOfMonth.star || cron.fields.dayOfWeek.star ? domOk && dowOk : domOk || dowOk;
		if (!dayOk) continue;
		if (!cron.hours.includes(w.h) || !cron.minutes.includes(w.mi) || !cron.seconds.includes(w.s)) continue;
		const key = `${w.y}-${w.mo}-${w.d} ${w.h}:${w.mi}:${w.s}`;
		if (seen.has(key)) continue; // repeated wall time in an overlap: already ran
		seen.add(key);
		out.push(new Date(t).toISOString());
	}
	return out;
}

function specOf(expr: string) {
	const r = parseCron(expr);
	assert.equal(r.ok, true, `${expr} must parse`);
	if (!r.ok) throw new Error(expr);
	return r.cron;
}

const iso = (runs: Date[]) => runs.map((d) => d.toISOString());

// ---------------------------------------------------------------------------
// Oracle matrix: expressions × zones, from a fixed start.
// ---------------------------------------------------------------------------

const START = new Date('2026-11-26T10:17:30Z');

const EXPRESSIONS: string[] = [
	'* * * * *',
	'*/5 * * * *',
	'*/15 9-17 * * 1-5',
	'0 * * * *',
	'0 */3 * * *',
	'0 3 * * *',
	'0 5 * * *',
	'30 4 1,15 * 5',
	'0 0 1 * *',
	'0 0 31 * *',
	'0 0 13 * 5',
	'0 0 1,15 * 1',
	'@daily',
	'@midnight',
	'@hourly',
	'@weekly',
	'@monthly',
	'0 12 * * SUN',
	'0 9 * JAN,JUL *',
	'5 0 * 8 *',
	'0 17 * * MON-FRI',
	'0 0 * * 7',
	'10-20/5 * * * *',
	'0 2 * * 0-6/2',
	'0 22 * * 0,6',
	'59 23 * * *',
	'1 2 3 4 *',
	'0 6 * * 1-5/2',
	'*/30 * * * *',
	'45 * * * *',
	'0 0 * * SAT',
	'0 0,12 1 */2 *',
	'0 4 8-14 * *',
	'15 */4 * JAN-MAR *',
	'5,35 * * * 1,3,5',
	'*/20 0-2 * * *',
	'0 0 2 * *',
	'*/15 * * * * *',
	'0 0 9 * * 1-5',
	'30 0 12 * * *',
	'0 0 1 1 *',
	'30 1 * * *',
	'30 2 * * *',
];

const ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata'];

// Sparse expressions need fewer results to keep the reference walk short.
const COUNT_OVERRIDES: Record<string, number> = {
	'0 0 31 * *': 2,
	'0 0 13 * 5': 1,
	'0 0 1 * *': 2,
	'5 0 * 8 *': 1,
	'1 2 3 4 *': 1,
	'0 0 1 1 *': 1,
	'0 9 * JAN,JUL *': 2,
	'0 0 2 * *': 3,
	'0 0,12 1 */2 *': 3,
	'0 4 8-14 * *': 3,
	'0 0 9 * * 1-5': 1,
	'30 0 12 * * *': 1,
};

test('oracle matrix: scheduler equals the brute-force reference', () => {
	let cases = 0;
	for (const expr of EXPRESSIONS) {
		const cron = specOf(expr);
		// Sparse expressions walk far more minutes per result, so they run in two zones.
		const zones = COUNT_OVERRIDES[expr] !== undefined ? ['UTC', 'America/New_York'] : ZONES;
		for (const zone of zones) {
			cases++;
			const count = COUNT_OVERRIDES[expr] ?? 6;
			const expected = reference(cron, START, zone, count, 1_000_000);
			assert.equal(expected.length, count, `oracle incomplete for "${expr}" in ${zone}`);
			const actual = iso(nextRuns(cron, START, zone, count));
			assert.deepEqual(actual, expected, `${expr} in ${zone}`);
		}
	}
	assert.ok(EXPRESSIONS.length >= 40, `expected at least 40 expressions, have ${EXPRESSIONS.length}`);
	assert.ok(cases >= 140, `expected at least 140 expression-zone cases, ran ${cases}`);
});

test('oracle: leap day 0 0 29 2 * next runs on 2028-02-29', () => {
	const cron = specOf('0 0 29 2 *');
	assert.deepEqual(iso(nextRuns(cron, START, 'UTC', 1)), ['2028-02-29T00:00:00.000Z']);
	assert.deepEqual(reference(cron, START, 'UTC', 1, 900_000), ['2028-02-29T00:00:00.000Z']);
});

test('oracle: DOM/DOW OR case 30 4 1,15 * 5', () => {
	const cron = specOf('30 4 1,15 * 5');
	const expected = [
		'2026-11-27T04:30:00.000Z', // Friday
		'2026-12-01T04:30:00.000Z', // the 1st
		'2026-12-04T04:30:00.000Z', // Friday
		'2026-12-11T04:30:00.000Z', // Friday
		'2026-12-15T04:30:00.000Z', // the 15th
		'2026-12-18T04:30:00.000Z', // Friday
	];
	assert.deepEqual(iso(nextRuns(cron, START, 'UTC', 6)), expected);
	assert.deepEqual(reference(cron, START, 'UTC', 6, 400_000), expected);
});

// ---------------------------------------------------------------------------
// DST: explicit instants (2026 transitions).
// ---------------------------------------------------------------------------

test('US spring forward (2026-03-08): the 2:30 wall time is skipped', () => {
	const start = new Date('2026-03-06T12:00:00Z'); // 07:00 EST on 6 March
	const runs = iso(nextRuns(specOf('30 2 * * *'), start, 'America/New_York', 2));
	assert.deepEqual(runs, ['2026-03-07T07:30:00.000Z', '2026-03-09T06:30:00.000Z']);
	const ref = reference(specOf('30 2 * * *'), start, 'America/New_York', 2, 200_000);
	assert.deepEqual(ref, runs);
});

test('US fall back (2026-11-01): the repeated 1:30 runs once, at the first occurrence', () => {
	const runs = iso(nextRuns(specOf('30 1 * * *'), new Date('2026-10-31T12:00:00Z'), 'America/New_York', 2));
	assert.deepEqual(runs, ['2026-11-01T05:30:00.000Z', '2026-11-02T06:30:00.000Z']);
	assert.ok(!runs.includes('2026-11-01T06:30:00.000Z'), 'second occurrence must not run');
});

test('EU spring forward (2026-03-29): 01:30 London is skipped', () => {
	const runs = iso(nextRuns(specOf('30 1 * * *'), new Date('2026-03-27T12:00:00Z'), 'Europe/London', 2));
	assert.deepEqual(runs, ['2026-03-28T01:30:00.000Z', '2026-03-30T00:30:00.000Z']);
});

test('EU fall back (2026-10-25): 01:30 London runs once, at BST', () => {
	const runs = iso(nextRuns(specOf('30 1 * * *'), new Date('2026-10-24T12:00:00Z'), 'Europe/London', 2));
	assert.deepEqual(runs, ['2026-10-25T00:30:00.000Z', '2026-10-26T01:30:00.000Z']);
});

test('DST oracle: every-minute and 2:30 expressions across both US transitions', () => {
	const cases: [string, string, string][] = [
		['30 2 * * *', '2026-03-07T12:00:00Z', 'America/New_York'],
		['30 1 * * *', '2026-10-31T12:00:00Z', 'America/New_York'],
		['30 1 * * *', '2026-03-27T12:00:00Z', 'Europe/London'],
		['30 1 * * *', '2026-10-24T12:00:00Z', 'Europe/London'],
		['0 * * * *', '2026-11-01T03:30:00Z', 'America/New_York'],
		['*/20 1-2 * * *', '2026-11-01T03:30:00Z', 'America/New_York'],
		['*/20 1-2 * * *', '2026-03-08T04:30:00Z', 'America/New_York'],
	];
	for (const [expr, start, zone] of cases) {
		const cron = specOf(expr);
		const s = new Date(start);
		const expected = reference(cron, s, zone, 8, 400_000);
		assert.deepEqual(iso(nextRuns(cron, s, zone, 8)), expected, `${expr} from ${start} in ${zone}`);
	}
});

// ---------------------------------------------------------------------------
// Other contract points.
// ---------------------------------------------------------------------------

test('six-field seconds: runs strictly after a fractional start', () => {
	const runs = iso(nextRuns(specOf('*/15 * * * * *'), new Date('2026-11-26T10:17:10.500Z'), 'UTC', 3));
	assert.deepEqual(runs, ['2026-11-26T10:17:15.000Z', '2026-11-26T10:17:30.000Z', '2026-11-26T10:17:45.000Z']);
});

test('a time zone written in the expression overrides the selected one', () => {
	const runs = iso(nextRuns(specOf('0 5 * * * America/New_York'), new Date('2026-11-26T10:17:00Z'), 'Asia/Tokyo', 1));
	assert.deepEqual(runs, ['2026-11-27T10:00:00.000Z']);
});

test('count is clamped to 1…100', () => {
	const cron = specOf('0 * * * *');
	assert.equal(nextRuns(cron, START, 'UTC', 0).length, 1);
	assert.equal(nextRuns(cron, START, 'UTC', 500).length, MAX_RUNS);
	assert.equal(nextRuns(cron, START, 'UTC').length, 10);
});

test('results are strictly increasing and never at or before now', () => {
	const runs = nextRuns(specOf('*/7 9-17 * * 1-5'), START, 'America/New_York', 100);
	for (let i = 0; i < runs.length; i++) {
		assert.ok(runs[i] > START);
		if (i > 0) assert.ok(runs[i] > runs[i - 1]);
	}
});

test('an expression that never matches in five years returns no runs', () => {
	assert.deepEqual(nextRuns(specOf('0 0 30 2 *'), START, 'UTC', 5), []);
});
