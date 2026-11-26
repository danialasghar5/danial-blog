// Next runs for a parsed cron spec (TOOLS_ROADMAP.md §8.5). Pure: `now` and the
// fallback time zone are injected; nothing reads the clock.
//
// Method: walk local calendar dates in the target zone (from now's local date, for at
// most five years), keep dates whose month and day rule match, then for each matching
// hour/minute/second build the local wall-clock time and convert it to a UTC instant.
//
// DST rules (also in the guide):
//   - A wall-clock time that does not exist (spring-forward gap) is SKIPPED.
//   - A wall-clock time that occurs twice (fall-back overlap) runs ONCE, at the earlier
//     occurrence, as Vixie cron does.

import type { CronSpec } from './parse.ts';

export const DEFAULT_RUNS = 10;
export const MAX_RUNS = 100;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const HORIZON_DAYS = 366 * 5 + 2;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
	let f = formatters.get(timeZone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
		});
		formatters.set(timeZone, f);
	}
	return f;
}

interface Wall {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

/** The wall-clock reading of a whole-second UTC instant in a zone. */
function wallAt(ms: number, timeZone: string): Wall {
	const parts = formatterFor(timeZone).formatToParts(new Date(ms));
	const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
	return {
		year: get('year'),
		month: get('month'),
		day: get('day'),
		hour: get('hour'),
		minute: get('minute'),
		second: get('second'),
	};
}

/** Milliseconds that a wall-clock reading would have if it were UTC. */
const asUtc = (w: Wall): number => Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);

/** Zone offset in ms at a whole-second instant. */
const offsetAt = (ms: number, timeZone: string): number => asUtc(wallAt(ms, timeZone)) - ms;

/**
 * All UTC instants whose wall-clock reading equals `wall` (a UTC-based reading), sorted.
 * Zero results: the time is in a gap. Two: it repeats in an overlap.
 */
export function instantsForWall(wall: number, timeZone: string): number[] {
	const offsets = new Set([offsetAt(wall - DAY_MS, timeZone), offsetAt(wall + DAY_MS, timeZone)]);
	const found: number[] = [];
	for (const offset of offsets) {
		const candidate = wall - offset;
		if (offsetAt(candidate, timeZone) === offset) found.push(candidate);
	}
	return found.sort((a, b) => a - b);
}

/** A day matches when the month matches and the day rule holds (Vixie OR/AND rule). */
export function dayMatches(spec: CronSpec, domOk: boolean, dowOk: boolean): boolean {
	const unrestricted = spec.fields.dayOfMonth.star || spec.fields.dayOfWeek.star;
	return unrestricted ? domOk && dowOk : domOk || dowOk;
}

/**
 * The next `count` run instants strictly after `now`, in ascending order.
 * `timeZone` is used unless the expression carries its own zone.
 */
export function nextRuns(spec: CronSpec, now: Date, timeZone: string, count: number = DEFAULT_RUNS): Date[] {
	const zone = spec.timeZone ?? timeZone;
	const wanted = Math.min(MAX_RUNS, Math.max(1, Math.floor(count)));
	const nowMs = now.getTime();
	const today = wallAt(nowMs, zone);
	let dayStart = Date.UTC(today.year, today.month - 1, today.day);
	const horizon = dayStart + HORIZON_DAYS * DAY_MS;
	const found: number[] = [];

	for (; dayStart <= horizon; dayStart += DAY_MS) {
		const date = new Date(dayStart);
		const month = date.getUTCMonth() + 1;
		if (!spec.months.includes(month)) continue;
		const dayOfMonth = date.getUTCDate();
		const dayOfWeek = date.getUTCDay();
		if (!dayMatches(spec, spec.daysOfMonth.includes(dayOfMonth), spec.daysOfWeek.includes(dayOfWeek))) continue;

		for (const hour of spec.hours) {
			for (const minute of spec.minutes) {
				for (const second of spec.seconds) {
					const wall = Date.UTC(date.getUTCFullYear(), month - 1, dayOfMonth, hour, minute, second);
					const instants = instantsForWall(wall, zone);
					if (instants.length === 0) continue; // spring-forward gap: skipped
					const first = instants[0]; // overlap: earliest occurrence only
					if (first > nowMs) found.push(first);
				}
			}
		}

		// Later days can only produce instants from about 14 hours before their midnight.
		const nextDay = dayStart + DAY_MS;
		if (found.length >= wanted) {
			found.sort((a, b) => a - b);
			if (found[wanted - 1] < nextDay - 15 * HOUR_MS) break;
		}
	}

	return [...new Set(found)]
		.sort((a, b) => a - b)
		.slice(0, wanted)
		.map((ms) => new Date(ms));
}
