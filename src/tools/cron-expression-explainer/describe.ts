// AST → plain English (TOOLS_ROADMAP.md §8.5). Pure. Works from the resolved value
// sets, never from the raw text, so `*/15` and `0,15,30,45` read the same way.

import type { CronSpec, FieldInfo } from './parse.ts';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 0 → "12:00 AM", 17 → "5:00 PM", with minute. */
export function clock(hour: number, minute: number): string {
	const h12 = hour % 12 === 0 ? 12 : hour % 12;
	return `${h12}:${pad(minute)} ${hour < 12 ? 'AM' : 'PM'}`;
}

const ordinal = (n: number): string => {
	const teen = n % 100 >= 11 && n % 100 <= 13;
	const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
	return `${n}${suffix}`;
};

/** ["a", "b", "c"] → "a, b and c". */
function joinAnd(items: string[]): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const isRun = (values: number[]): boolean => values.every((v, i) => i === 0 || v === values[i - 1] + 1);

/**
 * The step of a `*\/n` (or `a/n`) field that starts at the field's minimum, else null.
 * Read from the parser's own step info, so a plain list such as 1,15 is never a step.
 */
function stepFor(values: number[], info: FieldInfo, min: number): number | null {
	if (info.step === null || info.step < 2 || values[0] !== min) return null;
	return info.step;
}

function dayText(spec: CronSpec): string | null {
	const dom = spec.daysOfMonth;
	const dow = spec.daysOfWeek;
	const domAll = dom.length === 31;
	const dowAll = dow.length === 7;
	const domPhrase = (): string => {
		const step = stepFor(dom, spec.fields.dayOfMonth, 1);
		if (step) return `every ${step} days of the month, from the ${ordinal(dom[0])}`;
		return `on the ${joinAnd(dom.map(ordinal))} of the month`;
	};
	const dowPhrase = (): string => {
		if (dow.length === 5 && isRun(dow) && dow[0] === 1) return 'on Monday to Friday';
		if (dow.length === 2 && dow[0] === 0 && dow[1] === 6) return 'on Saturday and Sunday';
		if (isRun(dow) && dow.length > 2) return `on ${DAYS[dow[0]]} to ${DAYS[dow[dow.length - 1]]}`;
		return `on ${joinAnd(dow.map((d) => DAYS[d]))}`;
	};
	if (domAll && dowAll) return 'every day';
	if (domAll) return dowPhrase();
	if (dowAll) return domPhrase();
	// Only a bare `*` is unrestricted (Fugit; `*/2` counts as restricted), so then both must match.
	if (spec.fields.dayOfMonth.star || spec.fields.dayOfWeek.star) {
		return `${domPhrase()} and ${dowPhrase()} (both must match)`;
	}
	// Both restricted: Vixie cron (and Fugit) run when EITHER matches.
	return `${domPhrase()} or ${dowPhrase()}`;
}

function monthText(months: number[]): string | null {
	if (months.length === 12) return null;
	if (months.length > 2 && isRun(months)) return `from ${MONTHS[months[0] - 1]} to ${MONTHS[months[months.length - 1] - 1]}`;
	return `in ${joinAnd(months.map((m) => MONTHS[m - 1]))}`;
}

const minutesWord = (minutes: number[]): string =>
	minutes.length === 1 ? `minute ${minutes[0]}` : `minutes ${joinAnd(minutes.map(String))}`;

/** Hours as a span or a list, with minute 00 at the start and 59 at the end. */
function hoursSpan(hours: number[]): string {
	if (hours.length > 2 && isRun(hours)) {
		return `between ${clock(hours[0], 0)} and ${clock(hours[hours.length - 1], 59)}`;
	}
	return `during the hours ${joinAnd(hours.map((h) => clock(h, 0)))}`;
}

function timeText(spec: CronSpec): string {
	const { minutes, hours, fields } = spec;
	const allMinutes = minutes.length === 60;
	const allHours = hours.length === 24;
	const minuteStep = stepFor(minutes, fields.minute, 0);
	const hourStep = stepFor(hours, fields.hour, 0);

	if (allMinutes && allHours) return 'every minute';
	if (allHours && minutes.length === 1 && minutes[0] === 0) return 'every hour, on the hour';
	if (allHours && minuteStep) return `every ${minuteStep} minutes`;
	if (allHours) return `at ${minutesWord(minutes)} past every hour`;

	const fixedMinutes = !allMinutes && !minuteStep;
	const hourSpan = hours.length > 2 && isRun(hours);
	if (fixedMinutes && hours.length * minutes.length <= 6 && !hourStep && !hourSpan) {
		const times: string[] = [];
		for (const h of hours) for (const m of minutes) times.push(clock(h, m));
		return `at ${joinAnd(times)}`;
	}
	if (fixedMinutes && hourStep) {
		return `at ${minutesWord(minutes)}, every ${hourStep} hours`;
	}
	if (fixedMinutes) return `at ${minutesWord(minutes)} past each hour, ${hoursSpan(hours)}`;

	const every = allMinutes ? 'every minute' : `every ${minuteStep} minutes`;
	if (hours.length === 1) return `${every} from ${clock(hours[0], 0)} to ${clock(hours[0], 59)}`;
	return `${every} ${hoursSpan(hours)}`;
}

function secondsText(spec: CronSpec): string | null {
	if (!spec.withSeconds || (spec.seconds.length === 1 && spec.seconds[0] === 0)) return null;
	const { seconds } = spec;
	const step = stepFor(seconds, spec.fields.second, 0);
	if (seconds.length === 60) return 'every second';
	if (step) return `every ${step} seconds`;
	return seconds.length === 1 ? `at second ${seconds[0]}` : `at seconds ${joinAnd(seconds.map(String))}`;
}

/** One plain-English sentence describing when the expression runs. */
export function describe(spec: CronSpec): string {
	const time = timeText(spec);
	const seconds = secondsText(spec);
	const allTheTime = spec.minutes.length === 60 && spec.hours.length === 24;
	let lead = time;
	if (seconds) lead = allTheTime ? seconds : `${seconds}, ${time}`;
	const parts = [lead];
	const day = dayText(spec);
	// "every hour … every day" would be redundant, so "every day" is dropped when the time already says "every".
	if (day && !(day === 'every day' && lead.includes('every'))) parts.push(day);
	const month = monthText(spec.months);
	if (month) parts.push(month);
	const sentence = `Runs ${parts.join(' ')}.`;
	return spec.timeZone ? `${sentence} Times are in ${spec.timeZone}.` : sentence;
}
