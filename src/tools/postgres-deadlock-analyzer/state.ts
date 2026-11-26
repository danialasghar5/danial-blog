// The share link carries a summary only (TOOLS_ROADMAP.md §12.6): pattern,
// process count, table names and confidence. Never the statements or the log.
// Values are re-validated on load; anything unexpected is ignored.
import { decodeHashState } from '../_shared/hash-state.ts';
import { PATTERN_LABELS } from './classify.ts';
import type { Confidence, PatternId } from './classify.ts';

export const SHARE_KEYS = ['pattern', 'procs', 'tables', 'confidence'] as const;

const PATTERNS = Object.keys(PATTERN_LABELS) as PatternId[];
const CONFIDENCES: readonly Confidence[] = ['high', 'medium', 'low'];
const TABLE = /^[A-Za-z_][A-Za-z0-9_$]{0,62}$/;

export interface SharedSummary {
	pattern: PatternId;
	procs: number;
	tables: string[];
	confidence: Confidence;
}

export function readShareHash(hash: string): SharedSummary | null {
	const raw = decodeHashState(hash, SHARE_KEYS);
	if (!raw) return null;
	const pattern = PATTERNS.find((p) => p === raw.pattern);
	const confidence = CONFIDENCES.find((c) => c === raw.confidence);
	if (!pattern || !confidence) return null;
	if (!/^\d{1,3}$/.test(raw.procs ?? '')) return null;
	const procs = Number(raw.procs);
	if (procs < 2 || procs > 500) return null;
	const tables = raw.tables ? raw.tables.split(',') : [];
	if (tables.length > 10 || !tables.every((t) => TABLE.test(t))) return null;
	return { pattern, procs, tables, confidence };
}

export function summaryState(s: SharedSummary): Record<string, string | number> {
	return { pattern: s.pattern, procs: s.procs, tables: s.tables.join(','), confidence: s.confidence };
}

export function summaryText(s: SharedSummary): string {
	const tables = s.tables.length ? s.tables.join(', ') : 'not named';
	return `${PATTERN_LABELS[s.pattern]} · ${s.confidence} confidence · ${s.procs} processes · tables: ${tables}.`;
}
