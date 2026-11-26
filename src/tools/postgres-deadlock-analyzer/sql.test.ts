import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanStatement, unquoteName } from './sql.ts';

test('scanStatement: DML verbs, schema prefixes and quoting', () => {
	assert.deepEqual(scanStatement('UPDATE "accounts" SET "balance" = $1 WHERE "accounts"."id" = $2').tables, ['accounts']);
	assert.deepEqual(scanStatement('UPDATE public.accounts SET balance = balance + 50 WHERE id = 7').tables, ['accounts']);
	assert.equal(scanStatement('DELETE FROM orders WHERE id = 42').kind, 'delete');
	assert.equal(scanStatement('UPDATE "Ledger" SET x = 1').tables[0], 'Ledger');
});

test('scanStatement: INSERT keeps the column list', () => {
	const s = scanStatement("INSERT INTO order_items (order_id, sku, qty) VALUES (42, 'SKU-1', 2)");
	assert.equal(s.kind, 'insert');
	assert.deepEqual(s.tables, ['order_items']);
	assert.deepEqual(s.columns, ['order_id', 'sku', 'qty']);
});

test('scanStatement: locking SELECT, and FOR UPDATE NOWAIT is not an UPDATE', () => {
	const s = scanStatement('SELECT id, status FROM orders WHERE id = 881 FOR UPDATE NOWAIT');
	assert.equal(s.kind, 'select-lock');
	assert.equal(s.rowLock, 'FOR UPDATE');
	assert.deepEqual(s.tables, ['orders']);
	assert.equal(scanStatement('SELECT * FROM t WHERE x FOR NO KEY UPDATE').rowLock, 'FOR NO KEY UPDATE');
	assert.equal(scanStatement('SELECT * FROM t FOR KEY SHARE').rowLock, 'FOR KEY SHARE');
});

test('scanStatement: joins list every table; a plain SELECT is not a lock', () => {
	const s = scanStatement('SELECT * FROM users u JOIN accounts a ON a.user_id = u.id WHERE u.lock IS NULL');
	assert.equal(s.kind, 'select');
	assert.deepEqual(s.tables, ['users', 'accounts']);
});

test('scanStatement: DDL is only recognised at the start of a statement', () => {
	assert.equal(scanStatement('ALTER TABLE accounts ADD COLUMN flagged boolean NOT NULL DEFAULT false').ddl, 'ALTER TABLE');
	assert.equal(scanStatement('CREATE UNIQUE INDEX CONCURRENTLY idx_x ON "Ledger" (id)').tables[0], 'Ledger');
	assert.equal(scanStatement('SELECT x FROM t WHERE lock IS NULL').kind, 'select');
});

test('scanStatement: advisory calls, comments and unknown statements', () => {
	assert.equal(scanStatement('SELECT pg_advisory_xact_lock(4002)').kind, 'advisory');
	assert.equal(scanStatement('UPDATE /* hint */ accounts -- note\nSET x = 1').tables[0], 'accounts');
	assert.equal(scanStatement('VACUUM').kind, 'other');
	assert.equal(scanStatement('').kind, 'other');
});

test('unquoteName: last segment, quotes removed, doubled quotes unescaped', () => {
	assert.equal(unquoteName('public."Accounts"'), 'Accounts');
	assert.equal(unquoteName('"say ""hi"""'), 'say "hi"');
	assert.equal(unquoteName('plain'), 'plain');
});
