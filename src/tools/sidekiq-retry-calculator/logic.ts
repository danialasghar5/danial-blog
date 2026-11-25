// Sidekiq and Active Job retry schedules (TOOLS_ROADMAP.md §8.1).
// Pure functions: no DOM, no Date.now(). Jitter is never sampled; each delay is
// a min / expected / max range computed in closed form.
//
// Sources (verified 2026-11-26, see the guide):
//   Sidekiq  lib/sidekiq/job_retry.rb (delay_for, attempt_retry); Sidekiq 8.0.0 changed the jitter.
//   Active Job  activejob/lib/active_job/exceptions.rb (retry_on, determine_delay, determine_jitter_for_delay).

import {
	failure,
	parseChoice,
	parseNumberField,
	success,
	type FieldError,
	type FieldResult,
	type NumberRule,
	type Result,
} from '../_shared/validate.ts';
import { formatDateTime, formatDuration, formatNumber, isValidTimeZone } from '../_shared/format.ts';

export const ENGINES = ['sidekiq', 'custom', 'activejob'] as const;
export type Engine = (typeof ENGINES)[number];

export const VERSIONS = ['7.x', '8.x'] as const;
export type SidekiqVersion = (typeof VERSIONS)[number];

/** Active Job wait keyword; any other wait is a fixed number of seconds. */
export const POLY = 'polynomially_longer';
export type Wait = number | typeof POLY;

export interface Settings {
	engine: Engine;
	version: SidekiqVersion;
	/** Sidekiq `retry:` count (Sidekiq engines). */
	retry: number;
	/** Active Job `attempts:` (executions allowed, including the first). */
	attempts: number;
	wait: Wait;
	/** Active Job jitter fraction (0–1). Sidekiq jitter is fixed by its version. */
	jitter: number;
	/** Custom sidekiq_retry_in: a · count^p + b. */
	a: number;
	p: number;
	b: number;
}

export const DEFAULTS: Settings = {
	engine: 'sidekiq',
	version: '8.x',
	retry: 25,
	attempts: 5,
	wait: 3,
	jitter: 0.15,
	a: 1,
	p: 4,
	b: 15,
};

/** Keys carried in the share link (#v=1&…). Start time and time zone are not. */
export const HASH_KEYS = ['engine', 'version', 'retry', 'attempts', 'wait', 'jitter', 'a', 'p', 'b'] as const;

/** Raw text from the form or the hash. Everything is untrusted until parseInput. */
export interface RawInput {
	engine?: string;
	version?: string;
	retry?: string;
	attempts?: string;
	wait?: string;
	jitter?: string;
	a?: string;
	p?: string;
	b?: string;
	start?: string;
	timeZone?: string;
}

export interface Parsed {
	settings: Settings;
	/** Time the first attempt fails (absolute), when a start was given. */
	start?: Date;
	timeZone: string;
}

export type ParseResult = Result<Parsed>;

export interface Range {
	min: number;
	expected: number;
	max: number;
}

export interface Row extends Range {
	/** 1-based retry number. The Sidekiq formula's count is retry − 1. */
	retry: number;
	cumMin: number;
	cumExpected: number;
	cumMax: number;
	from?: Date;
	to?: Date;
}

export interface Schedule {
	settings: Settings;
	/** Retries after the first failure: `retry` (Sidekiq) or `attempts − 1` (Active Job). */
	retries: number;
	rows: Row[];
	/** Time from the first failure to the Dead set (Sidekiq) or to the re-raise (Active Job). */
	total: Range;
}

export const CTA_SECONDS = 7 * 86400;
export const CTA_RETRIES = 25;
const RETRY_WARN_ABOVE = 25;

function take<T>(r: FieldResult<T>, fallback: T, used: boolean, errors: FieldError[]): T {
	if (r.ok) return r.value;
	if (used) errors.push(r.error);
	return fallback;
}

function num(raw: string | undefined, rule: NumberRule): FieldResult<number> {
	return parseNumberField(raw, rule) as FieldResult<number>;
}

/**
 * Parse one wall-clock time in an IANA zone ("2026-11-26T14:05") to an absolute
 * Date. Returns undefined for malformed or impossible values.
 */
export function zonedWallClockToDate(text: string, timeZone: string): Date | undefined {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
	if (!m) return undefined;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	const h = Number(m[4]);
	const mi = Number(m[5]);
	const s = Number(m[6] ?? '0');
	if (mo < 1 || mo > 12 || h > 23 || mi > 59 || s > 59) return undefined;
	const check = new Date(Date.UTC(y, mo - 1, d));
	if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return undefined;
	const wall = Date.UTC(y, mo - 1, d, h, mi, s);
	let utc = wall - offsetMs(wall, timeZone);
	const again = wall - offsetMs(utc, timeZone);
	if (again !== utc) utc = again;
	return new Date(utc);
}

/** Zone offset in ms at an instant (zone wall clock minus UTC). */
function offsetMs(instant: number, timeZone: string): number {
	const dtf = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
	const parts: Record<string, string> = {};
	for (const p of dtf.formatToParts(new Date(instant))) parts[p.type] = p.value;
	const asUtc = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour) % 24,
		Number(parts.minute),
		Number(parts.second),
	);
	return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Validate raw input. Only fields the chosen engine uses can produce errors. */
export function parseInput(raw: RawInput = {}): ParseResult {
	const engineR = parseChoice(raw.engine ?? DEFAULTS.engine, ENGINES, 'engine', 'Engine');
	if (!engineR.ok) return failure([engineR.error]);
	const engine = engineR.value;
	const sidekiq = engine !== 'activejob';
	const errors: FieldError[] = [];
	const warnings: string[] = [];

	const version = take(
		parseChoice(raw.version ?? DEFAULTS.version, VERSIONS, 'version', 'Sidekiq version'),
		DEFAULTS.version,
		sidekiq,
		errors,
	);
	const retry = take(
		num(raw.retry ?? String(DEFAULTS.retry), { field: 'retry', label: 'Retry count', min: 0, max: 100, integer: true }),
		DEFAULTS.retry,
		sidekiq,
		errors,
	);
	if (sidekiq && retry > RETRY_WARN_ABOVE) {
		warnings.push(`More than ${RETRY_WARN_ABOVE} retries keeps a failing job in the queue for weeks. Confirm that is intended.`);
	}
	const attempts = take(
		num(raw.attempts ?? String(DEFAULTS.attempts), { field: 'attempts', label: 'Active Job attempts', min: 1, max: 100, integer: true }),
		DEFAULTS.attempts,
		!sidekiq,
		errors,
	);
	const waitText = (raw.wait ?? String(DEFAULTS.wait)).trim();
	const wait: Wait =
		waitText === POLY
			? POLY
			: take(num(waitText, { field: 'wait', label: 'Active Job wait', min: 0, max: 86400 }), DEFAULTS.wait as number, !sidekiq, errors);
	const jitter = take(num(raw.jitter ?? String(DEFAULTS.jitter), { field: 'jitter', label: 'Jitter', min: 0, max: 1 }), DEFAULTS.jitter, !sidekiq, errors);
	const custom = engine === 'custom';
	const a = take(num(raw.a ?? String(DEFAULTS.a), { field: 'a', label: 'Custom a', min: 0, max: 1000000 }), DEFAULTS.a, custom, errors);
	const p = take(num(raw.p ?? String(DEFAULTS.p), { field: 'p', label: 'Custom p', min: 0, max: 6 }), DEFAULTS.p, custom, errors);
	const b = take(num(raw.b ?? String(DEFAULTS.b), { field: 'b', label: 'Custom b', min: 0, max: 1000000 }), DEFAULTS.b, custom, errors);

	const timeZone = (raw.timeZone ?? '').trim() || 'UTC';
	const zoneOk = isValidTimeZone(timeZone);
	if (!zoneOk) errors.push({ field: 'timeZone', message: 'Choose a time zone from the list.' });

	let start: Date | undefined;
	const startText = (raw.start ?? '').trim();
	if (startText !== '' && zoneOk) {
		start = zonedWallClockToDate(startText, timeZone);
		if (!start) errors.push({ field: 'start', message: 'Enter a valid date and time.' });
	}

	if (errors.length) return failure(errors);
	return success({ settings: { engine, version, retry, attempts, wait, jitter, a, p, b }, start, timeZone }, warnings);
}

/**
 * Delay range before the k-th retry (k is 1-based).
 * Sidekiq: base = count^4 + 15 (default) or a·count^p + b (custom), count = k − 1,
 * plus jitter: 7.x rand(10)·(count+1); 8.x rand(10·(count+1)).
 * Active Job: e = k executions. Polynomial wait e^4 + 2, fixed wait W; both add U·spread,
 * U in [0,1), spread = base-term · jitter.
 */
export function delayRange(s: Settings, k: number): Range {
	if (s.engine === 'activejob') {
		const poly = s.wait === POLY;
		const base = poly ? k ** 4 + 2 : (s.wait as number);
		const spread = (poly ? k ** 4 : (s.wait as number)) * s.jitter;
		return { min: base, expected: base + spread / 2, max: base + spread };
	}
	const count = k - 1;
	const [a, p, b] = s.engine === 'sidekiq' ? [1, 4, 15] : [s.a, s.p, s.b];
	const base = a * count ** p + b;
	const jit =
		s.version === '7.x'
			? { expected: 4.5 * (count + 1), max: 9 * (count + 1) }
			: { expected: (10 * (count + 1) - 1) / 2, max: 10 * (count + 1) - 1 };
	return { min: base, expected: base + jit.expected, max: base + jit.max };
}

/** Start + seconds, or undefined when the result is outside the JavaScript Date range. */
function instantPlus(start: Date, seconds: number): Date | undefined {
	const ms = start.getTime() + Math.round(seconds * 1000);
	return Number.isFinite(ms) && Math.abs(ms) <= 8.64e15 ? new Date(ms) : undefined;
}

export function buildSchedule(p: Parsed): Schedule {
	const s = p.settings;
	const retries = s.engine === 'activejob' ? s.attempts - 1 : s.retry;
	const rows: Row[] = [];
	let cumMin = 0;
	let cumExpected = 0;
	let cumMax = 0;
	for (let k = 1; k <= retries; k++) {
		const r = delayRange(s, k);
		cumMin += r.min;
		cumExpected += r.expected;
		cumMax += r.max;
		const row: Row = { retry: k, ...r, cumMin, cumExpected, cumMax };
		if (p.start) {
			row.from = instantPlus(p.start, cumMin);
			row.to = instantPlus(p.start, cumMax);
		}
		rows.push(row);
	}
	return { settings: s, retries, rows, total: { min: cumMin, expected: cumExpected, max: cumMax } };
}

export interface Report {
	tone: 'ok' | 'risk';
	cta: boolean;
	verdict: string;
	verdictWord: string;
	notes: string[];
	warnings: string[];
	snippet: string;
	plainText: string;
	schedule: Schedule;
}

/** Ruby float literal for a jitter or wait fraction. */
function rubyNumber(n: number): string {
	const s = String(n);
	return /[.e]/.test(s) ? s : `${s}.0`;
}

export function snippet(s: Settings, retries: number): string {
	if (s.engine === 'activejob') {
		const wait = s.wait === POLY ? ':polynomially_longer' : `${s.wait}.seconds`;
		return [
			'class ExampleJob < ApplicationJob',
			`  retry_on TransientError, wait: ${wait}, attempts: ${s.attempts}, jitter: ${rubyNumber(s.jitter)}`,
			'end',
		].join('\n');
	}
	const lines = ['class ExampleWorker', '  include Sidekiq::Job', `  sidekiq_options retry: ${retries}`];
	if (s.engine === 'custom') {
		lines.push('');
		lines.push('  sidekiq_retry_in do |count, exception, jobhash|');
		const body = s.a === 0 ? String(s.b) : `${s.a} * count ** ${s.p} + ${s.b}`;
		lines.push(`    ${body}  # seconds; Sidekiq adds jitter on top`);
		lines.push('  end');
	}
	lines.push('end');
	return lines.join('\n');
}

export function buildReport(p: Parsed, warnings: string[] = []): Report {
	const schedule = buildSchedule(p);
	const s = p.settings;
	const isActiveJob = s.engine === 'activejob';
	const t = schedule.total;
	const range = `~${formatDuration(t.expected)} (range ${formatDuration(t.min)}–${formatDuration(t.max)})`;

	let verdict: string;
	if (schedule.retries === 0) {
		verdict = isActiveJob
			? 'The first failure is re-raised at once: attempts 1 allows no retries.'
			: 'Job reaches the Dead set immediately: retry 0 allows no retries.';
	} else {
		verdict = isActiveJob ? `The last attempt fails and the error is re-raised after ${range}.` : `Job reaches the Dead set after ${range}.`;
	}

	const cta = t.expected > CTA_SECONDS || schedule.retries > CTA_RETRIES;
	const notes: string[] = [];
	if (!isActiveJob) {
		notes.push('Dead set retention defaults: up to 10,000 jobs (dead_max_jobs) for 180 days (dead_timeout_in_seconds).');
	}
	if (isActiveJob) {
		notes.push('After the re-raise, the queue adapter may retry the job on its own. Check your adapter.');
	}

	const tz = p.timeZone;
	const header = ['Retry', 'Min (s)', 'Expected (s)', 'Max (s)', 'Cumulative expected (s)'];
	if (p.start) header.push('Time range');
	const lines = [verdict, '', header.join('\t')];
	for (const r of schedule.rows) {
		const cells = [
			String(r.retry),
			formatNumber(r.min, 1),
			formatNumber(r.expected, 1),
			formatNumber(r.max, 1),
			formatNumber(r.cumExpected, 1),
		];
		if (p.start) {
			cells.push(r.from && r.to ? `${formatDateTime(r.from, tz)} – ${formatDateTime(r.to, tz)}` : 'after 275760 AD (beyond the Date range)');
		}
		lines.push(cells.join('\t'));
	}
	const code = snippet(s, schedule.retries);

	return {
		tone: cta ? 'risk' : 'ok',
		cta,
		verdict,
		verdictWord: cta ? 'Long window' : 'Bounded window',
		notes,
		warnings,
		snippet: code,
		plainText: [...lines, '', code].join('\n'),
		schedule,
	};
}

/** Settings as share-link state. Keys match HASH_KEYS. */
export function toHashState(s: Settings): Record<string, string | number> {
	return { engine: s.engine, version: s.version, retry: s.retry, attempts: s.attempts, wait: s.wait, jitter: s.jitter, a: s.a, p: s.p, b: s.b };
}
