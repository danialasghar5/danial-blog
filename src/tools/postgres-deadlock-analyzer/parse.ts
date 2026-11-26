// Parses Postgres deadlock reports (deadlock.c DeadLockReport, REL_13–17) from
// a server log, a Rails exception message, or a bare DETAIL block.
// Pure: no DOM, no network, no clock. Never throws on user input.
import { modeFromLogName } from '../_shared/pg-locks.ts';
import type { LockMode } from '../_shared/pg-locks.ts';
import type { InputForm, LockTarget, ParseOutcome, ParsedReport, TupleContext, TupleOp, WaitEdge, ProcessInfo } from './types.ts';

const LINE_SEP_2028 = String.fromCharCode(0x2028);
const LINE_SEP_2029 = String.fromCharCode(0x2029);

/**
 * Unescape JSON-style logs and error trackers, and normalise line breaks.
 * The unescape only runs when literal backslash-n breaks outnumber real ones (and there
 * are at least two), so one stray backslash-n in a SQL string leaves a multi-line log alone.
 */
export function normalizeInput(raw: string): string {
	let text = raw.replace(/\r\n?/g, '\n').split(LINE_SEP_2028).join('\n').split(LINE_SEP_2029).join('\n');
	const realBreaks = text.split('\n').length - 1;
	const literalBreaks = text.split('\\n').length - 1;
	if (literalBreaks >= 2 && literalBreaks > realBreaks && /\\(?:u[0-9a-fA-F]{4}|[nt"\\/])/.test(text)) {
		const simple: Record<string, string> = { n: '\n', t: '\t', '"': '"', '\\': '\\', '/': '/' };
		text = text.replace(/\\(u[0-9a-fA-F]{4}|[nt"\\/])/g, (_m, esc: string) =>
			esc[0] === 'u' ? String.fromCharCode(parseInt(esc.slice(1), 16)) : (simple[esc] ?? esc),
		);
	}
	return text;
}

/** Map one lock-target string (the text after "waits for <Mode> on") to a typed target. */
export function parseTarget(text: string): LockTarget {
	const raw = text.trim();
	const n = (s: string | undefined) => Number(s);
	const m = (re: RegExp) => re.exec(raw);
	let r: RegExpExecArray | null;
	if ((r = m(/^transaction (\d{1,10})$/))) return { kind: 'transaction', xid: n(r[1]), raw };
	if ((r = m(/^virtual transaction (\d{1,10})\/(\d{1,10})$/))) return { kind: 'virtual-transaction', procNumber: n(r[1]), localXid: n(r[2]), raw };
	if ((r = m(/^relation (\d{1,10}) of database (\d{1,10})$/))) return { kind: 'relation', relOid: n(r[1]), dbOid: n(r[2]), raw };
	if ((r = m(/^extension of relation (\d{1,10}) of database (\d{1,10})$/))) return { kind: 'extension', relOid: n(r[1]), dbOid: n(r[2]), raw };
	if ((r = m(/^page (\d{1,10}) of relation (\d{1,10}) of database (\d{1,10})$/))) return { kind: 'page', page: n(r[1]), relOid: n(r[2]), dbOid: n(r[3]), raw };
	if ((r = m(/^tuple \((\d{1,10}),(\d{1,10})\) of relation (\d{1,10}) of database (\d{1,10})$/)))
		return { kind: 'tuple', block: n(r[1]), offset: n(r[2]), relOid: n(r[3]), dbOid: n(r[4]), raw };
	if ((r = m(/^speculative token (\d{1,10}) of transaction (\d{1,10})$/))) return { kind: 'speculative-token', token: n(r[1]), xid: n(r[2]), raw };
	if ((r = m(/^object (\d{1,10}) of class (\d{1,10}) of database (\d{1,10})$/))) return { kind: 'object', objOid: n(r[1]), classOid: n(r[2]), dbOid: n(r[3]), raw };
	if ((r = m(/^advisory lock \[(\d{1,10}),(\d{1,10}),(\d{1,10}),(\d{1,10})\]$/)))
		return { kind: 'advisory', fields: [n(r[1]), n(r[2]), n(r[3]), n(r[4])] as const, raw };
	if ((r = m(/^user lock \[(\d{1,10}),(\d{1,10}),(\d{1,10})\]$/))) return { kind: 'user-lock', fields: [n(r[1]), n(r[2]), n(r[3])] as const, raw };
	return { kind: 'unparsed', raw };
}

const TUPLE_OP_PREFIXES: [string, TupleOp][] = [
	['while updating tuple ', 'update'],
	['while deleting tuple ', 'delete'],
	['while locking tuple ', 'lock'],
	['while locking updated version ', 'lock-updated'],
	['while inserting index tuple ', 'insert-index'],
	['while checking uniqueness of tuple ', 'unique-check'],
	['while rechecking updated tuple ', 'recheck'],
	['while checking exclusion constraint on tuple ', 'exclusion'],
];

/** CONTEXT lines (lmgr.c XactLockTableWaitErrorCb). Table names only appear here. */
export function parseTupleContext(line: string): TupleContext {
	const raw = line.trim();
	const hit = TUPLE_OP_PREFIXES.find(([prefix]) => raw.startsWith(prefix));
	const where = /\((\d+),(\d+)\)(?: of tuple)? in relation "((?:[^"]|"")+)"/.exec(raw);
	if (!hit || !where) return { op: 'other', relation: null, block: null, offset: null, raw };
	return {
		op: hit[1],
		block: Number(where[1]),
		offset: Number(where[2]),
		relation: where[3].replace(/""/g, '"'),
		raw,
	};
}

export const TUPLE_OP_LABELS: Record<TupleOp, string> = {
	update: 'updating a row',
	delete: 'deleting a row',
	lock: 'locking a row (SELECT … FOR UPDATE or similar)',
	'lock-updated': 'locking the newer version of a row that was updated',
	'insert-index': 'inserting an index entry that a concurrent insert is also writing',
	'unique-check': 'checking a unique index for a concurrent insert',
	recheck: 'rechecking an updated row (READ COMMITTED)',
	exclusion: 'checking an exclusion constraint',
	other: 'an operation the tool does not recognise',
};

// --- Line grouping ----------------------------------------------------------

interface Entry {
	section: string;
	text: string;
}

const MARKER = /^(?:.*?\s)?(ERROR|DETAIL|HINT|CONTEXT|STATEMENT|LOG|WARNING):[ \t]+(.*)$/;
const WAIT_LINE = /^Process (\d{1,10}) waits for (\w+) on (.+?); blocked by process (\d{1,10})\.?$/;
const QUERY_LINE = /^Process (\d{1,10}): ?([\s\S]*)$/;
const LOG_VICTIM = /^process (\d{1,10}) detected deadlock while waiting for (\w+) on (.+?) after [\d.]+ ms/;
const RAILS = /ActiveRecord::|PG::TRDeadlockDetected/;

/**
 * Turn lines into entries. A marker line (ERROR:, DETAIL:, …) starts an entry;
 * an unmarked line that starts a `Process N …` item starts an entry too;
 * anything else (indented or unindented continuation) is appended to the last one.
 */
function groupEntries(text: string): Entry[] {
	const out: Entry[] = [];
	let cur: Entry | null = null;
	for (const line of text.split('\n')) {
		if (line.trim() === '') continue;
		const unindented = /^\S/.test(line);
		const marker = unindented ? MARKER.exec(line) : null;
		if (marker) {
			cur = { section: marker[1], text: marker[2].trim() };
			out.push(cur);
		} else if (unindented && line.startsWith(': ')) {
			// ActiveRecord appends ": <sql>" to the message: the victim's statement.
			cur = { section: 'STATEMENT', text: line.slice(2).trim() };
			out.push(cur);
		} else if (/^\s*Process \d+(?: waits for |: ?)/.test(line)) {
			cur = { section: 'DETAIL', text: line.trim() };
			out.push(cur);
		} else if (cur) {
			cur.text += `\n${line.replace(/^\s+/, '')}`;
		} else {
			cur = { section: 'RAW', text: line.trim() };
			out.push(cur);
		}
	}
	return out;
}

function detectForm(text: string): InputForm {
	if (RAILS.test(text)) return 'rails';
	if (/(^|\s)(ERROR|LOG|STATEMENT|CONTEXT|HINT):/m.test(text)) return 'server-log';
	return 'detail';
}

// --- Cycle ------------------------------------------------------------------

/** Follow blockedBy links from each waiter; return the first closed loop, in wait order. */
export function findCycle(edges: readonly WaitEdge[]): number[] | null {
	const next = new Map<number, number>();
	for (const e of edges) if (!next.has(e.pid)) next.set(e.pid, e.blockedBy);
	for (const start of next.keys()) {
		const path = [start];
		let cur = start;
		for (;;) {
			const nxt = next.get(cur);
			if (nxt === undefined) break;
			if (nxt === start) return path;
			if (path.includes(nxt)) break;
			path.push(nxt);
			cur = nxt;
		}
	}
	return null;
}

// --- Parser -----------------------------------------------------------------

export function parseDeadlock(input: string): ParseOutcome {
	const text = normalizeInput(input);
	if (text.trim() === '') return { ok: false, message: notFound() };

	const form = detectForm(text);
	const warnings: string[] = [];
	const edges: WaitEdge[] = [];
	const queries = new Map<number, string>();
	const seenEdges = new Set<number>();
	let sawDeadlockError = false;
	let victim: ParsedReport['victim'] = null;
	let victimQuery: string | null = null;
	let context: TupleContext | null = null;

	for (const entry of groupEntries(text)) {
		const lines = entry.text.split('\n');
		const first = lines[0];
		const wait = WAIT_LINE.exec(first);
		if (wait) {
			const pid = Number(wait[1]);
			if (seenEdges.has(pid)) {
				warnings.push(`Process ${pid} appears in more than one wait line; the first one is used.`);
			} else {
				seenEdges.add(pid);
				const mode = modeFromLogName(wait[2]);
				const target = parseTarget(wait[3]);
				if (target.kind === 'unparsed') warnings.push(`Lock target "${target.raw}" is not a form this tool knows. It is kept as written.`);
				edges.push({ pid, modeName: wait[2], mode, target, blockedBy: Number(wait[4]) });
			}
			continue;
		}
		if (/^Process \d+ waits for /.test(first)) {
			warnings.push(`A wait line could not be read and was skipped: "${first.slice(0, 120)}".`);
			continue;
		}
		const query = QUERY_LINE.exec(first);
		if (query) {
			const pid = Number(query[1]);
			const body = [query[2], ...lines.slice(1)].join('\n').trim();
			if (!queries.has(pid) && body !== '') queries.set(pid, body);
			continue;
		}
		switch (entry.section) {
			case 'ERROR':
				if (/deadlock detected/i.test(entry.text)) sawDeadlockError = true;
				break;
			case 'LOG': {
				const v = LOG_VICTIM.exec(first);
				if (v) victim = { pid: Number(v[1]), waitingFor: `${v[2]} on ${v[3]}` };
				break;
			}
			case 'CONTEXT':
				if (context === null) context = parseTupleContext(entry.text);
				break;
			case 'STATEMENT':
				if (victimQuery === null && entry.text !== '') victimQuery = entry.text;
				break;
			default:
				break;
		}
	}

	if (!victim) {
		// Server logs with a [pid] in log_line_prefix: the ERROR line's pid is the victim.
		const prefixed = /\[(\d{1,10})\][^\n]*ERROR:[ \t]+deadlock detected/.exec(text);
		if (prefixed) victim = { pid: Number(prefixed[1]), waitingFor: null };
	}

	if (!sawDeadlockError && edges.length === 0) return { ok: false, message: notFound() };
	if (edges.length === 0) {
		return { ok: false, message: 'Found "deadlock detected" but no "Process N waits for …" lines. Paste the DETAIL lines too: the server log is the best source.' };
	}

	const cycle = findCycle(edges);
	if (cycle === null) {
		warnings.unshift('The wait lines do not close into a cycle. The report is probably truncated or incomplete. The processes found are shown, but the diagnosis is partial.');
	}

	const order = cycle ?? edges.map((e) => e.pid);
	const processes: ProcessInfo[] = order.map((pid) => {
		const edge = edges.find((e) => e.pid === pid) ?? null;
		return { pid, query: queries.get(pid) ?? null, edge };
	});
	// Processes that only appear as a blocker (no wait line of their own).
	for (const e of edges) {
		if (!processes.some((p) => p.pid === e.blockedBy)) {
			processes.push({ pid: e.blockedBy, query: queries.get(e.blockedBy) ?? null, edge: null });
		}
	}
	const hasQueries = processes.some((p) => p.query !== null);

	return {
		ok: true,
		report: {
			form,
			edges,
			processes,
			cycle,
			victim,
			victimQuery,
			context,
			hasQueries,
			warnings,
		},
	};
}

function notFound(): string {
	return [
		'No deadlock report found.',
		'Paste the server log entry that starts with "ERROR:  deadlock detected" (with its DETAIL lines), or the Rails message that starts with "ActiveRecord::Deadlocked".',
		'The lines that name the waiting processes ("Process N waits for …") are required.',
	].join(' ');
}
