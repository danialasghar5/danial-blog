// Field validation shared by every tool (TOOLS_ROADMAP.md §10.2, §10.4).
// Pure functions: return results, never throw on user input.

export interface FieldError {
	field: string;
	message: string;
}

export type Result<T> = { ok: true; value: T; warnings: string[] } | { ok: false; errors: FieldError[] };

export const success = <T>(value: T, warnings: string[] = []): Result<T> => ({ ok: true, value, warnings });
export const failure = <T = never>(errors: FieldError[]): Result<T> => ({ ok: false, errors });

export interface NumberRule {
	field: string;
	label: string;
	min?: number;
	max?: number;
	/** true → whole numbers only. */
	integer?: boolean;
	/** true → empty input is allowed and yields `undefined`. */
	optional?: boolean;
	/** Exclusive lower bound (value must be > minExclusive). */
	minExclusive?: number;
}

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: FieldError };

/** Parse a numeric text field. Accepts "1,000", " 42 ", "1e3"; rejects NaN/Infinity. */
export function parseNumberField(raw: string | null | undefined, rule: NumberRule): FieldResult<number | undefined> {
	const text = (raw ?? '').trim().replace(/,(?=\d{3}(\D|$))/g, '');
	const err = (message: string): FieldResult<never> => ({ ok: false, error: { field: rule.field, message } });
	if (text === '') return rule.optional ? { ok: true, value: undefined } : err(`${rule.label} is required.`);
	if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return err(`${rule.label} must be a number.`);
	const value = Number(text);
	if (!Number.isFinite(value)) return err(`${rule.label} must be a finite number.`);
	if (rule.integer && !Number.isInteger(value)) return err(`${rule.label} must be a whole number.`);
	const range = describeRange(rule);
	if (rule.minExclusive !== undefined && !(value > rule.minExclusive)) return err(`${rule.label} must be greater than ${rule.minExclusive}.`);
	if (rule.min !== undefined && value < rule.min) return err(`${rule.label} must be ${range}.`);
	if (rule.max !== undefined && value > rule.max) return err(`${rule.label} must be ${range}.`);
	return { ok: true, value };
}

function describeRange(rule: NumberRule): string {
	const kind = rule.integer ? 'a whole number' : 'a number';
	if (rule.min !== undefined && rule.max !== undefined) return `${kind} from ${fmt(rule.min)} to ${fmt(rule.max)}`;
	if (rule.min !== undefined) return `${kind} of at least ${fmt(rule.min)}`;
	if (rule.max !== undefined) return `${kind} of at most ${fmt(rule.max)}`;
	return kind;
}
const fmt = (n: number) => n.toLocaleString('en-US');

/** Pick from a fixed set of allowed string values (selects, hash state). */
export function parseChoice<T extends string>(raw: string | null | undefined, allowed: readonly T[], field: string, label: string): FieldResult<T> {
	const v = (raw ?? '').trim();
	return (allowed as readonly string[]).includes(v)
		? { ok: true, value: v as T }
		: { ok: false, error: { field, message: `${label} must be one of: ${allowed.join(', ')}.` } };
}

/** Collect several field results into one Result, keeping every error. */
export function collect<T extends Record<string, unknown>>(fields: { [K in keyof T]: FieldResult<T[K]> }): Result<T> {
	const errors: FieldError[] = [];
	const value = {} as T;
	for (const key of Object.keys(fields) as (keyof T)[]) {
		const r = fields[key];
		if (r.ok) value[key] = r.value;
		else errors.push(r.error);
	}
	return errors.length ? failure(errors) : success(value);
}

/** Reject text inputs larger than `maxBytes` (UTF-8) before parsing them. */
export function checkSize(text: string, maxBytes: number, field: string, label: string): FieldResult<string> {
	const bytes = new TextEncoder().encode(text).length;
	return bytes <= maxBytes
		? { ok: true, value: text }
		: { ok: false, error: { field, message: `${label} is too large (${(bytes / 1e6).toFixed(1)} MB; limit ${(maxBytes / 1e6).toFixed(1)} MB).` } };
}
