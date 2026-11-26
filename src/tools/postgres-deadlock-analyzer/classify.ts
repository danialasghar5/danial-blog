// Classifies a parsed deadlock into one pattern with a confidence and the
// evidence used. Pure. Order of checks: advisory, explicit lock / DDL, foreign
// key, same-table row order, cross-table order, unknown.
import { LOCK_MODE_SUMMARY, tableLocksConflict } from '../_shared/pg-locks.ts';
import type { LockMode } from '../_shared/pg-locks.ts';
import { scanStatement } from './sql.ts';
import type { StatementInfo, StatementKind } from './sql.ts';
import type { LockTarget, ParsedReport, WaitEdge } from './types.ts';

export type PatternId = 'same-table-row-order' | 'cross-table-order' | 'foreign-key' | 'explicit-lock' | 'advisory' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low';

export const PATTERN_LABELS: Record<PatternId, string> = {
	'same-table-row-order': 'Same table, rows locked in opposite order',
	'cross-table-order': 'Tables locked in opposite order',
	'foreign-key': 'Foreign key: a child insert waits on a parent row',
	'explicit-lock': 'Table lock or DDL in the cycle',
	advisory: 'Advisory locks taken in opposite order',
	unknown: 'Cycle with no matching pattern',
};

export interface ProcessView {
	pid: number;
	/** Statement text when the report has it. */
	query: string | null;
	/** The table the statement works on, or the CONTEXT table for the victim. */
	table: string | null;
	kind: StatementKind | null;
	/** "ShareLock on transaction 4412" and so on. */
	waitsFor: string;
	blockedBy: number | null;
	/** What this wait means, in plain words. */
	explanation: string;
	/** True when this process raised the error (server log only). */
	victim: boolean;
}

export interface Diagnosis {
	pattern: PatternId;
	label: string;
	confidence: Confidence;
	evidence: string[];
	tables: string[];
	processes: ProcessView[];
	/** One note per lock kind in the cycle. */
	lockNotes: string[];
	/** The table or parent the fix should name first, when known. */
	focusTable: string | null;
	/** The FK parent table guessed from a *_id column, when pattern is foreign-key. */
	parentTable: string | null;
}

// --- Describing targets and waits -------------------------------------------

export function describeTarget(t: LockTarget): string {
	switch (t.kind) {
		case 'transaction':
			return `transaction ${t.xid}`;
		case 'virtual-transaction':
			return `virtual transaction ${t.procNumber}/${t.localXid}`;
		case 'relation':
			return `relation OID ${t.relOid} (database ${t.dbOid})`;
		case 'extension':
			return `extension of relation OID ${t.relOid}`;
		case 'page':
			return `page ${t.page} of relation OID ${t.relOid}`;
		case 'tuple':
			return `tuple (${t.block},${t.offset}) of relation OID ${t.relOid}`;
		case 'speculative-token':
			return `speculative token ${t.token} of transaction ${t.xid}`;
		case 'object':
			return `object OID ${t.objOid} (class ${t.classOid})`;
		case 'advisory':
			return `advisory lock [${t.fields.join(',')}]`;
		case 'user-lock':
			return `user lock [${t.fields.join(',')}]`;
		case 'unparsed':
			return t.raw;
	}
}

export function explainWait(e: WaitEdge): string {
	const t = e.target;
	switch (t.kind) {
		case 'transaction':
			return `Waiting for transaction ${t.xid} to finish. This is how a row conflict appears: the other transaction holds the row. It is not a table lock.`;
		case 'tuple':
			return `${e.modeName} on a tuple is a short queue lock taken while waiting for a row. The real wait is on the transaction that holds that row.`;
		case 'relation':
		case 'extension':
			if (t.kind === 'extension') return 'Waiting while another session extends the table with new pages. Usually short, and common under heavy inserts.';
			return e.mode ? `Table-level ${e.mode.toLowerCase()} lock. ${LOCK_MODE_SUMMARY[e.mode]} The table name is not in the report, only its OID.` : `Table-level lock in mode ${e.modeName}, which this tool does not know.`;
		case 'advisory':
			return 'An application lock from pg_advisory_lock and its relatives. Postgres only sees the key numbers, so the statement text is the only clue to what the key means.';
		case 'user-lock':
			return 'An application lock from the advisory family, identified by three numbers.';
		case 'virtual-transaction':
			return "Waiting for another session's virtual transaction to end, usually a DDL step or an old snapshot. Not a row lock.";
		case 'speculative-token':
			return 'Waiting for an INSERT … ON CONFLICT that is still inserting the row.';
		case 'page':
			return 'Waiting on a page-level lock. Rare, and usually part of an index operation.';
		case 'object':
			return 'Waiting on a lock on a database object, such as a function or schema object.';
		case 'unparsed':
			return 'This lock target is not one this tool knows. It is shown as written.';
	}
}

// --- Classification ---------------------------------------------------------

/** Table-level mode a DML or read statement holds on its tables. */
function heldModeOf(kind: StatementKind | null): LockMode | null {
	switch (kind) {
		case 'insert':
		case 'update':
		case 'delete':
			return 'ROW EXCLUSIVE';
		case 'select-lock':
			return 'ROW SHARE';
		case 'select':
			return 'ACCESS SHARE';
		default:
			return null;
	}
}

const ROW_WRITERS: readonly StatementKind[] = ['update', 'delete', 'select-lock'];
const rowLevel = (e: WaitEdge) => e.target.kind === 'transaction' || e.target.kind === 'tuple';

interface Proc {
	pid: number;
	query: string | null;
	info: StatementInfo | null;
	edge: WaitEdge | null;
	victim: boolean;
}

export function classify(report: ParsedReport): Diagnosis {
	const cycleSet = new Set(report.cycle ?? report.edges.map((e) => e.pid));
	const edges = report.edges.filter((e) => cycleSet.has(e.pid));
	const victimPid = report.victim?.pid ?? null;
	const victimInfo = report.victimQuery ? scanStatement(report.victimQuery) : null;
	const contextTable = report.context?.relation ?? null;

	const procs: Proc[] = report.processes.map((p) => {
		const info = p.query !== null ? scanStatement(p.query) : p.pid === victimPid && victimInfo ? victimInfo : null;
		return { pid: p.pid, query: p.query ?? (p.pid === victimPid ? report.victimQuery : null), info, edge: p.edge, victim: p.pid === victimPid };
	});

	const tableOf = (p: Proc): string | null => p.info?.tables[0] ?? (p.victim ? contextTable : null);
	const knownTables = new Set<string>();
	for (const p of procs) for (const t of p.info?.tables ?? []) knownTables.add(t);
	if (contextTable) knownTables.add(contextTable);
	for (const t of victimInfo?.tables ?? []) knownTables.add(t);
	const allKnown = procs.length > 0 && procs.every((p) => p.info !== null);
	const someKnown = procs.some((p) => p.info !== null);

	const evidence: string[] = [];
	const verdict = pickPattern(report, edges, procs, knownTables, allKnown, someKnown, contextTable, victimInfo?.tables ?? [], evidence);

	const processes: ProcessView[] = procs.map((p) => ({
		pid: p.pid,
		query: p.query,
		table: tableOf(p),
		kind: p.info?.kind ?? null,
		waitsFor: p.edge ? `${p.edge.modeName} on ${describeTarget(p.edge.target)}` : '—',
		blockedBy: p.edge?.blockedBy ?? null,
		explanation: p.edge ? explainWait(p.edge) : 'No wait line for this process in the report.',
		victim: p.victim,
	}));

	const seen = new Set<string>();
	const lockNotes: string[] = [];
	for (const e of edges) {
		const key = e.target.kind === 'relation' ? `relation:${e.modeName}` : e.target.kind;
		if (seen.has(key)) continue;
		seen.add(key);
		lockNotes.push(`${e.modeName} on ${describeTarget(e.target)}: ${explainWait(e)}`);
	}

	// A cycle that does not close is partial input: never more than low confidence.
	let confidence = verdict.confidence;
	if (report.cycle === null && confidence !== 'low') {
		confidence = 'low';
		evidence.unshift('The wait lines do not close into a cycle, so confidence is capped at low.');
	}

	return {
		pattern: verdict.pattern,
		label: PATTERN_LABELS[verdict.pattern],
		confidence,
		evidence,
		tables: [...knownTables],
		processes,
		lockNotes,
		focusTable: verdict.focusTable,
		parentTable: verdict.parentTable,
	};
}

interface Verdict {
	pattern: PatternId;
	confidence: Confidence;
	focusTable: string | null;
	parentTable: string | null;
}

function pickPattern(
	report: ParsedReport,
	edges: WaitEdge[],
	procs: Proc[],
	knownTables: Set<string>,
	allKnown: boolean,
	someKnown: boolean,
	contextTable: string | null,
	victimTables: string[],
	evidence: string[],
): Verdict {
	const none = { focusTable: null, parentTable: null };

	// 1. Advisory locks.
	const advisory = edges.filter((e) => e.target.kind === 'advisory');
	if (advisory.length > 0) {
		for (const e of advisory) evidence.push(`Process ${e.pid} waits for ${e.modeName} on ${describeTarget(e.target)}.`);
		for (const p of procs) if (p.query && /advisory/i.test(p.query)) evidence.push(`Process ${p.pid} runs: ${p.query}`);
		return { pattern: 'advisory', confidence: advisory.length === edges.length ? 'high' : 'medium', ...none };
	}

	// 2. Table-level locks and DDL.
	const relationEdges = edges.filter((e) => e.target.kind === 'relation' || e.target.kind === 'extension');
	const ddl = procs.filter((p) => p.info?.kind === 'ddl');
	if (relationEdges.length > 0 || ddl.length > 0) {
		for (const e of relationEdges) {
			evidence.push(`Process ${e.pid} waits for ${e.modeName} on ${describeTarget(e.target)}.`);
		}
		for (const d of ddl) evidence.push(`Process ${d.pid} runs ${d.info?.ddl ?? 'a DDL statement'} on ${d.info?.tables[0] ?? 'a table'}.`);
		// Does the table lock conflict with a lock another cycle member holds on the same table?
		for (const e of relationEdges) {
			const waiter = procs.find((p) => p.pid === e.pid);
			const table = waiter?.info?.tables[0];
			if (!e.mode || !table) continue;
			for (const other of procs) {
				if (other.pid === e.pid || !other.info?.tables.includes(table)) continue;
				const held = heldModeOf(other.info.kind);
				if (held && tableLocksConflict(e.mode, held)) {
					evidence.push(`${e.mode} conflicts with ${held}, which process ${other.pid} holds on ${table} (table-lock conflict matrix).`);
				}
			}
		}
		if (relationEdges.length > 0 && ddl.length > 0) {
			return { pattern: 'explicit-lock', confidence: 'high', focusTable: ddl[0].info?.tables[0] ?? null, parentTable: null };
		}
		return { pattern: 'explicit-lock', confidence: 'medium', focusTable: ddl[0]?.info?.tables[0] ?? null, parentTable: null };
	}

	// 3. Foreign key: an INSERT whose *_id column points at a table another process writes.
	for (const p of procs) {
		if (p.info?.kind !== 'insert') continue;
		for (const col of p.info.columns) {
			if (!/_id$/.test(col) || col === 'id') continue;
			const base = col.slice(0, -3);
			const parent = `${base}s`;
			const candidates = [parent, base];
			const writer = procs.find((q) => q.pid !== p.pid && q.info !== null && q.info.tables.some((t) => candidates.includes(t)) && ROW_WRITERS.includes(q.info.kind));
			const child = p.info.tables[0];
			evidence.push(`Process ${p.pid} inserts into ${child} with ${col}, which references a parent table through a foreign key.`);
			if (writer) {
				const parentName = writer.info?.tables.find((t) => candidates.includes(t)) ?? parent;
				evidence.push(`Process ${writer.pid} ${writer.info?.kind} rows in ${parentName}, the parent, in the same cycle.`);
				return { pattern: 'foreign-key', confidence: 'high', focusTable: child ?? null, parentTable: parentName };
			}
			evidence.push(`The parent table is not in the report, so the foreign key is inferred from the column name. The wait on a transaction fits a foreign-key check against a row another transaction holds.`);
			return { pattern: 'foreign-key', confidence: 'medium', focusTable: child ?? null, parentTable: parent };
		}
	}

	// 4. Same table: every waiter is on a row, and they all touch one table.
	const rowOnly = edges.length > 0 && edges.every(rowLevel);
	if (rowOnly && knownTables.size === 1) {
		const [table] = [...knownTables];
		if (allKnown && procs.every((p) => p.info && ROW_WRITERS.includes(p.info.kind))) {
			for (const p of procs) evidence.push(`Process ${p.pid} ${p.info?.kind === 'select-lock' ? 'locks' : 'writes'} rows in ${table}.`);
			const waits = edges.map((e) => `${e.pid} waits on ${e.blockedBy === e.pid ? 'itself' : `a row that ${e.blockedBy} holds`}`);
			evidence.push(`${waits.join('; ')}.`);
			return { pattern: 'same-table-row-order', confidence: 'high', focusTable: table, parentTable: null };
		}
		if (someKnown || (contextTable === table && victimTables.includes(table))) {
			evidence.push(`Both waits are row-level, and the statements in the report all touch ${table}.`);
			evidence.push('Not every process has its statement in the report, so the row order is inferred.');
			return { pattern: 'same-table-row-order', confidence: 'medium', focusTable: table, parentTable: null };
		}
	}

	// 5. Cross-table: different tables in each process's statement.
	if (knownTables.size >= 2) {
		for (const p of procs) if (p.info?.tables.length) evidence.push(`Process ${p.pid} works on ${p.info.tables.join(', ')}.`);
		evidence.push('Each process holds a row or lock on one table and waits for the other. Only the current statement of each process is in the report, so the earlier lock order is inferred.');
		return { pattern: 'cross-table-order', confidence: 'medium', focusTable: [...knownTables][0] ?? null, parentTable: null };
	}

	evidence.push('No single pattern fits. The lock modes and targets are still explained below.');
	return { pattern: 'unknown', confidence: 'low', ...none };
}
