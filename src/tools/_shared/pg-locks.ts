// Postgres lock semantics shared by #9 postgres-lock-modes, #8
// postgres-deadlock-analyzer and (later) #11 rails-safe-migration-checker.
//
// Source: PostgreSQL documentation, "13.3. Explicit Locking"
//   Table 13.2 "Conflicting Lock Modes" (table-level)
//   Table 13.3 "Conflicting Row-Level Locks"
//   https://www.postgresql.org/docs/17/explicit-locking.html
// Unchanged across Postgres 13–17 (TOOLS_ROADMAP.md A4: re-verify per major).

export const PG_DOCS_LOCKING = 'https://www.postgresql.org/docs/17/explicit-locking.html';

export const LOCK_MODES = [
	'ACCESS SHARE',
	'ROW SHARE',
	'ROW EXCLUSIVE',
	'SHARE UPDATE EXCLUSIVE',
	'SHARE',
	'SHARE ROW EXCLUSIVE',
	'EXCLUSIVE',
	'ACCESS EXCLUSIVE',
] as const;
export type LockMode = (typeof LOCK_MODES)[number];

/** Table 13.2, row by row: the modes each requested mode conflicts with. */
const TABLE_CONFLICTS: Record<LockMode, readonly LockMode[]> = {
	'ACCESS SHARE': ['ACCESS EXCLUSIVE'],
	'ROW SHARE': ['EXCLUSIVE', 'ACCESS EXCLUSIVE'],
	'ROW EXCLUSIVE': ['SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
	'SHARE UPDATE EXCLUSIVE': ['SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
	SHARE: ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
	'SHARE ROW EXCLUSIVE': ['ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
	EXCLUSIVE: ['ROW SHARE', 'ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE'],
	'ACCESS EXCLUSIVE': LOCK_MODES,
};

/** Does a request for `requested` wait behind a held `held` lock on the same table? */
export function tableLocksConflict(requested: LockMode, held: LockMode): boolean {
	return TABLE_CONFLICTS[requested].includes(held);
}

/** Modes that conflict with `mode` (in LOCK_MODES order). */
export function conflictingModes(mode: LockMode): LockMode[] {
	return LOCK_MODES.filter((m) => tableLocksConflict(mode, m));
}

/** The 8×8 matrix in LOCK_MODES order; true = conflict. */
export function conflictMatrix(): boolean[][] {
	return LOCK_MODES.map((r) => LOCK_MODES.map((h) => tableLocksConflict(r, h)));
}

/** Self-conflicting modes cannot be held by two transactions at once. */
export const isSelfConflicting = (mode: LockMode): boolean => tableLocksConflict(mode, mode);

export const ROW_LOCK_MODES = ['FOR KEY SHARE', 'FOR SHARE', 'FOR NO KEY UPDATE', 'FOR UPDATE'] as const;
export type RowLockMode = (typeof ROW_LOCK_MODES)[number];

/** Table 13.3. UPDATE that changes no key columns takes FOR NO KEY UPDATE; DELETE and key-changing UPDATE take FOR UPDATE. */
const ROW_CONFLICTS: Record<RowLockMode, readonly RowLockMode[]> = {
	'FOR KEY SHARE': ['FOR UPDATE'],
	'FOR SHARE': ['FOR NO KEY UPDATE', 'FOR UPDATE'],
	'FOR NO KEY UPDATE': ['FOR SHARE', 'FOR NO KEY UPDATE', 'FOR UPDATE'],
	'FOR UPDATE': ROW_LOCK_MODES,
};

export function rowLocksConflict(requested: RowLockMode, held: RowLockMode): boolean {
	return ROW_CONFLICTS[requested].includes(held);
}

// --- Names as they appear in server logs and pg_locks.mode --------------------
// A deadlock DETAIL line reads "Process 1201 waits for ShareLock on transaction
// 9001". The CamelCase name is the lock *mode*; what it means depends on the
// lock *target*:
//   relation R         → a table-level lock with the semantics above
//   transaction N      → waiting for transaction N to finish. Row-level
//                        conflicts surface this way: the waiter takes ShareLock
//                        on the holder's transaction id. Not a table lock.
//   tuple (b,o) of …   → the short-lived tuple lock taken while queueing for a
//                        row; the real wait is usually on the holder's transaction
//   advisory lock […]  → pg_advisory_lock family (ExclusiveLock / ShareLock)

const LOG_NAMES: Record<string, LockMode> = {
	AccessShareLock: 'ACCESS SHARE',
	RowShareLock: 'ROW SHARE',
	RowExclusiveLock: 'ROW EXCLUSIVE',
	ShareUpdateExclusiveLock: 'SHARE UPDATE EXCLUSIVE',
	ShareLock: 'SHARE',
	ShareRowExclusiveLock: 'SHARE ROW EXCLUSIVE',
	ExclusiveLock: 'EXCLUSIVE',
	AccessExclusiveLock: 'ACCESS EXCLUSIVE',
};

/** "ShareRowExclusiveLock" → "SHARE ROW EXCLUSIVE"; unknown names → null. */
export function modeFromLogName(name: string): LockMode | null {
	return LOG_NAMES[name.trim()] ?? null;
}

/** "SHARE ROW EXCLUSIVE" → "ShareRowExclusiveLock". */
export function logNameFromMode(mode: LockMode): string {
	return Object.keys(LOG_NAMES).find((k) => LOG_NAMES[k] === mode) as string;
}

export const LOCK_MODE_SUMMARY: Record<LockMode, string> = {
	'ACCESS SHARE': 'Taken by SELECT. Only blocked by ACCESS EXCLUSIVE.',
	'ROW SHARE': 'Taken by SELECT … FOR UPDATE / FOR NO KEY UPDATE / FOR SHARE / FOR KEY SHARE.',
	'ROW EXCLUSIVE': 'Taken by INSERT, UPDATE, DELETE and MERGE.',
	'SHARE UPDATE EXCLUSIVE': 'Taken by VACUUM, ANALYZE, CREATE INDEX CONCURRENTLY and some ALTER TABLE forms. Writes continue.',
	SHARE: 'Taken by CREATE INDEX (non-concurrent). Blocks writes, allows reads.',
	'SHARE ROW EXCLUSIVE': 'Taken by CREATE TRIGGER and ADD FOREIGN KEY. Blocks writes, self-conflicting.',
	EXCLUSIVE: 'Taken by REFRESH MATERIALIZED VIEW CONCURRENTLY. Only plain reads proceed.',
	'ACCESS EXCLUSIVE': 'Taken by DROP, TRUNCATE, VACUUM FULL, most ALTER TABLE forms and LOCK TABLE. Blocks everything, including SELECT.',
};
