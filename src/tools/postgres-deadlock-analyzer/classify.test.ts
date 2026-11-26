import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify, describeTarget, explainWait } from './classify.ts';
import { analyzeReport } from './analyze.ts';
import { modelName, fixesFor } from './fixes.ts';
import { parseDeadlock } from './parse.ts';
import { MAX_REPORT_BYTES } from './limits.ts';
import type { ParsedReport, WaitEdge } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', `${name}.log`), 'utf8');

function parsed(text: string): ParsedReport {
	const out = parseDeadlock(text);
	if (!out.ok) assert.fail(out.message);
	return out.report;
}

test('same table, both sides with statements: high confidence', () => {
	const d = classify(parsed(fixture('two-process-same-table')));
	assert.equal(d.pattern, 'same-table-row-order');
	assert.equal(d.confidence, 'high');
	assert.equal(d.focusTable, 'accounts');
});

test('client-only Rails message: classified from CONTEXT and the trailing SQL, at medium', () => {
	const r = analyzeReport(fixture('rails-exception-escaped'));
	assert.ok(r.ok);
	if (!r.ok) return;
	assert.equal(r.pattern, 'same-table-row-order');
	assert.equal(r.confidence, 'medium');
	assert.deepEqual(r.tables, ['accounts']);
	assert.equal(r.victim, null);
	assert.match(r.text, /Postgres aborted one process in the cycle/);
});

test('foreign key: an INSERT with order_id points at orders, and orders is not in the cycle', () => {
	const d = classify(parsed(fixture('fk-parent-child')));
	assert.equal(d.pattern, 'foreign-key');
	assert.equal(d.parentTable, 'orders');
	assert.equal(d.confidence, 'medium');
});

test('foreign key rises to high when the parent table is written inside the cycle', () => {
	const text = [
		'ERROR:  deadlock detected',
		'DETAIL:  Process 1 waits for ShareLock on transaction 10; blocked by process 2.',
		'	Process 2 waits for ShareLock on transaction 11; blocked by process 1.',
		'	Process 1: INSERT INTO order_items (order_id, sku) VALUES (42, $1)',
		'	Process 2: DELETE FROM orders WHERE id = 42',
	].join('\n');
	const d = classify(parsed(text));
	assert.equal(d.pattern, 'foreign-key');
	assert.equal(d.confidence, 'high');
	assert.equal(d.parentTable, 'orders');
});

test('explicit lock and DDL: an ALTER waiting for ACCESS EXCLUSIVE conflicts with the DML it queues behind', () => {
	const d = classify(parsed(fixture('relation-lock-ddl')));
	assert.equal(d.pattern, 'explicit-lock');
	assert.equal(d.confidence, 'high');
	assert.ok(d.evidence.some((e) => e.includes('ACCESS EXCLUSIVE conflicts with ROW EXCLUSIVE')));
});

test('DDL in the cycle without a table-level wait: medium', () => {
	const text = [
		'ERROR:  deadlock detected',
		'DETAIL:  Process 1 waits for ShareLock on transaction 10; blocked by process 2.',
		'	Process 2 waits for ShareLock on transaction 11; blocked by process 1.',
		'	Process 1: CREATE INDEX idx_a ON accounts (email)',
		'	Process 2: UPDATE accounts SET balance = 0 WHERE id = 3',
	].join('\n');
	const d = classify(parsed(text));
	assert.equal(d.pattern, 'explicit-lock');
	assert.equal(d.confidence, 'medium');
	assert.equal(d.focusTable, 'accounts');
});

test('advisory locks: high when every wait is an advisory lock', () => {
	const d = classify(parsed(fixture('advisory')));
	assert.equal(d.pattern, 'advisory');
	assert.equal(d.confidence, 'high');
	assert.ok(d.lockNotes.some((n) => n.includes('application lock')));
});

test('cross-table: medium, both tables named', () => {
	const d = classify(parsed(fixture('cross-table')));
	assert.equal(d.pattern, 'cross-table-order');
	assert.equal(d.confidence, 'medium');
	assert.deepEqual([...d.tables].sort(), ['accounts', 'ledger_entries']);
});

test('unknown: no tables and no matching pattern is low confidence and still explained', () => {
	const text = [
		'ERROR:  deadlock detected',
		'DETAIL:  Process 1 waits for ShareLock on transaction 10; blocked by process 2.',
		'	Process 2 waits for ShareLock on transaction 11; blocked by process 1.',
		'	Process 1: SELECT 1',
		'	Process 2: SELECT 2',
	].join('\n');
	const d = classify(parsed(text));
	assert.equal(d.pattern, 'unknown');
	assert.equal(d.confidence, 'low');
	assert.ok(d.lockNotes.length > 0);
});

test('a cycle that does not close is capped at low, whatever the pattern', () => {
	const d = classify(parsed(fixture('truncated')));
	assert.equal(d.confidence, 'low');
	assert.match(d.evidence[0], /capped at low/);
});

test('unparsed lock target: kept as written, explained as unknown, never throws', () => {
	const text = 'ERROR:  deadlock detected\nDETAIL:  Process 1 waits for ShareLock on frobnicator 9; blocked by process 2.\n	Process 2 waits for ShareLock on transaction 4; blocked by process 1.';
	const d = classify(parsed(text));
	const p1 = d.processes.find((p) => p.pid === 1);
	assert.equal(p1?.waitsFor, 'ShareLock on frobnicator 9');
	assert.match(p1?.explanation ?? '', /not one this tool knows/);
});

test('target descriptions and wait explanations use the lmgr.c and lock-mode meanings', () => {
	const edge = (over: Partial<WaitEdge>): WaitEdge => ({
		pid: 1,
		modeName: 'ShareLock',
		mode: 'SHARE',
		target: { kind: 'transaction', xid: 9, raw: 'transaction 9' },
		blockedBy: 2,
		...over,
	});
	assert.match(explainWait(edge({})), /not a table lock/);
	assert.match(explainWait(edge({ modeName: 'ExclusiveLock', target: { kind: 'tuple', block: 0, offset: 4, relOid: 16402, dbOid: 16384, raw: '' } })), /queue lock/);
	assert.match(explainWait(edge({ modeName: 'AccessExclusiveLock', mode: 'ACCESS EXCLUSIVE', target: { kind: 'relation', relOid: 1, dbOid: 2, raw: '' } })), /Taken by DROP, TRUNCATE/);
	assert.equal(describeTarget({ kind: 'tuple', block: 0, offset: 4, relOid: 16402, dbOid: 16384, raw: '' }), 'tuple (0,4) of relation OID 16402');
	assert.equal(describeTarget({ kind: 'advisory', fields: [16384, 0, 4001, 1], raw: '' }), 'advisory lock [16384,0,4001,1]');
});

test('analysis: consulting CTA at 3+ processes or 2+ tables; risk tone only for a closed cycle', () => {
	const two = analyzeReport(fixture('two-process-same-table'));
	assert.ok(two.ok && two.cta === false && two.tone === 'risk');
	const three = analyzeReport(fixture('three-process-cycle'));
	assert.ok(three.ok && three.cta === true);
	const cross = analyzeReport(fixture('cross-table'));
	assert.ok(cross.ok && cross.cta === true);
	const partial = analyzeReport(fixture('truncated'));
	assert.ok(partial.ok && partial.tone === undefined);
});

test('share state holds the summary only, never the statements or the log', () => {
	for (const name of ['two-process-same-table', 'fk-parent-child', 'rails-exception-escaped']) {
		const r = analyzeReport(fixture(name));
		assert.ok(r.ok, name);
		if (!r.ok) continue;
		assert.deepEqual(Object.keys(r.state).sort(), ['confidence', 'pattern', 'procs', 'tables']);
		const json = JSON.stringify(r.state);
		assert.ok(!/UPDATE|INSERT|DELETE|Process|balance/i.test(json), json);
	}
});

test('analysis is deterministic for the same input', () => {
	const a = analyzeReport(fixture('three-process-cycle'));
	const b = analyzeReport(fixture('three-process-cycle'));
	assert.deepEqual(a, b);
});

test('analysis: failures come back as messages, oversize input is rejected before parsing', () => {
	const bad = analyzeReport('hello');
	assert.equal(bad.ok, false);
	if (!bad.ok) assert.match(bad.message, /No deadlock report found/);
	const big = analyzeReport(`ERROR:  deadlock detected${' '.repeat(MAX_REPORT_BYTES)}`);
	assert.equal(big.ok, false);
	if (!big.ok) assert.match(big.message, /over 5 MB/);
});

test('plain text: the victim and its operation are named in the narrative', () => {
	const r = analyzeReport(fixture('prefixed-server-log'));
	assert.ok(r.ok);
	if (!r.ok) return;
	assert.match(r.text, /Process 5521 detected the cycle and was aborted while updating a row in accounts/);
});

test('model names for Ruby snippets', () => {
	assert.equal(modelName('accounts'), 'Account');
	assert.equal(modelName('order_items'), 'OrderItem');
	assert.equal(modelName('ledger_entries'), 'LedgerEntry');
	assert.equal(modelName('categories'), 'Category');
	assert.equal(modelName('$$'), 'Record');
});

test('fixes: pattern snippets and the shared retry and timeout advice', () => {
	const same = fixesFor({ pattern: 'same-table-row-order', focusTable: 'accounts', parentTable: null, tables: ['accounts'] });
	assert.ok(same.some((f) => f.code.includes('Account.where(id: ids).order(:id).lock.to_a')));
	assert.ok(same.some((f) => f.id === 'retry' && f.code.includes('rescue ActiveRecord::Deadlocked')));
	assert.ok(same.some((f) => f.id === 'lock-timeout' && f.code.includes('lock_timeout: 5s')));

	const fk = fixesFor({ pattern: 'foreign-key', focusTable: 'order_items', parentTable: 'orders', tables: ['order_items'] });
	assert.ok(fk.some((f) => f.code === 'add_index :order_items, :order_id'));
	assert.ok(fk.some((f) => f.code.includes('Order.lock.find(order_id)')));

	const unknown = fixesFor({ pattern: 'unknown', focusTable: null, parentTable: null, tables: [] });
	assert.ok(unknown.some((f) => f.id === 'read-full-log'));
	assert.ok(unknown.every((f) => f.link === undefined || f.link.href.startsWith('/blog/')));
});
