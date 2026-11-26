// Cron grammar → AST (TOOLS_ROADMAP.md §8.5). Pure: no DOM, no Date, no network.
// Accepts the 5-field Vixie/POSIX form, the 6-field form with seconds first
// (sidekiq-cron / Fugit), the macros, and an optional trailing IANA time zone.
// Fugit-only extensions (&, #, %, ~, L) are detected and rejected with a clear error.

import { isValidTimeZone } from '../_shared/format.ts';

export type FieldKey = 'second' | 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek';

export interface FieldInfo {
	/** true when the field text starts with `*` (unrestricted, Vixie rule). */
	star: boolean;
	/** The n of a single `*\/n` or `a-b/n` item; null otherwise. */
	step: number | null;
}

export interface CronSpec {
	/** The input, trimmed. */
	source: string;
	/** Macro name as typed (lower-case), or null. */
	macro: string | null;
	/** true for the 6-field form. */
	withSeconds: boolean;
	/** Trailing IANA zone, or null when none was given. */
	timeZone: string | null;
	/** Sorted, de-duplicated allowed values. Day of week uses 0 = Sunday … 6 = Saturday. */
	seconds: number[];
	minutes: number[];
	hours: number[];
	daysOfMonth: number[];
	months: number[];
	daysOfWeek: number[];
	fields: Record<FieldKey, FieldInfo>;
}

/** First error only. `field` is the 1-based position as typed (0 = whole expression). */
export interface ParseError {
	message: string;
	field: number;
	column: number;
}

export type ParseResult = { ok: true; cron: CronSpec } | { ok: false; error: ParseError };

const SPEC: Record<FieldKey, { label: string; min: number; max: number }> = {
	second: { label: 'second', min: 0, max: 59 },
	minute: { label: 'minute', min: 0, max: 59 },
	hour: { label: 'hour', min: 0, max: 23 },
	dayOfMonth: { label: 'day of month', min: 1, max: 31 },
	month: { label: 'month', min: 1, max: 12 },
	dayOfWeek: { label: 'day of week', min: 0, max: 7 },
};

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const MACROS: Record<string, string> = {
	'@yearly': '0 0 1 1 *',
	'@annually': '0 0 1 1 *',
	'@monthly': '0 0 1 * *',
	'@weekly': '0 0 * * 0',
	'@daily': '0 0 * * *',
	'@midnight': '0 0 * * *',
	'@hourly': '0 * * * *',
};

const EXTENSIONS: Record<string, string> = {
	'&': 'AND of day fields (&)',
	'#': 'nth weekday (#)',
	'%': 'modulo (%)',
	'~': 'random (~)',
	L: 'last day (L)',
};

const fail = (field: number, column: number, message: string): { ok: false; error: ParseError } => ({
	ok: false,
	error: { message, field, column },
});

type ItemResult = { ok: true; value: number } | { ok: false; error: ParseError };

function readValue(text: string, key: FieldKey, fieldNo: number, column: number): ItemResult {
	const spec = SPEC[key];
	const label = `Field ${fieldNo} (${spec.label})`;
	const upper = text.toUpperCase();
	let value: number | null = null;
	if (/^\d+$/.test(text)) value = Number(text);
	else if (key === 'month' && MONTH_NAMES.includes(upper)) value = MONTH_NAMES.indexOf(upper) + 1;
	else if (key === 'dayOfWeek' && DAY_NAMES.includes(upper)) value = DAY_NAMES.indexOf(upper);
	if (value === null) {
		const hint = key === 'month' ? ' or a month name such as JAN' : key === 'dayOfWeek' ? ' or a day name such as MON' : '';
		return { ok: false, error: { message: `${label}: "${text}" is not a number${hint}`, field: fieldNo, column } };
	}
	if (value < spec.min || value > spec.max) {
		return { ok: false, error: { message: `${label}: ${value} is out of range ${spec.min}–${spec.max}`, field: fieldNo, column } };
	}
	return { ok: true, value };
}

function parseField(
	text: string,
	key: FieldKey,
	fieldNo: number,
	column: number,
): { ok: true; values: number[]; info: FieldInfo } | { ok: false; error: ParseError } {
	const spec = SPEC[key];
	const label = `Field ${fieldNo} (${spec.label})`;
	const values = new Set<number>();
	let step: number | null = null;
	let itemOffset = 0;

	for (const item of text.split(',')) {
		const itemColumn = column + itemOffset;
		itemOffset += item.length + 1;

		if (item === '') return fail(fieldNo, itemColumn, `${label}: empty list item`);
		const upper = item.toUpperCase();
		const isName = (key === 'month' && MONTH_NAMES.includes(upper)) || (key === 'dayOfWeek' && DAY_NAMES.includes(upper));
		const ext = isName ? null : item.match(/[&#%~L]/i);
		if (ext) {
			const name = EXTENSIONS[ext[0].toUpperCase()];
			return fail(fieldNo, itemColumn, `${label}: "${item}" uses ${name}. This is a Fugit extension, not evaluated by this tool`);
		}

		const parts = item.split('/');
		if (parts.length > 2) return fail(fieldNo, itemColumn, `${label}: "${item}" has more than one "/"`);
		const [base, stepText] = parts;
		let itemStep: number | null = null;
		if (stepText !== undefined) {
			if (!/^\d+$/.test(stepText) || Number(stepText) < 1) {
				return fail(fieldNo, itemColumn + base.length + 1, `${label}: step "${stepText}" must be a whole number of at least 1`);
			}
			itemStep = Number(stepText);
		}

		let lo: number;
		let hi: number;
		const dowCap = key === 'dayOfWeek' ? 6 : spec.max;
		if (base === '*') {
			lo = spec.min;
			hi = dowCap;
		} else if (base.includes('-')) {
			const bounds = base.split('-');
			if (bounds.length !== 2) return fail(fieldNo, itemColumn, `${label}: "${item}" is not a valid range`);
			const a = readValue(bounds[0], key, fieldNo, itemColumn);
			if (!a.ok) return a;
			const b = readValue(bounds[1], key, fieldNo, itemColumn + bounds[0].length + 1);
			if (!b.ok) return b;
			if (a.value > b.value) {
				return fail(fieldNo, itemColumn, `${label}: range ${bounds[0]}-${bounds[1]} runs backwards`);
			}
			lo = a.value;
			hi = b.value;
		} else {
			const a = readValue(base, key, fieldNo, itemColumn);
			if (!a.ok) return a;
			lo = a.value;
			// `a/n` means "from a to the top of the field, every n".
			hi = itemStep !== null ? dowCap : lo;
		}

		if (itemStep !== null) step = itemStep;
		for (let v = lo; v <= hi; v += itemStep ?? 1) values.add(key === 'dayOfWeek' && v === 7 ? 0 : v);
	}

	const single = !text.includes(',') && text.includes('/');
	return {
		ok: true,
		values: [...values].sort((x, y) => x - y),
		info: { star: text.startsWith('*'), step: single ? step : null },
	};
}

const TZ_LIKE = /^(?:[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+|UTC|GMT)$/i;

/** Parse one cron expression. Never throws on user input. */
export function parseCron(input: string): ParseResult {
	const source = input.trim();
	if (source === '') return fail(0, 1, 'Enter a cron expression, such as 0 3 * * *.');

	const tokens = [...source.matchAll(/\S+/g)].map((m) => ({ text: m[0], column: (m.index ?? 0) + 1 }));
	const endColumn = source.length + 1;
	let macro: string | null = null;
	let timeZone: string | null = null;
	let withSeconds = false;
	let fieldTokens: { text: string; column: number }[];

	if (tokens[0].text.startsWith('@')) {
		macro = tokens[0].text.toLowerCase();
		const expansion = MACROS[macro];
		if (!expansion) return fail(0, tokens[0].column, `Unknown macro "${tokens[0].text}". Use one of ${Object.keys(MACROS).join(', ')}.`);
		if (tokens.length > 2) return fail(0, tokens[2].column, 'Only one time zone may follow a macro');
		if (tokens.length === 2) timeZone = tokens[1].text;
		fieldTokens = expansion.split(' ').map((text) => ({ text, column: 1 }));
	} else {
		let rest = tokens;
		const last = tokens[tokens.length - 1];
		if (tokens.length > 5 && TZ_LIKE.test(last.text)) {
			timeZone = last.text;
			rest = tokens.slice(0, -1);
		}
		if (rest.length !== 5 && rest.length !== 6) {
			const column = rest.length < 5 ? endColumn : rest[6].column;
			return fail(
				0,
				column,
				`Expected 5 fields (minute hour day-of-month month day-of-week) or 6 with seconds first, found ${rest.length}`,
			);
		}
		withSeconds = rest.length === 6;
		fieldTokens = rest;
	}

	const keys: FieldKey[] = withSeconds
		? ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']
		: ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];

	const parsed: Partial<Record<FieldKey, { values: number[]; info: FieldInfo }>> = {};
	for (let i = 0; i < keys.length; i++) {
		const token = fieldTokens[i];
		const result = parseField(token.text, keys[i], i + 1, token.column);
		if (!result.ok) return result;
		parsed[keys[i]] = result;
	}

	if (timeZone !== null && !isValidTimeZone(timeZone)) {
		const tzToken = tokens.find((t) => t.text === timeZone);
		return fail(0, tzToken?.column ?? endColumn, `Unknown time zone "${timeZone}"`);
	}

	const every = (key: FieldKey, range: [number, number]): number[] => {
		const v = parsed[key];
		if (v) return v.values;
		const out: number[] = [];
		for (let n = range[0]; n <= range[1]; n++) out.push(n);
		return out;
	};
	const info = (key: FieldKey): FieldInfo => parsed[key]?.info ?? { star: true, step: null };

	return {
		ok: true,
		cron: {
			source,
			macro,
			withSeconds,
			timeZone,
			seconds: every('second', [0, 0]),
			minutes: every('minute', [0, 59]),
			hours: every('hour', [0, 23]),
			daysOfMonth: every('dayOfMonth', [1, 31]),
			months: every('month', [1, 12]),
			daysOfWeek: every('dayOfWeek', [0, 6]),
			fields: {
				second: withSeconds ? info('second') : { star: false, step: null },
				minute: info('minute'),
				hour: info('hour'),
				dayOfMonth: info('dayOfMonth'),
				month: info('month'),
				dayOfWeek: info('dayOfWeek'),
			},
		},
	};
}
