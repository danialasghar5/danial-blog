// Display formatting shared by tools. Pure; locale fixed to en-US so output is
// deterministic in tests and matches the site's English copy.

const nf = (maxFrac: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFrac });

/** 1234.567 → "1,234.57". Never returns "NaN"/"Infinity": non-finite → "—". */
export function formatNumber(n: number, maxFrac = 2): string {
	return Number.isFinite(n) ? nf(maxFrac).format(n) : '—';
}

/** 0.8532 → "85.3%". */
export function formatPercent(ratio: number, maxFrac = 1): string {
	return Number.isFinite(ratio) ? `${nf(maxFrac).format(ratio * 100)}%` : '—';
}

/**
 * Seconds → compact human duration: 0.25 → "250 ms", 75 → "1m 15s",
 * 1763395 → "20d 9h 49m". Shows at most `parts` units.
 */
export function formatDuration(seconds: number, parts = 3): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '—';
	if (seconds < 1) return `${formatNumber(seconds * 1000, seconds < 0.01 ? 2 : 0)} ms`;
	if (seconds < 60) return `${formatNumber(seconds, seconds < 10 ? 2 : 1)} s`;
	const units: [string, number][] = [
		['d', 86400],
		['h', 3600],
		['m', 60],
		['s', 1],
	];
	let rest = Math.round(seconds);
	const out: string[] = [];
	for (const [label, size] of units) {
		const n = Math.floor(rest / size);
		rest -= n * size;
		if (n > 0 || out.length > 0) out.push(`${n}${label}`);
	}
	const shown = out.slice(0, parts);
	while (shown.length > 1 && shown[shown.length - 1].startsWith('0')) shown.pop();
	return shown.join(' ');
}

/** Date → "Thu, 26 Nov 2026, 14:05" in the given IANA time zone. */
export function formatDateTime(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone,
		weekday: 'short',
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).format(date);
}

/** True when `tz` is an IANA zone the runtime understands. */
export function isValidTimeZone(tz: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}
