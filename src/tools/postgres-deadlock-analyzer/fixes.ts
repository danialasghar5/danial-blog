// Fix snippets per pattern. Rails first, because that is where the report is
// usually read. Pure: returns plain data, no DOM.
import type { PatternId } from './classify.ts';

export type FixLanguage = 'ruby' | 'sql' | 'yaml' | 'text';

export interface Fix {
	id: string;
	title: string;
	why: string;
	language: FixLanguage;
	code: string;
	link?: { href: string; label: string };
}

export interface FixContext {
	pattern: PatternId;
	focusTable: string | null;
	parentTable: string | null;
	tables: string[];
}

/** Section anchors in the two related posts (github-slugger ids; checked against the build). */
export const POST_LINKS = {
	reading: { href: '/blog/rails-deadlock-activerecord/#reading-the-40p01-report', label: 'Reading the 40P01 report' },
	rule: { href: '/blog/rails-deadlock-activerecord/#the-one-rule-that-prevents-most-deadlocks', label: 'The one rule that prevents most deadlocks' },
	sources: { href: '/blog/rails-deadlock-activerecord/#the-other-common-rails-deadlock-sources', label: 'The other common Rails deadlock sources' },
	retry: { href: '/blog/rails-deadlock-activerecord/#make-the-deadlock-survivable-retry-on-40p01', label: 'Make the deadlock survivable: retry on 40P01' },
	ordering: { href: '/blog/postgres-race-conditions-row-locks-rails/#the-golden-rule-deterministic-lock-ordering', label: 'The golden rule: deterministic lock ordering' },
} as const;

/** `order_items` → `OrderItem`, `accounts` → `Account`. Non-identifier characters are dropped. */
export function modelName(table: string): string {
	const clean = table.replace(/[^A-Za-z0-9_]/g, '');
	const singular = clean.endsWith('ies') ? `${clean.slice(0, -3)}y` : clean.endsWith('sses') ? clean.slice(0, -2) : clean.replace(/s$/, '');
	const name = singular
		.split('_')
		.filter((w) => w !== '')
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join('');
	return name === '' ? 'Record' : name;
}

const RETRY: Fix = {
	id: 'retry',
	title: 'Retry the whole transaction, a bounded number of times',
	why: 'A deadlock victim is a transient failure. Retry from the outermost transaction: Postgres has already rolled the whole transaction back. Keep the cap small, so a persistent cycle surfaces instead of being hidden.',
	language: 'ruby',
	code: [
		'def with_deadlock_retry(max_attempts: 3)',
		'  attempts = 0',
		'  begin',
		'    attempts += 1',
		'    ActiveRecord::Base.transaction { yield }',
		'  rescue ActiveRecord::Deadlocked',
		'    retry if attempts < max_attempts',
		'    raise',
		'  end',
		'end',
		'',
		'with_deadlock_retry { transfer(from_id, to_id, amount) }',
	].join('\n'),
	link: POST_LINKS.retry,
};

const LOCK_TIMEOUT: Fix = {
	id: 'lock-timeout',
	title: 'Set lock_timeout so waits fail fast',
	why: 'Without a limit, a request can queue behind a long transaction for minutes. A short lock_timeout turns that into an error you can retry or report. Set it per role or per connection; it does not change the lock order.',
	language: 'yaml',
	code: ['# config/database.yml', 'production:', '  variables:', '    lock_timeout: 5s', '    idle_in_transaction_session_timeout: 60s'].join('\n'),
};

const SMALL_TX: Fix = {
	id: 'small-transactions',
	title: 'Keep the transaction short and do slow work outside it',
	why: 'A lock held across an API call or a file upload widens the window in which another transaction can collide with it. Compute first, then open the transaction and write.',
	language: 'text',
	code: 'Move HTTP calls, PDF rendering and similar work above Model.transaction. Only the reads that need locks and the writes belong inside.',
};

function sameTable(ctx: FixContext): Fix[] {
	const t = ctx.focusTable ?? 'accounts';
	const model = modelName(t);
	return [
		{
			id: 'order-by-id',
			title: `Lock the rows of ${t} in one order everywhere`,
			why: 'Two transactions that lock the same rows in opposite orders can deadlock. Sort the ids and lock them in that order in every code path that touches the table.',
			language: 'ruby',
			code: [
				`${model}.transaction do`,
				`  rows = ${model}.where(id: ids).order(:id).lock.to_a`,
				'  # update the locked rows here, then commit',
				'end',
			].join('\n'),
			link: POST_LINKS.ordering,
		},
		{
			id: 'lock-up-front',
			title: 'Lock the rows first, before any other write',
			why: 'Taking the row locks at the start of the transaction, in one statement, leaves no window in which the other transaction can take a row you need in the opposite order.',
			language: 'sql',
			code: [`SELECT id FROM ${t} WHERE id IN (...) ORDER BY id FOR UPDATE;`, '-- then the UPDATE statements, in the same transaction'].join('\n'),
			link: POST_LINKS.rule,
		},
	];
}

function crossTable(ctx: FixContext): Fix[] {
	const [a, b] = ctx.tables.length >= 2 ? ctx.tables : [ctx.focusTable ?? 'accounts', 'ledger_entries'];
	return [
		{
			id: 'table-order',
			title: `Agree on one table order: ${a} before ${b}`,
			why: 'Each path locks the two tables in a different sequence. Pick one order and use it in every path that touches both tables, even when only one of them is needed in a given path.',
			language: 'ruby',
			code: [
				`${modelName(a)}.transaction do`,
				`  # always ${a} first`,
				`  rows_a = ${modelName(a)}.where(id: a_ids).order(:id).lock.to_a`,
				`  # then ${b}`,
				`  rows_b = ${modelName(b)}.where(id: b_ids).order(:id).lock.to_a`,
				'end',
			].join('\n'),
			link: POST_LINKS.rule,
		},
	];
}

function foreignKey(ctx: FixContext): Fix[] {
	const child = ctx.focusTable ?? 'order_items';
	const parent = ctx.parentTable ?? 'orders';
	const fkColumn = `${parent.replace(/s$/, '')}_id`;
	return [
		{
			id: 'parent-first',
			title: `Lock the ${parent} row before writing its ${child} rows`,
			why: 'An INSERT into a child table takes a shared lock on the parent row for its foreign-key check. If another transaction holds that parent row for update, the two wait on each other. Taking the parent lock first, in every path, keeps one order.',
			language: 'ruby',
			code: [
				`${modelName(parent)}.transaction do`,
				`  parent = ${modelName(parent)}.lock.find(${fkColumn})   # FOR UPDATE on the parent`,
				`  ${modelName(child)}.create!(${parent.replace(/s$/, '')}: parent, sku: sku, qty: qty)`,
				'end',
			].join('\n'),
			link: POST_LINKS.sources,
		},
		{
			id: 'index-fk',
			title: `Index ${child}.${fkColumn}`,
			why: 'Postgres does not index foreign-key columns automatically. Without an index, parent-row checks and deletes scan the child table, which holds locks longer and widens the collision window.',
			language: 'ruby',
			code: `add_index :${child}, :${fkColumn}`,
		},
	];
}

function explicitLock(ctx: FixContext): Fix[] {
	const t = ctx.focusTable ?? 'accounts';
	return [
		{
			id: 'ddl-timeout',
			title: 'Run DDL with lock_timeout and when no long transactions are open',
			why: 'ALTER TABLE and similar statements need a lock that conflicts with every open transaction on the table. They queue behind it, and the traffic queues behind them. A short lock_timeout lets the DDL give up and retry instead.',
			language: 'sql',
			code: [`SET lock_timeout = '2s';`, `ALTER TABLE ${t} ADD COLUMN flagged boolean NOT NULL DEFAULT false;`, '-- retry in a loop with a pause if it times out'].join('\n'),
			link: POST_LINKS.sources,
		},
	];
}

function advisory(): Fix[] {
	return [
		{
			id: 'advisory-order',
			title: 'Take advisory locks in one key order, with the transaction-scoped variant',
			why: 'Advisory locks do not know about rows. Callers that take keys A then B and others that take B then A deadlock in the same way. Sort the keys, and use pg_advisory_xact_lock so the lock ends with the transaction.',
			language: 'sql',
			code: ['SELECT pg_advisory_xact_lock(4001);', 'SELECT pg_advisory_xact_lock(4002);', '-- or: SELECT pg_try_advisory_xact_lock(4002); -- returns false instead of waiting'].join('\n'),
			link: POST_LINKS.rule,
		},
	];
}

function unknown(): Fix[] {
	return [
		{
			id: 'read-full-log',
			title: 'Get the full report from the server log',
			why: 'The client error has only the wait lines. The server log also has each process statement and the table in the CONTEXT line. Those are what the fix depends on.',
			language: 'text',
			code: "Enable log_lock_waits = on, then find the 'ERROR:  deadlock detected' entry and its DETAIL lines in the Postgres log (not the Rails log).",
			link: POST_LINKS.reading,
		},
	];
}

export function fixesFor(ctx: FixContext): Fix[] {
	let specific: Fix[];
	switch (ctx.pattern) {
		case 'same-table-row-order':
			specific = sameTable(ctx);
			break;
		case 'cross-table-order':
			specific = crossTable(ctx);
			break;
		case 'foreign-key':
			specific = foreignKey(ctx);
			break;
		case 'explicit-lock':
			specific = explicitLock(ctx);
			break;
		case 'advisory':
			specific = advisory();
			break;
		default:
			specific = unknown();
	}
	const common = ctx.pattern === 'unknown' ? [] : [SMALL_TX];
	return [...specific, ...common, RETRY, LOCK_TIMEOUT];
}
