// Fugit natural-language subset → cron (Solid Queue `schedule:` is parsed by Fugit).
// Only the phrases listed in TOOLS_ROADMAP.md §8.5 and the Fugit README examples are
// accepted. Anything else returns the "not supported here" result, never a guess.

import { isValidTimeZone } from '../_shared/format.ts';

export const FUGIT_NAT_LINK = 'https://github.com/floraison/fugit#fugitnat';
export const NAT_UNSUPPORTED = 'Not supported here — Fugit may still accept it';

export type NatResult = { ok: true; cron: string } | { ok: false; message: string; link: string };

const NUMBER_WORDS: Record<string, number> = {
	one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
	seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const DAY_WORDS: Record<string, number> = {
	sun: 0, sunday: 0,
	mon: 1, monday: 1,
	tue: 2, tues: 2, tuesday: 2,
	wed: 3, wednesday: 3,
	thu: 4, thur: 4, thurs: 4, thursday: 4,
	fri: 5, friday: 5,
	sat: 6, saturday: 6,
};

const unsupported = (): NatResult => ({ ok: false, message: NAT_UNSUPPORTED, link: FUGIT_NAT_LINK });

/** A count or hour written as digits or a number word (one … twelve). */
const numberOf = (text: string): number | null => {
	if (/^\d+$/.test(text)) return Number(text);
	return NUMBER_WORDS[text] ?? null;
};

const SPLIT = /\s+(?:and|or)\s+|\s*,\s*/;

/** "5 pm", "5pm", "16:30", "noon", "midnight", "five" → { hour, minute } (24-hour), or null. */
function parseTime(text: string): { hour: number; minute: number } | null {
	if (text === 'noon') return { hour: 12, minute: 0 };
	if (text === 'midnight') return { hour: 0, minute: 0 };
	const m = text.match(/^(\d{1,2}|[a-z]+)(?::(\d{2}))?\s?(am|pm)?$/);
	if (!m) return null;
	const hour = numberOf(m[1]);
	if (hour === null) return null;
	const minute = m[2] === undefined ? 0 : Number(m[2]);
	if (minute > 59) return null;
	if (m[3]) {
		if (hour < 1 || hour > 12) return null;
		return { hour: (hour % 12) + (m[3] === 'pm' ? 12 : 0), minute };
	}
	if (hour > 23) return null;
	return { hour, minute };
}

/** Convert one supported Fugit phrase to a cron expression. */
export function natToCron(input: string): NatResult {
	const normal = input.trim().replace(/\s+/g, ' ');

	let zone: string | null = null;
	let body = normal;
	const zoneMatch = normal.match(/ (?:on|in) ((?:[A-Za-z_]+\/[A-Za-z0-9_+\-/]+)|UTC)$/i);
	if (zoneMatch && zoneMatch.index !== undefined) {
		zone = zoneMatch[1];
		body = normal.slice(0, zoneMatch.index);
		if (!isValidTimeZone(zone)) return { ok: false, message: `Unknown time zone "${zone}"`, link: FUGIT_NAT_LINK };
	}
	const withZone = (cron: string): NatResult => ({ ok: true, cron: zone ? `${cron} ${zone}` : cron });

	const lower = body.toLowerCase();

	if (lower === 'every minute') return withZone('* * * * *');
	if (lower === 'every hour') return withZone('0 * * * *');

	// "every 15s", "every 15 seconds"
	let m = lower.match(/^every (\S+) ?(seconds?|secs?|s)$/);
	if (m) {
		const n = numberOf(m[1]);
		if (n === null || n < 1 || n > 59) return unsupported();
		return withZone(`*/${n} * * * * *`);
	}

	// "every 5 minutes", "every 3 hours", "every 2 days", "every 4 months"
	m = lower.match(/^every (\S+) (minutes?|mins?|hours?|days?|months?)$/);
	if (m) {
		const n = numberOf(m[1]);
		if (n === null || n < 1) return unsupported();
		const unit = m[2].replace(/s$/, '');
		if (unit === 'min' || unit === 'minute') return n <= 59 ? withZone(`*/${n} * * * *`) : unsupported();
		if (unit === 'hour') return n <= 23 ? withZone(`0 */${n} * * *`) : unsupported();
		if (unit === 'day') return n <= 31 ? withZone(`0 0 */${n} * *`) : unsupported();
		if (unit === 'month') return n <= 12 ? withZone(`0 0 1 */${n} *`) : unsupported();
		return unsupported();
	}

	// "every day at …", "every weekday at …", "every tuesday and monday at …"
	m = lower.match(/^every (.+?) at (.+)$/);
	if (!m) return unsupported();
	const [, dayPart, timePart] = m;

	let dow: string;
	if (dayPart === 'day') dow = '*';
	else if (dayPart === 'weekday') dow = '1,2,3,4,5';
	else {
		const days = new Set<number>();
		for (const word of dayPart.split(SPLIT)) {
			if (!(word in DAY_WORDS)) return unsupported();
			days.add(DAY_WORDS[word]);
		}
		dow = [...days].sort((a, b) => a - b).join(',');
	}

	const times = timePart.split(SPLIT).map(parseTime);
	if (times.some((t) => t === null)) return unsupported();
	const parsed = times as { hour: number; minute: number }[];
	const minute = parsed[0].minute;
	if (parsed.some((t) => t.minute !== minute)) return unsupported();
	const hours = [...new Set(parsed.map((t) => t.hour))].sort((a, b) => a - b).join(',');

	return withZone(`${minute} ${hours} * * ${dow}`);
}
