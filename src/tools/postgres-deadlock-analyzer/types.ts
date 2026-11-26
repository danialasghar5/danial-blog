// Shared types for the deadlock analyzer. Erasable TypeScript only (no enums).
import type { LockMode } from '../_shared/pg-locks.ts';

/** Where the pasted text most likely came from. */
export type InputForm = 'rails' | 'server-log' | 'detail';

/**
 * The lock target after `waits for <Mode> on`. Postgres prints OIDs, not names
 * (lmgr.c DescribeLockTag). Anything not listed here is kept as `unparsed`.
 */
export type LockTarget =
	| { kind: 'transaction'; xid: number; raw: string }
	| { kind: 'virtual-transaction'; procNumber: number; localXid: number; raw: string }
	| { kind: 'relation'; relOid: number; dbOid: number; raw: string }
	| { kind: 'extension'; relOid: number; dbOid: number; raw: string }
	| { kind: 'page'; page: number; relOid: number; dbOid: number; raw: string }
	| { kind: 'tuple'; block: number; offset: number; relOid: number; dbOid: number; raw: string }
	| { kind: 'speculative-token'; token: number; xid: number; raw: string }
	| { kind: 'object'; objOid: number; classOid: number; dbOid: number; raw: string }
	| { kind: 'advisory'; fields: readonly [number, number, number, number]; raw: string }
	| { kind: 'user-lock'; fields: readonly [number, number, number]; raw: string }
	| { kind: 'unparsed'; raw: string };

export interface WaitEdge {
	/** The waiting process. */
	pid: number;
	/** Mode name as printed, e.g. "ShareLock". */
	modeName: string;
	/** Table-lock mode, or null when the name is not a known Postgres mode. */
	mode: LockMode | null;
	target: LockTarget;
	/** The process that holds what `pid` wants. */
	blockedBy: number;
}

export interface ProcessInfo {
	pid: number;
	/** Statement text: from `Process N: …` (server log) or the victim's SQL tail. Null if absent. */
	query: string | null;
	/** The wait line for this process, if the report had one. */
	edge: WaitEdge | null;
}

/** Operation the reporting process was doing, from a CONTEXT line. */
export type TupleOp =
	| 'update'
	| 'delete'
	| 'lock'
	| 'lock-updated'
	| 'insert-index'
	| 'unique-check'
	| 'recheck'
	| 'exclusion'
	| 'other';

export interface TupleContext {
	op: TupleOp;
	/** Table name exactly as printed (quotes removed, "" unescaped). Null for `other`. */
	relation: string | null;
	block: number | null;
	offset: number | null;
	raw: string;
}

export interface ParsedReport {
	form: InputForm;
	/** Deduplicated wait edges, in the order they appeared. */
	edges: WaitEdge[];
	/** One entry per process in the report (cycle order when the cycle closes). */
	processes: ProcessInfo[];
	/** Process ids in wait order when the cycle closes; null when it does not. */
	cycle: number[] | null;
	/** The process that raised the error: from the LOG "detected deadlock" line or a [pid] log prefix. */
	victim: { pid: number; waitingFor: string | null } | null;
	/** The victim's SQL: STATEMENT in the server log, or the trailing ": SQL" of a Rails message. */
	victimQuery: string | null;
	context: TupleContext | null;
	/** Whether any process had statement text. */
	hasQueries: boolean;
	warnings: string[];
}

export type ParseOutcome = { ok: true; report: ParsedReport } | { ok: false; message: string };
