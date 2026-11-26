import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashOptions, nameOf, scanMigration, tokenize, unquote } from './scan.ts';

test('comments, strings and =begin blocks are not calls', () => {
	const src = [
		'# add_index :orders, :customer_id',
		'say "add_index :orders, :x"',
		'=begin',
		'add_index :orders, :y',
		'=end',
		'remove_column :orders, :legacy',
	].join('\n');
	const names = scanMigration(src).calls.map((c) => [c.name, c.line]);
	assert.deepEqual(names, [['remove_column', 6]]);
});

test('keyword options and symbol values are read as written', () => {
	const [call] = scanMigration('add_index :orders, :customer_id, algorithm: :concurrently, unique: false').calls;
	assert.equal(call.line, 1);
	assert.deepEqual(call.positional.map((p) => p.raw), [':orders', ':customer_id']);
	assert.equal(call.options.get('algorithm'), ':concurrently');
	assert.equal(call.options.get('unique'), 'false');
});

test('hash rockets and quoted keys are read as options', () => {
	const [call] = scanMigration('add_column :orders, :total, :integer, :default => 0, "null" => false').calls;
	assert.equal(call.options.get('default'), '0');
	assert.equal(call.options.get('null'), 'false');
});

test('a parenthesised call spanning lines keeps the line of its name', () => {
	const src = 'class X < ActiveRecord::Migration[7.1]\n  def change\n    add_index(\n      :orders,\n      [:a, :b],\n      algorithm: :concurrently\n    )\n  end\nend';
	const [call] = scanMigration(src).calls;
	assert.equal(call.name, 'add_index');
	assert.equal(call.line, 3);
	assert.equal(call.options.get('algorithm'), ':concurrently');
	assert.equal(call.positional.length, 2);
});

test('a bare call ends at a modifier if', () => {
	const calls = scanMigration('add_index :orders, :a if false\nremove_column :orders, :b').calls;
	assert.equal(calls.length, 2);
	assert.deepEqual(calls[0].positional.map((p) => p.raw), [':orders', ':a']);
});

test('heredoc bodies are captured as text and never scanned for calls', () => {
	const src = 'execute <<~SQL\n  add_index :orders, :x\n  CREATE INDEX i ON orders (x);\nSQL\nremove_column :orders, :y';
	const result = scanMigration(src);
	assert.deepEqual(result.calls.map((c) => c.name), ['execute', 'remove_column']);
	assert.equal(result.calls[0].heredoc, '  add_index :orders, :x\n  CREATE INDEX i ON orders (x);');
});

test('calls on other receivers are ignored', () => {
	assert.equal(scanMigration('Order.add_index :x\nself.remove_column :y').calls.length, 0);
});

test('def scopes give each call its section', () => {
	const src = 'def up\n  remove_column :a, :b\nend\ndef down\n  remove_column :a, :c\nend\ndef change\n  add_index :a, :b\nend\nremove_column :x, :z';
	assert.deepEqual(
		scanMigration(src).calls.map((c) => c.section),
		['up', 'down', 'change', 'body'],
	);
});

test('block receiver calls know their owner and table', () => {
	const src = 'change_table :users do |t|\n  t.references :team, index: true\nend\ncreate_table :teams do |t|\n  t.index :name\nend';
	const calls = scanMigration(src).calls;
	assert.deepEqual(calls.map((c) => [c.name, c.receiver, c.blockOwner, c.blockTable]), [
		['change_table', null, null, null],
		['references', 't', 'change_table', ':users'],
		['create_table', null, null, null],
		['index', 't', 'create_table', ':teams'],
	]);
});

test('nested do blocks and if statements keep the block stack balanced', () => {
	const src = [
		'def change',
		'  if condition',
		'    change_table :users do |t|',
		'      t.references :team',
		'    end',
		'  end',
		'  remove_column :users, :legacy',
		'end',
	].join('\n');
	const calls = scanMigration(src).calls;
	assert.equal(calls.at(-1)?.name, 'remove_column');
	assert.equal(calls.at(-1)?.section, 'change');
});

test('create_table names, the DDL-transaction flag and timeout mentions are reported', () => {
	const src = "class X < ActiveRecord::Migration[7.1]\n  disable_ddl_transaction!\n  def change\n    create_table :invoices do |t|\n    end\n    execute \"SET lock_timeout = '3s'\"\n  end\nend";
	const result = scanMigration(src);
	assert.equal(result.disablesDdlTransaction, true);
	assert.equal(result.mentionsTimeout, true);
	assert.deepEqual(result.createdTables, ['invoices']);
});

test('interpolated strings do not break the scan', () => {
	const src = 'execute "SELECT #{"x"} FROM t"\nremove_column :a, :b';
	assert.deepEqual(scanMigration(src).calls.map((c) => c.name), ['execute', 'remove_column']);
});

test('tokenizer keeps labels, symbols and punctuation apart', () => {
	const kinds = tokenize('foo: :bar, "baz": 1').map((t) => [t.kind, t.text]);
	assert.deepEqual(kinds.slice(0, 5), [
		['label', 'foo'],
		['symbol', ':bar'],
		['punct', ','],
		['label', 'baz'],
		['number', '1'],
	]);
});

test('helpers read names, literals and braces', () => {
	assert.equal(nameOf(':users'), 'users');
	assert.equal(nameOf('"users"'), 'users');
	assert.equal(nameOf('some_var'), null);
	assert.equal(unquote('"SELECT 1"'), 'SELECT 1');
	assert.equal(hashOptions('{ validate: false, to_table: :x }').get('validate'), 'false');
	assert.equal(hashOptions('not a hash').size, 0);
});
