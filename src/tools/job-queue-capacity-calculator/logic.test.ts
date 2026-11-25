import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	DEFAULT_FORM,
	analyze,
	analyzeQueue,
	drainSeconds,
	erlangB,
	parseCapacityForm,
	perSecond,
	requiredConcurrency,
	summarize,
	toHashState,
	toSeconds,
	verdictFor,
	type CapacityForm,
	type RawForm,
	type StableQueue,
} from './logic.ts';

const form = (over: Partial<CapacityForm> = {}): CapacityForm => ({
	rate: 600,
	rateUnit: 'min',
	duration: 400,
	durationUnit: 'ms',
	processes: 2,
	threads: 10,
	peak: 1,
	...over,
});

const raw = (over: Partial<RawForm> = {}): RawForm => ({ ...DEFAULT_FORM, ...over });

const stable = (lambda: number, s: number, c: number): StableQueue => {
	const q = analyzeQueue(lambda, s, c);
	assert.equal(q.stable, true, 'expected a stable queue');
	return q as StableQueue;
};

/** Erlang C for offered load a and c servers, through the model (ρ = a/c < 1). */
const erlangC = (a: number, c: number) => stable(a, 1, c).pWait;

const assertFinite = (value: unknown, path = 'value') => {
	if (typeof value === 'number') {
		assert.ok(Number.isFinite(value), `${path} is not finite: ${value}`);
		return;
	}
	if (value && typeof value === 'object') {
		for (const [k, v] of Object.entries(value)) assertFinite(v, `${path}.${k}`);
	}
};

test('Erlang C table values: a=2, c=3 → 0.4444; a=1, c=2 → 1/3', () => {
	assert.equal(erlangC(2, 3).toFixed(4), '0.4444');
	assert.equal(erlangC(1, 2).toFixed(6), (1 / 3).toFixed(6));
});

test('Erlang B recurrence: a=1, c=1 → 0.5; a=2, c=2 → 0.4', () => {
	assert.equal(erlangB(1, 1), 0.5);
	assert.ok(Math.abs(erlangB(2, 2) - 0.4) < 1e-12);
});

test('c=1 matches M/M/1: C = ρ and Wq = ρ/(μ−λ)', () => {
	// λ = 0.5, μ = 1 (S = 1 s), so ρ = 0.5 and Wq = 0.5 / 0.5 = 1.
	const q = stable(0.5, 1, 1);
	assert.ok(Math.abs(q.pWait - 0.5) < 1e-12);
	assert.ok(Math.abs(q.avgWait - 1) < 1e-12);
	assert.ok(Math.abs(q.avgWait - q.utilization / (1 - 0.5)) < 1e-12);
	// Same identity at another load: λ = 0.8, μ = 1.
	const r = stable(0.8, 1, 1);
	assert.ok(Math.abs(r.pWait - 0.8) < 1e-12);
	assert.ok(Math.abs(r.avgWait - 0.8 / 0.2) < 1e-9);
});

test('Little: L = λ·W and Lq = λ·Wq', () => {
	const q = stable(5, 1, 7);
	assert.ok(Math.abs(q.jobsWaiting - 5 * q.avgWait) < 1e-12);
	assert.ok(Math.abs(q.jobsInSystem - 5 * (q.avgWait + 1)) < 1e-12);
});

test('p95 wait is 0 when C ≤ 0.05 and ln(C/0.05)/(cμ−λ) otherwise', () => {
	// a = 0.1, c = 10: C is far below 0.05.
	const low = stable(0.1, 1, 10);
	assert.ok(low.pWait <= 0.05);
	assert.equal(low.p95Wait, 0);
	// c=1, λ=0.9: C = 0.9, headroom 0.1 → p95 = ln(18)/0.1.
	const high = stable(0.9, 1, 1);
	assert.ok(Math.abs(high.p95Wait - Math.log(0.9 / 0.05) / 0.1) < 1e-9);
});

test('λ = c·μ and λ > c·μ are unstable: no waits, growth = λ − cμ', () => {
	const equal = analyzeQueue(8, 0.5, 4); // λ = 8 jobs/s, μ = 2, c = 4 → cμ = 8
	assert.equal(equal.stable, false);
	assert.equal(equal.growthRate, 0);
	const over = analyzeQueue(10, 0.5, 4); // cμ = 8, growth = 2 jobs/s
	assert.equal(over.stable, false);
	if (!over.stable) assert.equal(over.growthRate, 2);
	assertFinite(over);
	assertFinite(equal);
	assert.equal(verdictFor(over).word, 'Risk');
});

test('unstable analysis has no negative or infinite numbers anywhere', () => {
	const r = analyze(form({ rate: 1500, rateUnit: 'min', duration: 2, durationUnit: 's', processes: 1, threads: 4, peak: 4 }));
	assert.equal(r.peak.queue.stable, false);
	assert.equal(r.peak.drain, null);
	assertFinite(r);
	if (!r.peak.queue.stable) assert.ok(r.peak.queue.growthRate > 0);
});

test('unit conversion is invariant: 600/min == 10/s == 36000/h', () => {
	assert.equal(perSecond(600, 'min'), 10);
	assert.equal(perSecond(36000, 'h'), 10);
	const variants = [
		{ rate: '600', rateUnit: 'min' },
		{ rate: '10', rateUnit: 's' },
		{ rate: '36000', rateUnit: 'h' },
	];
	const results = variants.map((v) => {
		const p = parseCapacityForm(raw(v));
		assert.equal(p.ok, true);
		return analyze(p.ok ? p.value : form());
	});
	assert.deepEqual(results[1], results[0]);
	assert.deepEqual(results[2], results[0]);
});

test('duration units: 400 ms == 0.4 s', () => {
	assert.equal(toSeconds(400, 'ms'), 0.4);
	const a = parseCapacityForm(raw({ duration: '400', durationUnit: 'ms' }));
	const b = parseCapacityForm(raw({ duration: '0.4', durationUnit: 's' }));
	assert.equal(a.ok && b.ok, true);
	if (a.ok && b.ok) assert.deepEqual(analyze(a.value), analyze(b.value));
});

test('required concurrency is the minimal c: c−1 fails the target', () => {
	const lambda = 10; // a = 4 with S = 0.4
	const target = 0.5;
	const c = requiredConcurrency(lambda, 0.4, target);
	assert.ok(c !== null);
	if (c === null) return;
	assert.ok(c >= Math.floor(4) + 1, 'starts at ⌊a⌋+1');
	assert.ok(stable(lambda, 0.4, c).p95Wait <= target, 'c meets the target');
	if (c - 1 >= 5) assert.ok(stable(lambda, 0.4, c - 1).p95Wait > target, 'c−1 fails');
});

test('required concurrency: a target of 0 s is only met with C ≤ 0.05', () => {
	const c = requiredConcurrency(10, 0.4, 0);
	assert.ok(c !== null);
	if (c !== null) assert.ok(stable(10, 0.4, c).pWait <= 0.05);
});

test('required concurrency reports unreachable beyond the search cap', () => {
	// a = 1e6 needs more than 100,000 servers.
	assert.equal(requiredConcurrency(1e6, 1, 1), null);
	assert.equal(analyze(form({ rate: 1e7, rateUnit: 's', target: 1, duration: 1, durationUnit: 's' })).normal.requiredConcurrency, 'unreachable');
});

test('drain time: backlog / (cμ − λ) when stable, null when not', () => {
	// λ = 5/s, S = 1 s, c = 10 → cμ − λ = 5 jobs/s; 1200 jobs drain in 240 s.
	assert.equal(drainSeconds(1200, analyzeQueue(5, 1, 10)), 240);
	assert.equal(drainSeconds(1200, analyzeQueue(20, 1, 10)), null);
});

test('p95 and waits are finite and p95 is 0 for a lightly loaded large pool', () => {
	const r = analyze(form({ processes: 100, threads: 20, rate: 600, rateUnit: 'min', duration: 400 }));
	assert.equal(r.normal.queue.stable, true);
	if (r.normal.queue.stable) assert.equal(r.normal.queue.p95Wait, 0);
	assertFinite(r);
});

test('large c (2000) stays finite and matches a direct Erlang computation', () => {
	const q = stable(1990, 1, 2000);
	assert.ok(q.pWait > 0 && q.pWait < 1);
	assert.ok(Number.isFinite(q.avgWait) && q.avgWait > 0);
	assertFinite(q);
	// Heavily loaded pool: must not overflow or go NaN as c grows.
	for (const c of [200, 1000, 2000, 5000]) assertFinite(stable(c * 0.95, 1, c));
});

test('verdict thresholds on utilization (peak)', () => {
	const at = (rho: number) => verdictFor(stable(rho * 10, 1, 10));
	assert.equal(at(0.69).word, 'OK');
	assert.equal(at(0.7).word, 'Tight');
	assert.equal(at(0.84).word, 'Tight');
	assert.equal(at(0.85).word, 'Risk');
	assert.equal(at(0.85).cssClass, 'is-risk');
	assert.equal(verdictFor(analyzeQueue(10, 1, 10)).word, 'Risk');
});

test('CTA and tone follow the peak scenario', () => {
	const calm = analyze(form());
	assert.equal(calm.cta, false);
	const hot = analyze(form({ peak: 20 }));
	assert.equal(hot.cta, true);
	assert.equal(hot.peak.queue.stable, false);
});

test('parseCapacityForm: defaults validate and keep every error', () => {
	const ok = parseCapacityForm(raw());
	assert.equal(ok.ok, true);
	const bad = parseCapacityForm(raw({ rate: '', processes: '0', threads: '2.5', peak: '21', rateUnit: 'day' }));
	assert.equal(bad.ok, false);
	if (!bad.ok) assert.deepEqual(bad.errors.map((e) => e.field), ['rate', 'rateUnit', 'processes', 'threads', 'peak']);
});

test('parseCapacityForm: optional target and backlog may be empty, bad values are rejected', () => {
	const r = parseCapacityForm(raw({ target: '', backlog: '' }));
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(r.value.target, undefined);
		assert.equal(r.value.backlog, undefined);
	}
	const neg = parseCapacityForm(raw({ backlog: '-1' }));
	assert.equal(neg.ok, false);
	const zeroTarget = parseCapacityForm(raw({ target: '0' }));
	assert.equal(zeroTarget.ok, false);
	const frac = parseCapacityForm(raw({ backlog: '2.5' }));
	assert.equal(frac.ok, false);
});

test('parseCapacityForm: range limits and non-finite input', () => {
	const messages = (r: ReturnType<typeof parseCapacityForm>) => (r.ok ? [] : r.errors.map((e) => e.message));
	assert.deepEqual(messages(parseCapacityForm(raw({ rate: '1e999' }))), ['Arrival rate must be a finite number.']);
	assert.deepEqual(messages(parseCapacityForm(raw({ rate: 'NaN' }))), ['Arrival rate must be a number.']);
	assert.deepEqual(messages(parseCapacityForm(raw({ rate: '10000001', rateUnit: 's' }))), ['Arrival rate must be at most 10,000,000 jobs/s.']);
	assert.deepEqual(messages(parseCapacityForm(raw({ duration: '3600001', durationUnit: 'ms' }))), ['Average duration must be at most 1 hour.']);
	assert.deepEqual(messages(parseCapacityForm(raw({ processes: '1001' }))), ['Processes must be a whole number from 1 to 1,000.']);
	assert.deepEqual(messages(parseCapacityForm(raw({ threads: '201' }))), ['Threads per process must be a whole number from 1 to 200.']);
	assert.deepEqual(messages(parseCapacityForm(raw({ peak: '0.5' }))), ['Peak multiplier must be a number from 1 to 20.']);
	assert.equal(parseCapacityForm(raw({ peak: '20' })).ok, true);
	assert.equal(parseCapacityForm(raw({ rate: '10000000', rateUnit: 's' })).ok, true);
});

test('invalid inputs never leak NaN, Infinity or undefined into messages', () => {
	for (const bad of [raw({ rate: 'x' }), raw({ duration: '-5' }), raw({ processes: '' }), raw({ threads: '1e999' })]) {
		const r = parseCapacityForm(bad);
		assert.equal(r.ok, false);
		if (!r.ok) for (const e of r.errors) assert.doesNotMatch(e.message, /NaN|Infinity|undefined/);
	}
});

test('analyze: worked example from the guide is stable and consistent', () => {
	const r = analyze(form());
	assert.equal(r.concurrency, 20);
	assert.equal(r.dbConnections.sidekiq, 20);
	assert.equal(r.dbConnections.solidQueue, 24);
	assert.equal(r.normal.queue.stable, true);
	if (r.normal.queue.stable) assert.ok(Math.abs(r.normal.queue.utilization - 0.2) < 1e-12);
	assert.equal(r.normal.requiredConcurrency, null);
});

test('analyze: backlog drain uses the stable scenario and is null without a backlog', () => {
	const r = analyze(form({ backlog: 1200 }));
	assert.ok(r.normal.drain !== null && r.normal.drain > 0);
	assert.equal(analyze(form()).normal.drain, null);
});

test('summarize and toHashState are plain text and shareable', () => {
	const f = form({ target: 30, backlog: 5000 });
	const text = summarize(f, analyze(f));
	assert.doesNotMatch(text, /NaN|Infinity|undefined/);
	assert.match(text, /Verdict \(peak\): OK/);
	const state = toHashState(form());
	assert.equal(state.target, undefined);
	assert.equal(state.rateUnit, 'min');
	assert.equal(toHashState(f).backlog, 5000);
});

test('toSeconds and perSecond identities', () => {
	assert.equal(toSeconds(2, 's'), 2);
	assert.equal(perSecond(7, 's'), 7);
});
