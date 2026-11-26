import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCycle, normalizeInput, parseDeadlock, parseTarget, parseTupleContext } from './parse.ts';
import { checkReportSize, MAX_REPORT_BYTES } from './limits.ts';
import type { ParsedReport } from './types.ts';

const SEP_2028 = String.fromCharCode(0x2028);

function report(text: string): ParsedReport {
	const out = parseDeadlock(text);
	if (!out.ok) assert.fail(`expected a report, got: ${out.message}`);
	return out.report;
}

const CLIENT = [
	'ERROR:  deadlock detected',
	'DETAIL:  Process 1201 waits for ShareLock on transaction 9001; blocked by process 1202.',
	'         Process 1202 waits for ShareLock on transaction 9000; blocked by process 1201.',
	'HINT:  See server log for query details.',
	'CONTEXT:  while updating tuple (0,7) in relation "accounts"',
].join('\n');

test('parseTarget: every OID form from lmgr.c DescribeLockTag', () => {
	assert.deepEqual(parseTarget('transaction 9001'), { kind: 'transaction', xid: 9001, raw: 'transaction 9001' });
	assert.deepEqual(parseTarget('relation 16420 of database 16384'), { kind: 'relation', relOid: 16420, dbOid: 16384, raw: 'relation 16420 of database 16384' });
	assert.equal(parseTarget('extension of relation 16420 of database 16384').kind, 'extension');
	assert.equal(parseTarget('page 3 of relation 16420 of database 16384').kind, 'page');
	assert.deepEqual(parseTarget('tuple (0,4) of relation 16402 of database 16384'), {
		kind: 'tuple',
		block: 0,
		offset: 4,
		relOid: 16402,
		dbOid: 16384,
		raw: 'tuple (0,4) of relation 16402 of database 16384',
	});
	assert.deepEqual(parseTarget('virtual transaction 3/1182'), { kind: 'virtual-transaction', procNumber: 3, localXid: 1182, raw: 'virtual transaction 3/1182' });
	assert.equal(parseTarget('speculative token 5 of transaction 900').kind, 'speculative-token');
	assert.equal(parseTarget('object 16500 of class 1259 of database 16384').kind, 'object');
	assert.deepEqual(parseTarget('advisory lock [16384,0,4001,1]'), {
		kind: 'advisory',
		fields: [16384, 0, 4001, 1],
		raw: 'advisory lock [16384,0,4001,1]',
	});
	assert.equal(parseTarget('user lock [1,2,3]').kind, 'user-lock');
});

test('parseTarget: unknown forms are kept raw, marked unparsed, never throw', () => {
	for (const text of ['pg_database.datfrozenxid of database 1', 'something new in 19', '', 'tuple (x,y) of relation 1 of database 2']) {
		const t = parseTarget(text);
		assert.equal(t.kind, 'unparsed');
		assert.equal(t.raw, text.trim());
	}
});

test('parseTupleContext: each operation, quoted and escaped table names', () => {
	const cases: [string, string, string | null][] = [
		['while updating tuple (0,7) in relation "accounts"', 'update', 'accounts'],
		['while deleting tuple (2,1) in relation "order_items"', 'delete', 'order_items'],
		['while locking tuple (0,4) in relation "orders"', 'lock', 'orders'],
		['while locking updated version (0,9) of tuple in relation "accounts"', 'lock-updated', 'accounts'],
		['while inserting index tuple (1,1) in relation "users_email_idx"', 'insert-index', 'users_email_idx'],
		['while checking uniqueness of tuple (0,3) in relation "users"', 'unique-check', 'users'],
		['while rechecking updated tuple (0,3) in relation "users"', 'recheck', 'users'],
		['while checking exclusion constraint on tuple (0,3) in relation "bookings"', 'exclusion', 'bookings'],
		['while updating tuple (0,1) in relation "say ""hi"""', 'update', 'say "hi"'],
		['while scanning something strange', 'other', null],
	];
	for (const [line, op, relation] of cases) {
		const c = parseTupleContext(line);
		assert.equal(c.op, op, line);
		assert.equal(c.relation, relation, line);
	}
});

test('normalizeInput: unescapes JSON-style newlines and quotes once', () => {
	const out = normalizeInput('ERROR:  deadlock detected\\nDETAIL:  x \\"y\\"\\nHINT:  h');
	assert.equal(out, 'ERROR:  deadlock detected\nDETAIL:  x "y"\nHINT:  h');
});

test('normalizeInput: leaves a multi-line log alone, and treats U+2028 as a break', () => {
	const multi = "ERROR:  deadlock detected\nSTATEMENT:  SELECT 'a\\nb'";
	assert.equal(normalizeInput(multi), multi);
	assert.equal(normalizeInput(`ERROR:  one${SEP_2028}DETAIL:  two`), 'ERROR:  one\nDETAIL:  two');
});

test('findCycle: two- and three-process loops, open chains return null', () => {
	const edge = (pid: number, blockedBy: number) => ({ pid, blockedBy, modeName: 'ShareLock', mode: 'SHARE' as const, target: { kind: 'unparsed' as const, raw: '' } });
	assert.deepEqual(findCycle([edge(1, 2), edge(2, 1)]), [1, 2]);
	assert.deepEqual(findCycle([edge(2, 3), edge(3, 1), edge(1, 2)]), [2, 3, 1]);
	assert.equal(findCycle([edge(1, 2), edge(2, 3)]), null);
});

test('client message: wait lines and CONTEXT only, no statements, still classifiable inputs', () => {
	const r = report(CLIENT);
	assert.equal(r.form, 'server-log');
	assert.deepEqual(r.cycle, [1201, 1202]);
	assert.equal(r.hasQueries, false);
	assert.equal(r.context?.relation, 'accounts');
	assert.equal(r.edges[0].mode, 'SHARE');
});

test('Rails message: trailing ": SQL" line is the victim statement', () => {
	const rails = 'ActiveRecord::Deadlocked: PG::TRDeadlockDetected: ERROR:  deadlock detected\nDETAIL:  Process 1 waits for ShareLock on transaction 5; blocked by process 2.\n         Process 2 waits for ShareLock on transaction 4; blocked by process 1.\nCONTEXT:  while updating tuple (0,7) in relation "accounts"\n: UPDATE "accounts" SET "balance" = $1 WHERE "accounts"."id" = $2';
	const r = report(rails);
	assert.equal(r.form, 'rails');
	assert.equal(r.victimQuery, 'UPDATE "accounts" SET "balance" = $1 WHERE "accounts"."id" = $2');
	assert.equal(r.victim, null);
});

test('bare DETAIL block without an ERROR line is accepted', () => {
	const r = report('Process 7 waits for ExclusiveLock on tuple (0,2) of relation 16402 of database 16384; blocked by process 8.\nProcess 8 waits for ShareLock on transaction 77; blocked by process 7.');
	assert.equal(r.form, 'detail');
	assert.deepEqual(r.cycle, [7, 8]);
	assert.deepEqual(r.warnings, []);
});

test('server log: victim from the LOG line and from a [pid] prefix; statements per process', () => {
	const r = report(
		[
			'2026-11-20 14:10:02.901 UTC [5521] app_rw@accounts_prod LOG:  process 5521 detected deadlock while waiting for ShareLock on transaction 3340 after 1000.087 ms',
			'2026-11-20 14:10:02.902 UTC [5521] app_rw@accounts_prod ERROR:  deadlock detected',
			'2026-11-20 14:10:02.902 UTC [5521] app_rw@accounts_prod DETAIL:  Process 5521 waits for ShareLock on transaction 3340; blocked by process 5530.',
			'\tProcess 5530 waits for ShareLock on transaction 3338; blocked by process 5521.',
			'\tProcess 5521: UPDATE accounts SET balance = balance - 100',
			'\t    WHERE id = 9',
			'\tProcess 5530: UPDATE accounts SET balance = balance + 100 WHERE id = 3',
		].join('\n'),
	);
	assert.deepEqual(r.victim, { pid: 5521, waitingFor: 'ShareLock on transaction 3340' });
	assert.equal(r.processes[0].query, 'UPDATE accounts SET balance = balance - 100\nWHERE id = 9');
	const fromPrefix = report('2026-11-20 14:10:02.902 UTC [42] ERROR:  deadlock detected\nDETAIL:  Process 42 waits for ShareLock on transaction 1; blocked by process 43.\n\tProcess 43 waits for ShareLock on transaction 2; blocked by process 42.');
	assert.deepEqual(fromPrefix.victim, { pid: 42, waitingFor: null });
});

test('duplicate wait lines for one pid: first wins, with a warning', () => {
	const r = report(`${CLIENT}\nProcess 1201 waits for ShareLock on transaction 1; blocked by process 1202.`);
	assert.equal(r.edges.length, 2);
	assert.equal(r.edges[0].target.kind, 'transaction');
	assert.ok(r.warnings.some((w) => w.includes('Process 1201 appears in more than one wait line')));
});

test('unknown lock target: kept raw, warned, the report still parses', () => {
	const r = report('ERROR:  deadlock detected\nDETAIL:  Process 1 waits for ShareLock on frobnicator 9; blocked by process 2.\nProcess 2 waits for ShareLock on transaction 4; blocked by process 1.');
	const odd = r.edges.find((e) => e.pid === 1);
	assert.equal(odd?.target.kind, 'unparsed');
	assert.equal(odd?.target.raw, 'frobnicator 9');
	assert.ok(r.warnings.some((w) => w.includes('frobnicator 9')));
	assert.deepEqual(r.cycle, [1, 2]);
});

test('truncated report: cycle not closed, warning, found processes still returned', () => {
	const r = report('DETAIL:  Process 10 waits for ShareLock on transaction 5; blocked by process 11.\nProcess 11 waits for ShareLock on transaction 6; blocked by process 12.');
	assert.equal(r.cycle, null);
	assert.equal(r.processes.length, 3);
	assert.ok(r.warnings[0].includes('do not close into a cycle'));
});

test('garbage input: a helpful "no deadlock report found" result, never a throw', () => {
	const inputs = ['', '   \n\t ', 'hello world', 'ERROR:  something else went wrong', 'Process one waits for nothing', '\u0000\u0001\u0002', 'x'.repeat(10_000)];
	for (const input of inputs) {
		const out = parseDeadlock(input);
		assert.equal(out.ok, false, input.slice(0, 40));
		if (!out.ok) assert.match(out.message, /No deadlock report found/);
	}
});

test('deadlock message without wait lines asks for the DETAIL lines', () => {
	const out = parseDeadlock('ERROR:  deadlock detected\nHINT:  See server log for query details.');
	assert.equal(out.ok, false);
	if (!out.ok) assert.match(out.message, /Paste the DETAIL lines too/);
});

test('input size: 5 MB and more is rejected, the limit itself is accepted', () => {
	assert.equal(checkReportSize('a'.repeat(MAX_REPORT_BYTES)).ok, true);
	const over = checkReportSize('a'.repeat(MAX_REPORT_BYTES + 1));
	assert.equal(over.ok, false);
	if (!over.ok) assert.match(over.error.message, /over 5 MB/);
});
