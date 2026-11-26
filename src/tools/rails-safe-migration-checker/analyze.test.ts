import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPERATION_BY_ID } from '../postgres-lock-modes/data.ts';
import { MAX_MIGRATION_BYTES, analyzeMigration, classifyDefault, reportToText, type MigrationReport } from './analyze.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');

function reportOf(text: string): MigrationReport {
	const r = analyzeMigration(text);
	assert.ok(r.ok, r.ok ? '' : r.errors.map((e) => e.message).join('; '));
	return r.value;
}

const project = (r: MigrationReport) => ({
	verdict: r.verdict,
	findings: r.findings.map((f) => ({ line: f.line, method: f.method, risk: f.risk, lock: f.lockText })),
});

for (const file of readdirSync(fixtures).filter((f) => f.endsWith('.rb')).sort()) {
	test(`fixture ${file} matches its expected findings`, () => {
		const expected = JSON.parse(readFileSync(join(fixtures, file.replace(/\.rb$/, '.expected.json')), 'utf8'));
		const actual = project(reportOf(readFileSync(join(fixtures, file), 'utf8')));
		assert.deepEqual(actual, expected);
	});
}

test('fixtures cover at least ten migration samples', () => {
	assert.ok(readdirSync(fixtures).filter((f) => f.endsWith('.rb')).length >= 10);
});

test('every finding has a known risk, a lock text and no stray undefined or NaN', () => {
	for (const file of readdirSync(fixtures).filter((f) => f.endsWith('.rb'))) {
		const r = reportOf(readFileSync(join(fixtures, file), 'utf8'));
		const text = reportToText(r);
		assert.ok(!/undefined|NaN|\[object|\bnull\b(?!\s*:)/.test(text), `${file} leaks a stray value`);
		for (const f of r.findings) assert.ok(['high', 'medium', 'low', 'info'].includes(f.risk));
	}
});

test('lock modes come from the lock lookup data, not a copy', () => {
	const r = reportOf('add_index :orders, :customer_id');
	const expected = OPERATION_BY_ID.get('rails-add-index')?.locks.map((l) => ({ object: l.object, mode: l.mode }));
	assert.deepEqual(r.findings[0].locks, expected);
});

test('concurrent index with disable_ddl_transaction! is low; without it, high', () => {
	const ok = reportOf('class X < ActiveRecord::Migration[7.1]\n  disable_ddl_transaction!\n  def change\n    add_index :a, :b, algorithm: :concurrently\n  end\nend');
	assert.equal(ok.findings[0].risk, 'low');
	const bad = reportOf('class X < ActiveRecord::Migration[7.1]\n  def change\n    add_index :a, :b, algorithm: :concurrently\n  end\nend');
	assert.equal(bad.findings[0].risk, 'high');
	assert.match(bad.findings[0].explanation, /disable_ddl_transaction!/);
});

test('add_index on a table created in the same file is low', () => {
	const r = reportOf('create_table :notes do |t|\n  t.string :body\nend\nadd_index :notes, :body');
	const idx = r.findings.find((f) => f.method === 'add_index');
	assert.equal(idx?.risk, 'low');
});

test('constant and stable defaults are not rewrites; volatile ones are', () => {
	assert.equal(classifyDefault('0').kind, 'constant');
	assert.equal(classifyDefault('"pending"').kind, 'constant');
	assert.equal(classifyDefault('-> { "CURRENT_TIMESTAMP" }').kind, 'stable');
	assert.equal(classifyDefault('-> { "now()" }').kind, 'stable');
	assert.equal(classifyDefault('-> { "gen_random_uuid()" }').kind, 'volatile');
	assert.equal(classifyDefault('-> { "random()" }').kind, 'volatile');
	assert.equal(classifyDefault('-> { "my_fn()" }').kind, 'unknown');
	assert.equal(classifyDefault('-> { Foo.bar }').kind, 'opaque');
});

test('a constant default on add_column is low (no rewrite on Postgres 13–17)', () => {
	const r = reportOf('add_column :orders, :priority, :integer, default: 0');
	assert.equal(r.findings[0].risk, 'low');
	assert.equal(r.findings[0].saferRewrite, null);
});

test('NOT NULL without a default is high and the rewrite adds the column nullable first', () => {
	const r = reportOf('add_column :orders, :status, :string, null: false');
	const f = r.findings[0];
	assert.equal(f.risk, 'high');
	assert.match(f.saferRewrite ?? '', /add_column :orders, :status, :string/);
	assert.match(f.saferRewrite ?? '', /validate: false/);
});

test('volatile default rewrite keeps the default for new rows in SQL', () => {
	const f = reportOf('add_column :orders, :token, :uuid, default: -> { "gen_random_uuid()" }').findings[0];
	assert.equal(f.risk, 'high');
	assert.match(f.saferRewrite ?? '', /SET DEFAULT gen_random_uuid\(\)/);
});

test('add_reference with index and foreign key splits into concurrent index and validated FK', () => {
	const f = reportOf('add_reference :orders, :customer, index: true, foreign_key: true').findings[0];
	assert.equal(f.risk, 'high');
	assert.match(f.saferRewrite ?? '', /index: false, foreign_key: false/);
	assert.match(f.saferRewrite ?? '', /add_index :orders, :customer_id, algorithm: :concurrently/);
	assert.match(f.saferRewrite ?? '', /add_foreign_key :orders, :customers, column: :customer_id, validate: false/);
});

test('execute is not analyzed and shows its SQL; a dynamic string is still reported', () => {
	const f = reportOf('execute "CREATE INDEX i ON t (c)"').findings[0];
	assert.equal(f.risk, 'medium');
	assert.equal(f.sql, 'CREATE INDEX i ON t (c)');
	assert.match(f.explanation, /lock mode lookup/);
	const dyn = reportOf('execute build_sql(:orders)').findings[0];
	assert.equal(dyn.risk, 'medium');
	assert.equal(dyn.sql, 'build_sql(:orders)');
});

test('the lock_timeout note appears only when no timeout is set', () => {
	const without = reportOf('remove_column :a, :b');
	assert.ok(without.notes.some((n) => /lock_timeout/.test(n)));
	const withSet = reportOf("execute \"SET lock_timeout = '3s'\"\nremove_column :a, :b");
	assert.ok(!withSet.notes.some((n) => /No lock_timeout/.test(n)));
});

test('the safe set uses disable_ddl_transaction! only for concurrent work', () => {
	const r = reportOf('add_index :orders, :customer_id\nremove_column :orders, :legacy');
	assert.match(r.safeSet, /class SafeMigrationDeploy1Concurrent[\s\S]*disable_ddl_transaction!/);
	const plain = reportOf('remove_column :orders, :legacy');
	assert.ok(!plain.safeSet.includes('disable_ddl_transaction!'));
	assert.equal(reportOf('create_table :x do |t|\nend').safeSet, '');
});

test('verdict: high wins, then medium, then ok', () => {
	assert.equal(reportOf('add_index :a, :b').verdict, 'is-risk');
	assert.equal(reportOf('remove_column :a, :b').verdict, 'is-warn');
	assert.equal(reportOf('create_table :a do |t|\nend').verdict, 'is-ok');
});

test('input size is capped at 200 KB', () => {
	const r = analyzeMigration(`add_index :a, :b\n${'#'.repeat(MAX_MIGRATION_BYTES)}`);
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.errors[0].message, /too large/);
});

test('empty input and input without migration calls are rejected with a message', () => {
	const empty = analyzeMigration('   \n');
	assert.equal(empty.ok, false);
	const none = analyzeMigration('class X < ActiveRecord::Migration[7.1]\n  def change\n    puts "hi"\n  end\nend');
	assert.equal(none.ok, false);
	if (!none.ok) assert.match(none.errors[0].message, /No migration methods found/);
});
