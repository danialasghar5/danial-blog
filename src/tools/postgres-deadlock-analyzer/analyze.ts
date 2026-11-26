// The single entry point: size check → parse → classify → fixes → plain-language
// output. Pure. The worker and the tests both call analyzeReport().
import { parseDeadlock, TUPLE_OP_LABELS } from './parse.ts';
import { classify, PATTERN_LABELS } from './classify.ts';
import type { Confidence, PatternId, ProcessView } from './classify.ts';
import { fixesFor } from './fixes.ts';
import type { Fix } from './fixes.ts';
import { checkReportSize } from './limits.ts';
import type { InputForm } from './types.ts';

export interface AnalysisSuccess {
	ok: true;
	pattern: PatternId;
	label: string;
	confidence: Confidence;
	headline: string;
	narrative: string[];
	evidence: string[];
	processes: ProcessView[];
	tables: string[];
	cycle: number[] | null;
	warnings: string[];
	lockNotes: string[];
	fixes: Fix[];
	form: InputForm;
	victim: { pid: number; waitingFor: string | null } | null;
	/** Show the consulting CTA: 3+ processes or 2+ tables. */
	cta: boolean;
	tone?: 'risk';
	/** Plain-text version for Copy. */
	text: string;
	/** Share-link summary only. Never the raw log. */
	state: { pattern: string; procs: number; tables: string; confidence: string };
}

export interface AnalysisFailure {
	ok: false;
	message: string;
}

export type AnalysisResult = AnalysisSuccess | AnalysisFailure;

const VERDICT: Record<PatternId, string> = {
	'same-table-row-order': 'Both processes change rows in the same table, in opposite orders. Each holds a row the other needs.',
	'cross-table-order': 'The processes take locks on different tables in opposite orders.',
	'foreign-key': 'A child row insert waits on a parent row that another transaction holds, while that transaction waits on the insert.',
	'explicit-lock': 'A table-level lock is part of the cycle. DDL and long transactions usually cause these.',
	advisory: 'Application (advisory) locks are taken in opposite orders.',
	unknown: 'The pattern is not one this tool recognises. The lock notes below still explain each wait.',
};

function shorten(sql: string, max = 110): string {
	const one = sql.replace(/\s+/g, ' ').trim();
	return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

export function analyzeReport(input: string): AnalysisResult {
	const size = checkReportSize(input);
	if (!size.ok) return { ok: false, message: size.error.message };

	const parsed = parseDeadlock(input);
	if (!parsed.ok) return { ok: false, message: parsed.message };
	const report = parsed.report;
	const diag = classify(report);
	const fixes = fixesFor({ pattern: diag.pattern, focusTable: diag.focusTable, parentTable: diag.parentTable, tables: diag.tables });

	const narrative: string[] = [];
	if (report.cycle) {
		narrative.push(`Postgres found a cycle of ${report.cycle.length} processes: ${[...report.cycle, report.cycle[0]].join(' → ')}.`);
	} else {
		narrative.push('The wait lines do not close into a cycle, so the report is partial. The processes below are the ones that were found.');
	}
	for (const p of diag.processes) {
		if (p.blockedBy === null) continue;
		const doing = p.query ? `was running ${shorten(p.query)}` : 'has no statement in the report';
		narrative.push(`Process ${p.pid} ${doing} and waits for ${p.waitsFor.replace(/^\S+ on /, '')}, which process ${p.blockedBy} holds.`);
	}
	if (report.victim) {
		const op = report.context && report.context.op !== 'other' ? ` while ${TUPLE_OP_LABELS[report.context.op]}${report.context.relation ? ` in ${report.context.relation}` : ''}` : '';
		narrative.push(`Process ${report.victim.pid} detected the cycle and was aborted${op}.`);
	} else {
		narrative.push('Postgres aborted one process in the cycle. A pasted client message does not say which one; the server log does.');
	}
	narrative.push(VERDICT[diag.pattern]);

	const text = plainText({
		headline: `${diag.label} (${diag.confidence} confidence)`,
		narrative,
		evidence: diag.evidence,
		processes: diag.processes,
		lockNotes: diag.lockNotes,
		warnings: report.warnings,
	});

	return {
		ok: true,
		pattern: diag.pattern,
		label: PATTERN_LABELS[diag.pattern],
		confidence: diag.confidence,
		headline: `${PATTERN_LABELS[diag.pattern]} · ${diag.confidence} confidence`,
		narrative,
		evidence: diag.evidence,
		processes: diag.processes,
		tables: diag.tables,
		cycle: report.cycle,
		warnings: report.warnings,
		lockNotes: diag.lockNotes,
		fixes,
		form: report.form,
		victim: report.victim,
		cta: report.processes.length >= 3 || diag.tables.length >= 2,
		tone: report.cycle ? 'risk' : undefined,
		text,
		state: { pattern: diag.pattern, procs: report.processes.length, tables: diag.tables.join(','), confidence: diag.confidence },
	};
}

function plainText(parts: {
	headline: string;
	narrative: string[];
	evidence: string[];
	processes: ProcessView[];
	lockNotes: string[];
	warnings: string[];
}): string {
	const lines = [parts.headline, '', ...parts.narrative, ''];
	if (parts.warnings.length) lines.push('Warnings:', ...parts.warnings.map((w) => `- ${w}`), '');
	lines.push('Evidence:', ...parts.evidence.map((e) => `- ${e}`), '');
	lines.push('Processes:');
	for (const p of parts.processes) {
		lines.push(`- ${p.pid}${p.victim ? ' (aborted)' : ''}: waits for ${p.waitsFor}${p.blockedBy !== null ? `, blocked by ${p.blockedBy}` : ''}${p.table ? `; table ${p.table}` : ''}${p.query ? `; ${shorten(p.query, 200)}` : ''}`);
	}
	lines.push('', 'Lock notes:', ...parts.lockNotes.map((n) => `- ${n}`));
	return lines.join('\n');
}
