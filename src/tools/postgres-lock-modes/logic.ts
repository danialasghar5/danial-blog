// Pure lookup and comparison logic for the lock-mode tool. No DOM, no Date.
import { LOCK_MODES, tableLocksConflict, conflictMatrix, rowLocksConflict, ROW_LOCK_MODES, type LockMode, type RowLockMode } from '../_shared/pg-locks.ts';
import { OPERATIONS, OPERATION_BY_ID, type Operation, type OperationLock } from './data.ts';

export const LOCK_QUEUE_NOTE =
	'Lock requests queue in arrival order. If an ACCESS EXCLUSIVE request is waiting behind a long-running SELECT, every later ACCESS SHARE request (every plain SELECT on that table) waits behind it, even though ACCESS SHARE does not conflict with the running SELECT. One slow query can stall the whole table, which is why migrations should set lock_timeout and retry.';

const norm = (s: string): string => s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

/** Case-insensitive substring search over label, id and aliases. Empty query returns everything. */
export function searchOperations(query: string): Operation[] {
	const q = norm(query ?? '');
	if (q === '') return [...OPERATIONS];
	return OPERATIONS.filter((o) => [o.label, o.id, ...o.aliases].some((text) => norm(text).includes(q)));
}

export function operationById(id: string): Operation | undefined {
	return OPERATION_BY_ID.get(id);
}

/** Kind of object a lock applies to: table-level locks compare with each other. */
const kindOf = (l: OperationLock): 'table' | 'index' => (l.object === 'index' ? 'index' : 'table');

export interface LockPair {
	/** Lock taken by the first operation (A). */
	held: OperationLock;
	/** Lock requested by the second operation (B). */
	requested: OperationLock;
	conflict: boolean;
}

export interface CompareResult {
	verdict: 'conflict' | 'no-conflict';
	/** Every same-kind lock pair considered. */
	pairs: LockPair[];
	/** Matrix cells (requested row, held column) to highlight. */
	cells: { requested: LockMode; held: LockMode }[];
	sentence: string;
	a: Operation;
	b: Operation;
}

/** Does B's lock wait behind A's? Pairs are compared only when they lock the same kind of object. */
export function compareOperations(aId: string, bId: string): CompareResult | null {
	const a = operationById(aId);
	const b = operationById(bId);
	if (!a || !b) return null;
	const pairs: LockPair[] = [];
	for (const held of a.locks) {
		for (const requested of b.locks) {
			if (kindOf(held) !== kindOf(requested)) continue;
			pairs.push({ held, requested, conflict: tableLocksConflict(requested.mode, held.mode) });
		}
	}
	const cells = pairs.map((p) => ({ requested: p.requested.mode, held: p.held.mode }));
	const hit = pairs.find((p) => p.conflict);
	if (hit) {
		return {
			verdict: 'conflict',
			pairs,
			cells,
			sentence: `${b.label} waits for ${a.label}: it asks for ${hit.requested.mode} on the ${hit.requested.object} while ${a.label} holds ${hit.held.mode}, and those two modes conflict.`,
			a,
			b,
		};
	}
	const sentence =
		pairs.length === 0
			? `No conflict: ${a.label} and ${b.label} lock different kinds of object, so neither waits for the other.`
			: `No conflict: none of ${b.label}'s table locks conflict with the ${a.label} lock.`;
	return { verdict: 'no-conflict', pairs, cells, sentence, a, b };
}

export interface MatrixRow {
	requested: LockMode;
	cells: boolean[];
}

/** The 8×8 table-level matrix in LOCK_MODES order (true = conflict). */
export function matrixRows(): MatrixRow[] {
	const m = conflictMatrix();
	return LOCK_MODES.map((requested, i) => ({ requested, cells: m[i] }));
}

/** The 4×4 row-level matrix in ROW_LOCK_MODES order. */
export function rowMatrixRows(): { requested: RowLockMode; cells: boolean[] }[] {
	return ROW_LOCK_MODES.map((requested) => ({ requested, cells: ROW_LOCK_MODES.map((held) => rowLocksConflict(requested, held)) }));
}
