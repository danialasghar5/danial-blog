// Input size cap, enforced in the widget and again in the worker (TOOLS_ROADMAP.md §10.3).
import type { FieldResult } from '../_shared/validate.ts';

export const MAX_REPORT_BYTES = 5_000_000;

export function checkReportSize(text: string): FieldResult<string> {
	const bytes = new TextEncoder().encode(text).length;
	if (bytes <= MAX_REPORT_BYTES) return { ok: true, value: text };
	return {
		ok: false,
		error: {
			field: 'report',
			message: 'The pasted text is over 5 MB. Paste only the deadlock block: the ERROR, DETAIL, CONTEXT and STATEMENT lines.',
		},
	};
}
