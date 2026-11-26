// The stable projection pinned by fixtures/*.expected.json: the parse, then the
// diagnosis. Shared by fixtures.test.ts and by the one-off generator used to
// (re)write expected files after a hand-checked change.
import { classify } from './classify.ts';
import type { ParseOutcome } from './types.ts';

export function summarize(outcome: ParseOutcome) {
	if (!outcome.ok) return { ok: false, message: outcome.message };
	const r = outcome.report;
	const d = classify(r);
	return {
		ok: true,
		form: r.form,
		cycle: r.cycle,
		hasQueries: r.hasQueries,
		victim: r.victim,
		victimQuery: r.victimQuery,
		context: r.context && { op: r.context.op, relation: r.context.relation, block: r.context.block, offset: r.context.offset },
		edges: r.edges.map((e) => ({ pid: e.pid, modeName: e.modeName, mode: e.mode, target: { kind: e.target.kind, raw: e.target.raw }, blockedBy: e.blockedBy })),
		processes: r.processes.map((p) => ({ pid: p.pid, query: p.query })),
		warnings: r.warnings,
		diagnosis: {
			pattern: d.pattern,
			confidence: d.confidence,
			tables: d.tables,
			focusTable: d.focusTable,
			parentTable: d.parentTable,
			evidence: d.evidence,
			processes: d.processes.map((p) => ({ pid: p.pid, table: p.table, kind: p.kind, waitsFor: p.waitsFor })),
		},
	};
}
