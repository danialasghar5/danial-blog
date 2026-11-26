// Queue capacity model: M/M/c (Erlang C) with Little's law (TOOLS_ROADMAP.md §8.2, Appendix B).
// Pure functions only: no DOM, no clock, no randomness.
//
// Assumptions shown on the page: Poisson arrivals, exponential service times, FIFO, one shared queue.

import { collect, failure, parseChoice, parseNumberField, success, type Result } from '../_shared/validate.ts';
import { formatDuration, formatNumber, formatPercent } from '../_shared/format.ts';
import type { HashValue } from '../_shared/hash-state.ts';

export const RATE_UNITS = ['s', 'min', 'h'] as const;
export type RateUnit = (typeof RATE_UNITS)[number];
export const DURATION_UNITS = ['ms', 's'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export const MAX_RATE_PER_SECOND = 1e7;
export const MAX_DURATION_SECONDS = 3600;
export const MAX_SEARCH_CONCURRENCY = 100_000;
/** Erlang C verdict thresholds on peak utilization (DESIGN.md Tool Verdict). */
export const TIGHT_AT = 0.7;
export const RISK_AT = 0.85;

/** Keys shared through the #hash state. */
export const HASH_KEYS = ['rate', 'rateUnit', 'duration', 'durationUnit', 'processes', 'threads', 'target', 'peak', 'backlog'] as const;

/** Raw text as typed (or as read from a shared link). */
export interface RawForm {
	rate: string;
	rateUnit: string;
	duration: string;
	durationUnit: string;
	processes: string;
	threads: string;
	target: string;
	peak: string;
	backlog: string;
}

export const DEFAULT_FORM: RawForm = {
	rate: '600',
	rateUnit: 'min',
	duration: '400',
	durationUnit: 'ms',
	processes: '2',
	threads: '10',
	target: '30',
	peak: '1',
	backlog: '',
};

/** Validated form. Numbers keep the units the user typed. */
export interface CapacityForm {
	rate: number;
	rateUnit: RateUnit;
	duration: number;
	durationUnit: DurationUnit;
	processes: number;
	threads: number;
	target?: number;
	peak: number;
	backlog?: number;
}

/** Jobs per second from /s, /min or /h. */
export function perSecond(rate: number, unit: RateUnit): number {
	if (unit === 's') return rate;
	return unit === 'min' ? rate / 60 : rate / 3600;
}

/** Seconds from ms or s. */
export function toSeconds(duration: number, unit: DurationUnit): number {
	return unit === 'ms' ? duration / 1000 : duration;
}

/** Validate every field, keeping every error. Cross-unit limits are checked after conversion. */
export function parseCapacityForm(raw: RawForm): Result<CapacityForm> {
	const rate = parseNumberField(raw.rate, { field: 'rate', label: 'Arrival rate', minExclusive: 0 });
	const rateUnit = parseChoice(raw.rateUnit, RATE_UNITS, 'rateUnit', 'Rate unit');
	const duration = parseNumberField(raw.duration, { field: 'duration', label: 'Average duration', minExclusive: 0 });
	const durationUnit = parseChoice(raw.durationUnit, DURATION_UNITS, 'durationUnit', 'Duration unit');
	const processes = parseNumberField(raw.processes, { field: 'processes', label: 'Processes', integer: true, min: 1, max: 1000 });
	const threads = parseNumberField(raw.threads, { field: 'threads', label: 'Threads per process', integer: true, min: 1, max: 200 });
	const target = parseNumberField(raw.target, { field: 'target', label: 'Target p95 wait', minExclusive: 0, optional: true });
	const peak = parseNumberField(raw.peak, { field: 'peak', label: 'Peak multiplier', min: 1, max: 20 });
	const backlog = parseNumberField(raw.backlog, { field: 'backlog', label: 'Current backlog', integer: true, min: 0, optional: true });

	const collected = collect({ rate, rateUnit, duration, durationUnit, processes, threads, target, peak, backlog });
	if (!collected.ok) return failure(collected.errors);
	const v = collected.value;
	const form: CapacityForm = {
		rate: v.rate,
		rateUnit: v.rateUnit,
		duration: v.duration,
		durationUnit: v.durationUnit,
		processes: v.processes,
		threads: v.threads,
		peak: v.peak,
	};
	if (v.target !== undefined) form.target = v.target;
	if (v.backlog !== undefined) form.backlog = v.backlog;

	const perSec = perSecond(form.rate, form.rateUnit);
	if (perSec > MAX_RATE_PER_SECOND) {
		return failure([{ field: 'rate', message: 'Arrival rate must be at most 10,000,000 jobs/s.' }]);
	}
	if (toSeconds(form.duration, form.durationUnit) > MAX_DURATION_SECONDS) {
		return failure([{ field: 'duration', message: 'Average duration must be at most 1 hour.' }]);
	}
	return success(form);
}

/** Erlang B by the stable recurrence: B0 = 1, Bk = a·B(k−1) / (k + a·B(k−1)). Always in [0, 1]. */
export function erlangB(a: number, c: number): number {
	let b = 1;
	for (let k = 1; k <= c; k++) b = (a * b) / (k + a * b);
	return b;
}

/** Erlang C from Erlang B: C = B / (1 − ρ(1 − B)). Requires ρ < 1. */
export function erlangCFromB(rho: number, b: number): number {
	return b / (1 - rho * (1 - b));
}

export interface StableQueue {
	stable: true;
	utilization: number;
	/** Probability an arriving job waits (Erlang C). */
	pWait: number;
	/** Average queue wait Wq, seconds. */
	avgWait: number;
	/** 95th percentile wait, seconds (0 when C ≤ 0.05). */
	p95Wait: number;
	/** Average jobs waiting in queue, Lq = λ·Wq. */
	jobsWaiting: number;
	/** Average jobs in system, L = λ·(Wq + S). */
	jobsInSystem: number;
	/** Spare throughput cμ − λ, jobs/s. */
	headroom: number;
}

export interface UnstableQueue {
	stable: false;
	utilization: number;
	/** Backlog growth λ − cμ, jobs/s (≥ 0 when unstable). */
	growthRate: number;
}

export type QueueResult = StableQueue | UnstableQueue;

/** M/M/c metrics for arrival rate λ (jobs/s), duration S (s) and c servers. */
export function analyzeQueue(lambda: number, s: number, c: number): QueueResult {
	const a = lambda * s;
	const rho = a / c;
	if (!(rho < 1)) {
		return { stable: false, utilization: rho, growthRate: lambda - c / s };
	}
	const pWait = erlangCFromB(rho, erlangB(a, c));
	const headroom = (c - a) / s;
	const avgWait = pWait / headroom;
	const p95Wait = pWait > 0.05 ? Math.log(pWait / 0.05) / headroom : 0;
	const jobsWaiting = lambda * avgWait;
	return {
		stable: true,
		utilization: rho,
		pWait,
		avgWait,
		p95Wait,
		jobsWaiting,
		jobsInSystem: lambda * (avgWait + s),
		headroom,
	};
}

/**
 * Smallest c ≥ ⌊a⌋+1 whose p95 wait is ≤ target (seconds). Null when no c up to
 * MAX_SEARCH_CONCURRENCY reaches it. Erlang B is extended one step per c, so the search is linear.
 */
export function requiredConcurrency(lambda: number, s: number, targetP95: number): number | null {
	const a = lambda * s;
	if (!Number.isFinite(a)) return null;
	const start = Math.floor(a) + 1;
	if (start > MAX_SEARCH_CONCURRENCY) return null;
	let b = 1;
	for (let k = 1; k < start; k++) b = (a * b) / (k + a * b);
	for (let c = start; c <= MAX_SEARCH_CONCURRENCY; c++) {
		b = (a * b) / (c + a * b);
		const pWait = erlangCFromB(a / c, b);
		const headroom = (c - a) / s;
		const p95 = pWait > 0.05 ? Math.log(pWait / 0.05) / headroom : 0;
		if (p95 <= targetP95) return c;
	}
	return null;
}

/** Seconds to clear a backlog at spare throughput cμ − λ. Null when the queue is unstable. */
export function drainSeconds(backlog: number, queue: QueueResult): number | null {
	return queue.stable ? backlog / queue.headroom : null;
}

export type VerdictLevel = 'ok' | 'tight' | 'risk';

export interface Verdict {
	level: VerdictLevel;
	word: 'OK' | 'Tight' | 'Risk';
	cssClass: 'is-ok' | 'is-warn' | 'is-risk';
}

/** Verdict on the peak scenario: ρ < 0.7 OK, < 0.85 Tight, otherwise (or unstable) Risk. */
export function verdictFor(queue: QueueResult): Verdict {
	if (!queue.stable || queue.utilization >= RISK_AT) return { level: 'risk', word: 'Risk', cssClass: 'is-risk' };
	if (queue.utilization >= TIGHT_AT) return { level: 'tight', word: 'Tight', cssClass: 'is-warn' };
	return { level: 'ok', word: 'OK', cssClass: 'is-ok' };
}

export interface Scenario {
	label: 'normal' | 'peak';
	/** Arrival rate, jobs/s. */
	rate: number;
	queue: QueueResult;
	/** Concurrency for the target: a number, 'unreachable', or null when no target was given. */
	requiredConcurrency: number | 'unreachable' | null;
	/** Drain time for the backlog, null when there is no backlog or the queue is unstable. */
	drain: number | null;
}

export interface Analysis {
	processes: number;
	threads: number;
	concurrency: number;
	/** Pool size needed: Sidekiq pool ≥ concurrency; Solid Queue threads + 2 per process. */
	dbConnections: { sidekiq: number; solidQueue: number };
	normal: Scenario;
	peak: Scenario;
	verdict: Verdict;
	/** The CTA condition: peak ρ ≥ 0.85 or unstable. */
	cta: boolean;
	meaning: string;
}

function scenario(label: Scenario['label'], rate: number, form: CapacityForm, concurrency: number): Scenario {
	const s = toSeconds(form.duration, form.durationUnit);
	const queue = analyzeQueue(rate, s, concurrency);
	let required: Scenario['requiredConcurrency'] = null;
	if (form.target !== undefined) {
		const found = requiredConcurrency(rate, s, form.target);
		required = found === null ? 'unreachable' : found;
	}
	const drain = form.backlog !== undefined ? drainSeconds(form.backlog, queue) : null;
	return { label, rate, queue, requiredConcurrency: required, drain };
}

function meaningFor(peak: Scenario, verdict: Verdict): string {
	const q = peak.queue;
	if (!q.stable) {
		if (q.growthRate > 0) {
			return `At peak, arrivals exceed capacity by ${formatNumber(q.growthRate, 2)} jobs/s. The queue grows without bound until the rate falls or concurrency rises.`;
		}
		return 'At peak, arrivals equal capacity exactly. Any burst or variation in job times grows the queue without bound.';
	}
	const util = formatPercent(q.utilization);
	if (verdict.level === 'risk') {
		return `Peak utilization is ${util}. Above 85%, bursts queue for long periods and p95 waits climb quickly.`;
	}
	if (verdict.level === 'tight') {
		return `Peak utilization is ${util}. Waits are still short, but a small rise in load moves the p95 quickly.`;
	}
	return `Peak utilization is ${util}. Capacity covers the peak with room to spare, if the model's assumptions hold.`;
}

/** Full model for a validated form. Everything returned is finite or explicitly null/'unreachable'. */
export function analyze(form: CapacityForm): Analysis {
	const concurrency = form.processes * form.threads;
	const base = perSecond(form.rate, form.rateUnit);
	const normal = scenario('normal', base, form, concurrency);
	const peak = scenario('peak', base * form.peak, form, concurrency);
	const verdict = verdictFor(peak.queue);
	return {
		processes: form.processes,
		threads: form.threads,
		concurrency,
		dbConnections: {
			sidekiq: form.processes * form.threads,
			solidQueue: form.processes * (form.threads + 2),
		},
		normal,
		peak,
		verdict,
		cta: verdict.level === 'risk',
		meaning: meaningFor(peak, verdict),
	};
}

/** Plain-text result for the Copy button. */
export function summarize(form: CapacityForm, result: Analysis): string {
	const lines = [
		`Job queue capacity (M/M/c): ${formatNumber(perSecond(form.rate, form.rateUnit), 3)} jobs/s, ${formatDuration(toSeconds(form.duration, form.durationUnit))} average, ${result.processes} × ${result.threads} = ${result.concurrency} concurrency`,
	];
	for (const sc of [result.normal, result.peak]) {
		const label = sc.label === 'normal' ? 'Normal' : `Peak (×${formatNumber(form.peak, 2)})`;
		if (sc.queue.stable) {
			lines.push(
				`${label}: rate ${formatNumber(sc.rate, 3)}/s, utilization ${formatPercent(sc.queue.utilization)}, P(wait) ${formatPercent(sc.queue.pWait)}, average wait ${formatDuration(sc.queue.avgWait)}, p95 wait ${formatDuration(sc.queue.p95Wait)}`,
			);
		} else {
			lines.push(`${label}: rate ${formatNumber(sc.rate, 3)}/s, utilization ${formatPercent(sc.queue.utilization)}, unstable (backlog grows ${formatNumber(sc.queue.growthRate, 3)} jobs/s)`);
		}
	}
	lines.push(`Verdict (peak): ${result.verdict.word}. ${result.meaning}`);
	lines.push('Assumes Poisson arrivals, exponential service times, FIFO, one shared queue.');
	return lines.join('\n');
}

/** Flat state for the share link, omitting empty optional fields. */
export function toHashState(form: CapacityForm): Record<string, HashValue> {
	const state: Record<string, HashValue> = {
		rate: form.rate,
		rateUnit: form.rateUnit,
		duration: form.duration,
		durationUnit: form.durationUnit,
		processes: form.processes,
		threads: form.threads,
		peak: form.peak,
	};
	if (form.target !== undefined) state.target = form.target;
	if (form.backlog !== undefined) state.backlog = form.backlog;
	return state;
}
