import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPERATIONS, OPERATION_BY_ID } from './data.ts';
import { compareOperations, operationById, searchOperations, LOCK_QUEUE_NOTE } from './logic.ts';
import { LOCK_MODES } from '../_shared/pg-locks.ts';

const ids = (list: { id: string }[]) => list.map((o) => o.id);

test('ids are unique and every operation has a label, notes and at least one lock', () => {
	assert.equal(new Set(OPERATIONS.map((o) => o.id)).size, OPERATIONS.length);
	assert.ok(OPERATIONS.length >= 30, `only ${OPERATIONS.length} operations`);
	for (const o of OPERATIONS) {
		assert.ok(o.label.length > 0, o.id);
		assert.ok(o.notes.length > 0, o.id);
		assert.ok(o.locks.length >= 1, `${o.id} has no locks`);
		for (const l of o.locks) assert.ok((LOCK_MODES as readonly string[]).includes(l.mode), `${o.id}: ${l.mode}`);
	}
});

test('every operation cites a PostgreSQL 17 docs page', () => {
	const allowed = [
		'https://www.postgresql.org/docs/17/explicit-locking.html',
		'https://www.postgresql.org/docs/17/sql-altertable.html',
		'https://www.postgresql.org/docs/17/sql-createindex.html',
		'https://www.postgresql.org/docs/17/sql-reindex.html',
	];
	for (const o of OPERATIONS) assert.ok(allowed.includes(o.source), `${o.id}: ${o.source}`);
});

test('every Rails operation maps to an existing SQL operation', () => {
	const rails = OPERATIONS.filter((o) => o.kind === 'rails');
	assert.ok(rails.length >= 15);
	for (const o of rails) {
		assert.ok(o.sqlEquivalent, `${o.id} has no sqlEquivalent`);
		const target = OPERATION_BY_ID.get(o.sqlEquivalent!);
		assert.ok(target, `${o.id} → ${o.sqlEquivalent} does not exist`);
		assert.equal(target!.kind, 'sql', `${o.id} must map to an SQL operation`);
	}
	for (const o of OPERATIONS.filter((x) => x.kind === 'sql')) assert.equal(o.sqlEquivalent, undefined, o.id);
});

test('search: empty query returns everything, matching is case-insensitive and ignores _ and -', () => {
	assert.equal(searchOperations('').length, OPERATIONS.length);
	assert.equal(searchOperations('   ').length, OPERATIONS.length);
	assert.ok(ids(searchOperations('INDEX')).includes('create-index'));
	assert.ok(ids(searchOperations('index')).includes('rails-add-index'));
	assert.ok(ids(searchOperations('add_index')).includes('rails-add-index'));
	assert.ok(ids(searchOperations('add-index')).includes('rails-add-index'));
	assert.ok(ids(searchOperations('concurrently')).includes('create-index-concurrently'));
	assert.deepEqual(ids(searchOperations('zzz-no-such-thing')), []);
});

test('search finds operations through their aliases', () => {
	assert.ok(ids(searchOperations('upsert')).includes('merge'));
	assert.ok(ids(searchOperations('volatile default')).includes('alter-table-add-column-volatile-default'));
});

test('operationById returns undefined for unknown ids', () => {
	assert.equal(operationById('nope'), undefined);
	assert.equal(operationById('select')?.label, 'SELECT');
});

// Snapshot pairs: [A, B, verdict] — B waits for A?
const SNAPSHOTS: [string, string, 'conflict' | 'no-conflict'][] = [
	['select', 'alter-table-add-column', 'conflict'],
	['update', 'create-index', 'conflict'],
	['update', 'create-index-concurrently', 'no-conflict'],
	['select', 'update', 'no-conflict'],
	['create-index', 'create-index', 'no-conflict'],
	['create-index-concurrently', 'create-index-concurrently', 'conflict'],
	['vacuum', 'analyze', 'conflict'],
	['truncate', 'insert', 'conflict'],
	['refresh-materialized-view-concurrently', 'select-for-update', 'conflict'],
	['refresh-materialized-view-concurrently', 'select', 'no-conflict'],
];

for (const [a, b, verdict] of SNAPSHOTS) {
	test(`compare ${a} vs ${b} → ${verdict}`, () => {
		const r = compareOperations(a, b);
		assert.ok(r, 'comparison should exist');
		assert.equal(r!.verdict, verdict);
		if (verdict === 'conflict') {
			assert.ok(r!.pairs.some((p) => p.conflict));
			assert.match(r!.sentence, /waits for/);
		} else {
			assert.match(r!.sentence, /^No conflict/);
		}
	});
}

test('compare highlights the matrix cell of the conflicting pair', () => {
	const r = compareOperations('select', 'alter-table-add-column')!;
	assert.deepEqual(r.cells, [{ requested: 'ACCESS EXCLUSIVE', held: 'ACCESS SHARE' }]);
});

test('compare across different object kinds never conflicts', () => {
	const r = compareOperations('reindex', 'select')!;
	// REINDEX holds an index-level ACCESS EXCLUSIVE; SELECT asks only for a table lock.
	assert.equal(r.verdict, 'no-conflict');
	assert.ok(r.pairs.every((p) => p.held.object === p.requested.object || (p.held.object !== 'index' && p.requested.object !== 'index')));
});

test('compare with an unknown id returns null', () => {
	assert.equal(compareOperations('select', 'nope'), null);
	assert.equal(compareOperations('nope', 'select'), null);
});

test('lock queue note explains ACCESS EXCLUSIVE blocking later ACCESS SHARE', () => {
	assert.match(LOCK_QUEUE_NOTE, /ACCESS EXCLUSIVE/);
	assert.match(LOCK_QUEUE_NOTE, /ACCESS SHARE/);
	assert.match(LOCK_QUEUE_NOTE, /lock_timeout/);
});
