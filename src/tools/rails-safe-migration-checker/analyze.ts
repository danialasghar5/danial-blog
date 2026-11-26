// Rules: scanned migration calls → per-line findings with the Postgres lock they take,
// a risk, and a safer rewrite (TOOLS_ROADMAP.md §7 #11). Lock modes come from the
// lock mode lookup data (#9) so the two tools cannot disagree. Target: Postgres 13–17.
// Pure: no DOM, no network.

import { OPERATION_BY_ID, type LockObject } from '../postgres-lock-modes/data.ts';
import type { LockMode } from '../_shared/pg-locks.ts';
import { checkSize, failure, success, type Result } from '../_shared/validate.ts';
import { hashOptions, literalOf, nameOf, scanMigration, unquote, type ScannedCall } from './scan.ts';

export const MAX_MIGRATION_BYTES = 200 * 1024;
const RAILS = '7.1';

export type Risk = 'high' | 'medium' | 'low' | 'info';
export type Verdict = 'is-risk' | 'is-warn' | 'is-ok';

export interface LockRef {
	object: LockObject;
	mode: LockMode;
}

/** One statement of a suggested rewrite. `deploy` orders the steps; `concurrent` needs its own migration. */
export interface Step {
	deploy: 1 | 2 | 3;
	concurrent: boolean;
	ruby: string;
}

export interface Finding {
	line: number;
	/** Rails method as written, `t.references` for block receivers. */
	method: string;
	section: string;
	risk: Risk;
	locks: LockRef[];
	lockText: string;
	explanation: string;
	/** Ruby text of the safer version, or null when there is nothing to rewrite. */
	saferRewrite: string | null;
	/** Raw SQL for `execute`, which is not analyzed. */
	sql: string | null;
	steps: Step[];
}

export interface MigrationReport {
	findings: Finding[];
	counts: Record<Risk, number>;
	verdict: Verdict;
	verdictText: string;
	notes: string[];
	/** Suggested split into migrations, in deploy order. Empty when nothing needs rewriting. */
	safeSet: string;
	linesChecked: number;
}

// Lock modes for Rails methods that the lookup data does not list (TOOLS_ROADMAP.md #9 has no DROP INDEX
// or RENAME TABLE entry). Taken from the PostgreSQL 17 docs for DROP INDEX and ALTER TABLE … RENAME.
const EXTRA_LOCKS: Readonly<Record<string, readonly LockRef[]>> = {
	'drop-index': [{ object: 'table', mode: 'ACCESS EXCLUSIVE' }],
	'drop-index-concurrently': [{ object: 'table', mode: 'SHARE UPDATE EXCLUSIVE' }],
	'rename-table': [{ object: 'table', mode: 'ACCESS EXCLUSIVE' }],
};

function locksFor(id: string): LockRef[] {
	const op = OPERATION_BY_ID.get(id);
	if (op) return op.locks.map((l) => ({ object: l.object, mode: l.mode }));
	const extra = EXTRA_LOCKS[id];
	if (!extra) throw new Error(`no lock data for ${id}`);
	return extra.map((l) => ({ ...l }));
}

function mergeLocks(...lists: LockRef[][]): LockRef[] {
	const seen = new Set<string>();
	const out: LockRef[] = [];
	for (const list of lists) {
		for (const l of list) {
			const key = `${l.object}|${l.mode}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(l);
		}
	}
	return out;
}

const lockText = (locks: LockRef[]): string => locks.map((l) => `${l.mode} (${l.object})`).join(', ');

// --- Default classification (ADD COLUMN) -------------------------------------------------

const VOLATILE_FN = /\b(gen_random_uuid|uuid_generate_v[14]|random|clock_timestamp|timeofday|nextval|setseed|txid_current)\s*\(/i;
const STABLE_FN = /\b(now|transaction_timestamp|statement_timestamp|current_setting)\s*\(|\b(current_timestamp|current_date|current_time|localtimestamp|localtime|current_user|session_user)\b/i;

export type DefaultKind = 'constant' | 'stable' | 'volatile' | 'unknown' | 'opaque';

/** What a default does to an existing table on Postgres 13–17. */
export function classifyDefault(raw: string): { kind: DefaultKind; sql: string | null } {
	const s = raw.trim();
	if (!s.startsWith('->')) return { kind: 'constant', sql: null };
	const m = /^->\s*\{\s*(["'])([\s\S]*)\1\s*\}$/.exec(s);
	if (!m) return { kind: 'opaque', sql: null };
	const sql = m[2];
	if (VOLATILE_FN.test(sql)) return { kind: 'volatile', sql };
	if (STABLE_FN.test(sql)) return { kind: 'stable', sql };
	if (sql.includes('(')) return { kind: 'unknown', sql };
	return { kind: 'constant', sql };
}

// --- Findings helpers -----------------------------------------------------------------------

interface Draft {
	line: number;
	method: string;
	section: string;
	risk: Risk;
	locks: LockRef[];
	explanation: string;
	steps: Step[];
	sql?: string | null;
	/** Shown instead of a lock when no lock applies to this line. */
	lockNote?: string;
}

function finish(d: Draft): Finding {
	const saferRewrite = d.steps.length ? renderSteps(d.steps) : null;
	return {
		line: d.line,
		method: d.method,
		section: d.section,
		risk: d.risk,
		locks: d.locks,
		lockText: d.locks.length ? lockText(d.locks) : (d.lockNote ?? 'none on existing tables'),
		explanation: d.explanation,
		saferRewrite,
		sql: d.sql ?? null,
		steps: d.steps,
	};
}

function renderSteps(steps: Step[]): string {
	const out: string[] = [];
	for (const deploy of [1, 2, 3] as const) {
		for (const concurrent of [false, true]) {
			const here = steps.filter((s) => s.deploy === deploy && s.concurrent === concurrent);
			if (!here.length) continue;
			const own = concurrent ? ', own migration with disable_ddl_transaction!' : '';
			out.push(`# Deploy ${deploy}${own}`);
			for (const s of here) out.push(s.ruby);
			out.push('');
		}
	}
	return out.join('\n').trimEnd();
}

const flat = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim();

/** Bare name for prose: `:status` → `status`, `"status"` → `status`. */
const bare = (raw: string): string => nameOf(raw) ?? unquote(raw);

/** Rails method call text rebuilt from the arguments as written. */
function callText(method: string, parts: string[]): string {
	return parts.length ? `${method} ${parts.join(', ')}` : method;
}

interface Ctx {
	disablesDdl: boolean;
	created: Set<string>;
}

interface Target {
	table: string | null;
	tableRaw: string | null;
	/** Positional arguments after the table, as written (keep the colons for rewrites). */
	args: string[];
	isNew: boolean;
}

function targetOf(c: ScannedCall, ctx: Ctx): Target {
	const tableRaw = c.receiver ? c.blockTable : (c.positional[0]?.raw ?? null);
	const argItems = c.receiver ? c.positional : c.positional.slice(1);
	const table = nameOf(tableRaw);
	const isNew = c.blockOwner === 'create_table' || (table !== null && ctx.created.has(table));
	return {
		table,
		tableRaw,
		args: argItems.map((a) => a.raw),
		isNew,
	};
}

const RECEIVER_TO_RAILS: Readonly<Record<string, string>> = {
	references: 'add_reference',
	belongs_to: 'add_belongs_to',
	index: 'add_index',
	foreign_key: 'add_foreign_key',
	column: 'add_column',
	check_constraint: 'add_check_constraint',
	remove: 'remove_column',
};

// --- Rules ----------------------------------------------------------------------------------

function analyzeCall(c: ScannedCall, ctx: Ctx): Draft | null {
	const method = c.receiver ? `${c.receiver}.${c.name}` : c.name;
	const rails = c.receiver ? (RECEIVER_TO_RAILS[c.name] ?? c.name) : c.name;
	const t = targetOf(c, ctx);
	const T = t.tableRaw ?? ':table';
	const base = { line: c.line, method, section: c.section };
	const opt = (k: string) => c.options.get(k);
	const tableName = t.table ?? 'table';

	switch (rails) {
		case 'add_index': {
			if (c.receiver && t.isNew) return null;
			const parts = c.receiver ? [T, ...t.args] : c.args.map((a) => a.raw);
			const withConcurrent = callText('add_index', [...parts.map(flat), 'algorithm: :concurrently']);
			if (isConcurrentValue(c.options.get('algorithm'))) {
				if (!ctx.disablesDdl) {
					return {
						...base,
						risk: 'high',
						locks: locksFor('rails-add-index-concurrently'),
						explanation:
							'CREATE INDEX CONCURRENTLY cannot run inside a transaction block. Rails wraps each migration in one unless the class calls disable_ddl_transaction!, so this line fails without it. Add that call to a migration that contains only concurrent index work.',
						steps: [{ deploy: 1, concurrent: true, ruby: withConcurrent }],
					};
				}
				return {
					...base,
					risk: 'low',
					locks: locksFor('rails-add-index-concurrently'),
					explanation:
						'Builds the index without blocking INSERT, UPDATE or DELETE. The build still waits for transactions that started before it, and a failed build leaves an INVALID index that you must drop before retrying.',
					steps: [],
				};
			}
			if (t.isNew) {
				return {
					...base,
					risk: 'low',
					locks: locksFor('rails-add-index'),
					explanation:
						'The table is created earlier in this file, so the build runs on an empty table and blocks nothing that uses it. Safe here.',
					steps: [],
				};
			}
			return {
				...base,
				risk: 'high',
				locks: locksFor('rails-add-index'),
				explanation:
					'A plain CREATE INDEX takes SHARE, which blocks INSERT, UPDATE and DELETE on the table until the build finishes. On a large table that is minutes of blocked writes.',
				steps: [{ deploy: 1, concurrent: true, ruby: withConcurrent }],
			};
		}

		case 'remove_index': {
			const parts = c.receiver ? [T, ...t.args] : c.args.map((a) => a.raw);
			const withConcurrent = callText('remove_index', [...parts.map(flat), 'algorithm: :concurrently']);
			if (isConcurrentValue(c.options.get('algorithm'))) {
				if (!ctx.disablesDdl) {
					return {
						...base,
						risk: 'high',
						locks: locksFor('drop-index-concurrently'),
						explanation: 'DROP INDEX CONCURRENTLY cannot run inside a transaction block. Without disable_ddl_transaction! in the class, this line fails.',
						steps: [{ deploy: 1, concurrent: true, ruby: withConcurrent }],
					};
				}
				return {
					...base,
					risk: 'low',
					locks: locksFor('drop-index-concurrently'),
					explanation: 'Drops the index under SHARE UPDATE EXCLUSIVE, so reads and writes continue.',
					steps: [],
				};
			}
			if (t.isNew) {
				return { ...base, risk: 'low', locks: locksFor('drop-index'), explanation: 'The table is created earlier in this file. Nothing else uses it yet.', steps: [] };
			}
			return {
				...base,
				risk: 'high',
				locks: locksFor('drop-index'),
				explanation:
					'DROP INDEX takes ACCESS EXCLUSIVE on the table. The drop itself is quick, but the request waits in the lock queue behind any open transaction, and every request behind it waits too.',
				steps: [{ deploy: 1, concurrent: true, ruby: withConcurrent }],
			};
		}

		case 'add_column': {
			if (c.receiver && t.isNew) return null;
			const col = t.args[0] ?? ':column';
			const type = t.args[1] ?? ':type';
			const defOpt = opt('default');
			const notNull = literalOf(opt('null')) === 'false';
			if (defOpt === undefined) {
				if (notNull && !t.isNew) {
					return {
						...base,
						risk: 'high',
						locks: locksFor('rails-add-column'),
						explanation:
							'Adds a NOT NULL column with no default. Postgres rejects that when the table has any rows, so the migration fails. Add the column as nullable, backfill it, then enforce NOT NULL in a later deploy.',
						steps: notNullSteps(tableName, T, col, type),
					};
				}
				return {
					...base,
					risk: 'low',
					locks: locksFor('rails-add-column'),
					explanation: 'ACCESS EXCLUSIVE, held briefly. With no default, no rows are rewritten. The wait matters more than the work: set lock_timeout.',
					steps: [],
				};
			}
			const cls = classifyDefault(defOpt);
			if (cls.kind === 'volatile') {
				const sql = cls.sql ?? '';
				return {
					...base,
					risk: 'high',
					locks: locksFor('alter-table-add-column-volatile-default'),
					explanation: `The default calls a volatile function (${sql}). Postgres evaluates it for every row, so the whole table and its indexes are rewritten while ACCESS EXCLUSIVE is held. Add the column without a default, set the default for new rows, then backfill in batches.`,
					steps: [
						{ deploy: 1, concurrent: false, ruby: `add_column ${T}, ${col}, ${type}` },
						{ deploy: 1, concurrent: false, ruby: `execute "ALTER TABLE ${tableName} ALTER COLUMN ${bare(col)} SET DEFAULT ${sql}"` },
						{ deploy: 2, concurrent: false, ruby: `# Backfill ${bare(col)} in batches from a script, not this migration: in_batches(of: 5_000) and update_all("${bare(col)} = ${sql}")` },
					],
				};
			}
			if (cls.kind === 'stable') {
				return {
					...base,
					risk: 'low',
					locks: locksFor('rails-add-column'),
					explanation:
						'A stable function such as now() or CURRENT_TIMESTAMP does not rewrite the table on Postgres 11 and later. It is computed once, when the statement runs, so every existing row gets that same value. If each row needs its own time, backfill instead.',
					steps: [],
				};
			}
			if (cls.kind === 'unknown' || cls.kind === 'opaque') {
				return {
					...base,
					risk: 'medium',
					locks: locksFor('rails-add-column'),
					explanation: `The default is an expression this tool cannot classify (${flat(defOpt)}). Check its volatility in pg_proc (provolatile = 'v' means a rewrite). If it is volatile, add the column without a default and backfill it.`,
					steps: [],
				};
			}
			return {
				...base,
				risk: 'low',
				locks: locksFor('rails-add-column'),
				explanation: 'A constant default is stored in the catalog from Postgres 11 on, so existing rows are not rewritten. The lock is brief, unless the statement waits behind a long query.',
				steps: [],
			};
		}

		case 'change_column': {
			const col = t.args[0] ?? ':column';
			const type = t.args[1] ?? ':type';
			return {
				...base,
				risk: 'high',
				locks: locksFor('rails-change-column'),
				explanation:
					'Changing a column type usually rewrites the table while ACCESS EXCLUSIVE is held. A few widening changes avoid the rewrite (for example raising a varchar limit), so confirm the rewrite for your exact change before relying on it.',
				steps: [
					{ deploy: 1, concurrent: false, ruby: `add_column ${T}, :${bare(col)}_new, ${type} # dual-write from the app, backfill in batches` },
					{ deploy: 3, concurrent: false, ruby: `remove_column ${T}, ${col} # after the app reads only the new column` },
				],
			};
		}

		case 'change_column_null': {
			const col = t.args[0] ?? ':column';
			const flag = literalOf(t.args[1]);
			if (flag === 'false') {
				return {
					...base,
					risk: 'high',
					locks: locksFor('rails-change-column-null'),
					explanation:
						'SET NOT NULL scans the whole table under ACCESS EXCLUSIVE to look for NULLs. On Postgres 12 and later, a validated CHECK (col IS NOT NULL) lets Postgres skip that scan, which is why the steps add one first.',
					steps: notNullSteps(tableName, T, col, null, true),
				};
			}
			if (flag === 'true') {
				return {
					...base,
					risk: 'low',
					locks: locksFor('rails-change-column-null'),
					explanation: 'Dropping NOT NULL changes only the catalog. The lock is brief and nothing is scanned.',
					steps: [],
				};
			}
			return {
				...base,
				risk: 'medium',
				locks: locksFor('rails-change-column-null'),
				explanation: 'The flag is not a literal true or false, so this tool cannot tell whether it scans. Setting NOT NULL scans the table under ACCESS EXCLUSIVE.',
				steps: [],
			};
		}

		case 'change_column_default':
			return {
				...base,
				risk: 'low',
				locks: locksFor('rails-change-column-default'),
				explanation:
					'Changes only the default for new rows, so no rows are rewritten. It still takes ACCESS EXCLUSIVE briefly, so set lock_timeout to keep it from queuing behind a long query.',
				steps: [],
			};

		case 'add_foreign_key': {
			const to = t.args[0] ?? ':other_table';
			const validateOff = literalOf(opt('validate')) === 'false';
			const validateLater = { deploy: 2 as const, concurrent: false, ruby: `validate_foreign_key ${T}, ${to}` };
			const locks = locksFor(validateOff ? 'rails-add-foreign-key-no-validate' : 'rails-add-foreign-key');
			if (t.isNew) {
				return {
					...base,
					risk: 'low',
					locks: locks.filter((l) => l.object === 'referenced table'),
					explanation: 'The table is created earlier in this file, so the validation scan covers no existing rows. The referenced table still takes SHARE ROW EXCLUSIVE briefly.',
					steps: [],
				};
			}
			if (validateOff) {
				return {
					...base,
					risk: 'medium',
					locks,
					explanation:
						'Adds the constraint as NOT VALID. It still takes SHARE ROW EXCLUSIVE on both tables, briefly, but existing rows are not scanned. Run validate_foreign_key in a later deploy to check them under a lock that lets reads and writes continue.',
					steps: [validateLater],
				};
			}
			return {
				...base,
				risk: 'high',
				locks,
				explanation:
					'Takes SHARE ROW EXCLUSIVE on both tables and scans existing rows to validate the constraint. Writes to either table wait for the scan. Add it with validate: false, then validate in a separate deploy.',
				steps: [{ deploy: 1, concurrent: false, ruby: `add_foreign_key ${allArgs(c, T)}, validate: false` }, validateLater],
			};
		}

		case 'validate_foreign_key':
			return {
				...base,
				risk: 'low',
				locks: locksFor('rails-validate-foreign-key'),
				explanation: 'Checks existing rows under SHARE UPDATE EXCLUSIVE. Reads and writes continue. Only other schema changes on these tables wait.',
				steps: [],
			};

		case 'add_check_constraint': {
			const validateOff = literalOf(opt('validate')) === 'false';
			const name = opt('name') ?? '"check_name"';
			const locks = locksFor(validateOff ? 'rails-add-check-constraint-no-validate' : 'rails-add-check-constraint');
			if (t.isNew) return { ...base, risk: 'low', locks, explanation: 'The table is created earlier in this file, so the scan covers no existing rows.', steps: [] };
			const later = { deploy: 2 as const, concurrent: false, ruby: `validate_check_constraint ${T}, name: ${name}` };
			if (validateOff) {
				return {
					...base,
					risk: 'medium',
					locks,
					explanation: 'Adds the CHECK as NOT VALID. ACCESS EXCLUSIVE is taken briefly, and existing rows are not scanned. Validate in a later deploy, where the check takes SHARE UPDATE EXCLUSIVE.',
					steps: [later],
				};
			}
			return {
				...base,
				risk: 'high',
				locks,
				explanation: 'Takes ACCESS EXCLUSIVE and scans every row to check the expression. Reads and writes wait for the scan. Add it with validate: false, then validate separately.',
				steps: [{ deploy: 1, concurrent: false, ruby: `add_check_constraint ${allArgs(c, T)}, validate: false` }, later],
			};
		}

		case 'validate_check_constraint':
			return {
				...base,
				risk: 'low',
				locks: locksFor('rails-validate-check-constraint'),
				explanation: 'Checks existing rows under SHARE UPDATE EXCLUSIVE. Reads and writes continue.',
				steps: [],
			};

		case 'remove_column': {
			const col = t.args[0] ?? ':column';
			const risk: Risk = t.isNew ? 'low' : 'medium';
			return {
				...base,
				risk,
				locks: locksFor('rails-remove-column'),
				explanation:
					'Dropping the column is a catalog change under a brief ACCESS EXCLUSIVE lock. The real risk is running code: during a deploy, old app servers still read the column and fail. Stop the app from reading it first (ignored_columns in the model), deploy, then drop it.',
				steps: t.isNew
					? []
					: [
							{ deploy: 1, concurrent: false, ruby: `# In the model, deploy first: self.ignored_columns += ["${bare(col)}"]` },
							{ deploy: 2, concurrent: false, ruby: `remove_column ${T}, ${col}` },
						],
			};
		}

		case 'rename_column': {
			const oldCol = t.args[0] ?? ':old';
			const newCol = t.args[1] ?? ':new';
			return {
				...base,
				risk: 'high',
				locks: locksFor('rails-rename-column'),
				explanation:
					'The rename takes ACCESS EXCLUSIVE briefly, but the risk is the app. Servers still running the old code query the old name and start failing as soon as the migration commits. Add the new column, write to both, switch reads, then drop the old one.',
				steps: [
					{ deploy: 1, concurrent: false, ruby: `add_column ${T}, ${newCol}, :your_type # same type as ${bare(oldCol)}; the app writes both columns` },
					{ deploy: 2, concurrent: false, ruby: `# Backfill ${bare(newCol)} from ${bare(oldCol)} in batches, then switch reads to ${bare(newCol)}` },
					{ deploy: 3, concurrent: false, ruby: `remove_column ${T}, ${oldCol}` },
				],
			};
		}

		case 'rename_table': {
			const newName = t.args[0] ?? ':new_name';
			return {
				...base,
				risk: 'high',
				locks: locksFor('rename-table'),
				explanation:
					'Renaming a table takes ACCESS EXCLUSIVE and breaks every running server that still uses the old name. Create the new table, write to both during the deploy, switch reads, then drop the old table in a later deploy.',
				steps: [
					{ deploy: 1, concurrent: false, ruby: `# create ${bare(newName)} with the same columns; the app writes to both tables` },
					{ deploy: 3, concurrent: false, ruby: `drop_table ${T}` },
				],
			};
		}

		case 'add_reference':
		case 'add_belongs_to':
			return referenceDraft(c, t, ctx, base, T);

		case 'execute': {
			const first = c.positional[0];
			const quoted = first !== undefined && /^["']/.test(first.raw.trim());
			const sql = c.heredoc ?? (quoted ? unquote(first.raw) : null);
			if (sql === null) {
				return {
					...base,
					risk: 'medium',
					locks: [],
					sql: flat(first?.raw ?? ''),
					lockNote: 'not analyzed',
					explanation: 'The SQL is built at run time, so this tool cannot read it. Look up the statement it runs in the lock mode lookup before you deploy.',
					steps: [],
				};
			}
			const head = flat(sql).split(' ').slice(0, 3).join(' ');
			const concurrent = /CONCURRENTLY/i.test(sql);
			return {
				...base,
				risk: 'medium',
				locks: [],
				sql,
				lockNote: 'not analyzed',
				explanation:
					`Raw SQL is not analyzed. It starts with “${head}”. Find the statement in the lock mode lookup and check which lock it takes and on which table.` +
					(concurrent ? ' CONCURRENTLY needs disable_ddl_transaction! on the class too.' : ''),
				steps: [],
			};
		}

		case 'change_table':
			return {
				...base,
				risk: 'medium',
				locks: [],
				lockNote: 'see the lines inside',
				explanation:
					'Every statement inside this block runs against an existing table, and each takes its own lock. The block is not analyzed as one unit, so review each line it contains. Lines inside it are listed separately.',
				steps: [],
			};

		case 'create_table':
			return {
				...base,
				risk: 'info',
				locks: [],
				explanation: 'Creates a new table. No existing table is locked, and nothing uses the new table until the migration commits. Foreign keys inside it are listed on their own lines.',
				steps: [],
			};

		default:
			return null;
	}
}

function allArgs(c: ScannedCall, T: string): string {
	return c.receiver ? [T, ...c.args.map((a) => a.raw)].map(flat).join(', ') : c.args.map((a) => flat(a.raw)).join(', ');
}

function notNullSteps(tableName: string, T: string, col: string, type: string | null, existing = false): Step[] {
	const plain = bare(col);
	const name = `${tableName}_${plain}_not_null`;
	const addSteps: Step[] = [];
	if (!existing && type !== null) addSteps.push({ deploy: 1, concurrent: false, ruby: `add_column ${T}, ${col}, ${type} # nullable for now` });
	addSteps.push({ deploy: 1, concurrent: false, ruby: `add_check_constraint ${T}, "${plain} IS NOT NULL", name: "${name}", validate: false` });
	return [
		...addSteps,
		{ deploy: 2, concurrent: false, ruby: `# Backfill NULLs in batches before this step, then:` },
		{ deploy: 2, concurrent: false, ruby: `validate_check_constraint ${T}, name: "${name}"` },
		{ deploy: 2, concurrent: false, ruby: `change_column_null ${T}, ${col}, false` },
		{ deploy: 3, concurrent: false, ruby: `remove_check_constraint ${T}, name: "${name}"` },
	];
}

function referenceDraft(c: ScannedCall, t: Target, ctx: Ctx, base: { line: number; method: string; section: string }, T: string): Draft | null {
	const ref = t.args[0] ?? ':reference';
	const refName = bare(ref);
	const indexRaw = c.options.get('index');
	const fkRaw = c.options.get('foreign_key');
	const hasIndex = indexRaw === undefined || literalOf(indexRaw) !== 'false';
	const indexConcurrent = indexRaw !== undefined && isConcurrentValue(hashOptions(indexRaw).get('algorithm'));
	const hasFk = fkRaw !== undefined && literalOf(fkRaw) !== 'false';
	const fkValidateOff = fkRaw !== undefined && hashOptions(fkRaw).get('validate') === 'false';
	const toTable = (fkRaw !== undefined && hashOptions(fkRaw).get('to_table')) || `${refName}s`;

	if (t.isNew) {
		if (!hasFk) return null;
		return {
			...base,
			risk: 'low',
			locks: locksFor('rails-add-foreign-key').filter((l) => l.object === 'referenced table'),
			explanation: 'The table is created in this migration. The foreign key takes SHARE ROW EXCLUSIVE on the referenced table briefly, and the new table has no rows to validate.',
			steps: [],
		};
	}

	const locks: LockRef[] = [...locksFor('rails-add-reference')];
	if (hasIndex) locks.push(...(indexConcurrent ? locksFor('rails-add-index-concurrently') : locksFor('rails-add-index')));
	if (hasFk) locks.push(...locksFor(fkValidateOff ? 'rails-add-foreign-key-no-validate' : 'rails-add-foreign-key'));
	const merged = mergeLocks(locks);

	const risk: Risk =
		(hasIndex && !indexConcurrent) || (hasFk && !fkValidateOff) || (indexConcurrent && !ctx.disablesDdl)
			? 'high'
			: hasFk
				? 'medium'
				: 'low';

	const steps: Step[] = [{ deploy: 1, concurrent: false, ruby: `add_reference ${T}, ${ref}, index: false, foreign_key: false # keep type: and null: if you use them` }];
	if (hasIndex) {
		steps.push({ deploy: 1, concurrent: true, ruby: `add_index ${T}, :${refName}_id, algorithm: :concurrently` });
	}
	if (hasFk) {
		steps.push({ deploy: 2, concurrent: false, ruby: `add_foreign_key ${T}, :${toTable}, column: :${refName}_id, validate: false` });
		steps.push({ deploy: 3, concurrent: false, ruby: `validate_foreign_key ${T}, :${toTable}, column: :${refName}_id` });
	}

	const reasons: string[] = ['add_reference adds the column under ACCESS EXCLUSIVE.'];
	if (hasIndex) {
		reasons.push(
			indexConcurrent
				? 'The index is built concurrently, which needs disable_ddl_transaction! in the class.'
				: 'The default index is a plain CREATE INDEX that takes SHARE and blocks writes for the build.',
		);
	}
	if (hasFk) {
		reasons.push(
			fkValidateOff
				? 'The foreign key is added NOT VALID, so existing rows are not scanned now.'
				: 'The foreign key takes SHARE ROW EXCLUSIVE on both tables and scans existing rows.',
		);
	}
	const split = steps.length > 1;
	return {
		...base,
		risk,
		locks: merged,
		explanation: split
			? `${reasons.join(' ')} Split it: add the column with index: false and foreign_key: false, build the index concurrently, then add and validate the foreign key.`
			: reasons.join(' '),
		steps: split ? steps : [],
	};
}

function isConcurrentValue(v: string | undefined): boolean {
	return v !== undefined && /^(:concurrently|["']concurrently["'])$/.test(v.trim());
}

// --- Report ---------------------------------------------------------------------------------

function buildSafeSet(findings: Finding[]): string {
	const seen = new Set<string>();
	const steps = findings.flatMap((f) =>
		f.steps
			.filter((s) => {
				const key = `${s.deploy}|${s.concurrent}|${s.ruby}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.map((s) => ({ ...s, line: f.line, method: f.method })),
	);
	if (!steps.length) return '';
	const blocks: string[] = [
		'# Suggested split. Run each class as its own migration, in deploy order.',
		'# Check each statement against your data first. Comment-only lines are work for a script or the app.',
	];
	for (const deploy of [1, 2, 3] as const) {
		const plain = steps.filter((s) => s.deploy === deploy && !s.concurrent);
		const conc = steps.filter((s) => s.deploy === deploy && s.concurrent);
		if (plain.length) blocks.push(migrationClass(`SafeMigrationDeploy${deploy}`, '', plain));
		if (conc.length) blocks.push(migrationClass(`SafeMigrationDeploy${deploy}Concurrent`, '  disable_ddl_transaction!\n\n', conc));
	}
	return blocks.join('\n\n');
}

function migrationClass(name: string, header: string, steps: Array<Step & { line: number; method: string }>): string {
	const body = steps.map((s) => `    # from line ${s.line} (${s.method})\n${s.ruby.split('\n').map((l) => `    ${l}`).join('\n')}`).join('\n');
	return `class ${name} < ActiveRecord::Migration[${RAILS}]\n${header}  def change\n${body}\n  end\nend`;
}

function plainPlurals(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function analyzeMigration(text: string): Result<MigrationReport> {
	const size = checkSize(text, MAX_MIGRATION_BYTES, 'migration', 'Migration');
	if (!size.ok) return failure([size.error]);
	if (!text.trim()) return failure([{ field: 'migration', message: 'Paste a migration first.' }]);

	const scan = scanMigration(text);
	if (!scan.calls.length) {
		return failure([
			{ field: 'migration', message: 'No migration methods found. Paste the up, down or change method, or the whole migration file.' },
		]);
	}
	const ctx: Ctx = { disablesDdl: scan.disablesDdlTransaction, created: new Set(scan.createdTables) };
	const findings: Finding[] = [];
	for (const c of scan.calls) {
		const d = analyzeCall(c, ctx);
		if (d) findings.push(finish(d));
	}
	findings.sort((a, b) => a.line - b.line);

	const counts: Record<Risk, number> = { high: 0, medium: 0, low: 0, info: 0 };
	for (const f of findings) counts[f.risk]++;

	const notes: string[] = [];
	const risky = findings.filter((f) => f.risk === 'high' || f.risk === 'medium');
	if (risky.length && !scan.mentionsTimeout) {
		notes.push(
			"No lock_timeout is set in this migration. Without one, a statement waits in the lock queue as long as it takes, and every request on the table waits behind it. Set one at the top of the migration, for example execute \"SET lock_timeout = '3s'\", so the migration fails fast and can be retried.",
		);
	}
	if (!scan.disablesDdlTransaction && findings.filter((f) => f.risk !== 'info').length >= 2) {
		notes.push(
			'Rails runs a migration in one transaction unless disable_ddl_transaction! is set. Locks from earlier lines are held until the transaction commits, so a slow line later in the file also holds the locks of the lines before it.',
		);
	}
	if (scan.disablesDdlTransaction && findings.length > 1) {
		notes.push(
			'disable_ddl_transaction! turns off the transaction for the whole migration. If a later line fails, the earlier lines stay applied. Keep concurrent index work in its own migration.',
		);
	}
	if (findings.some((f) => f.section === 'down')) {
		notes.push('Some calls are inside def down. Rollbacks run them under the same locks, so check them as well.');
	}

	const high = counts.high;
	const medium = counts.medium;
	const verdict: Verdict = high ? 'is-risk' : medium ? 'is-warn' : 'is-ok';
	const verdictText = high
		? `${plainPlurals(high, 'high-risk line')} to change before this runs on a table with traffic.`
		: medium
			? `No high-risk lines. ${plainPlurals(medium, 'line')} to review.`
			: 'No risky lines found by these rules. Still set lock_timeout before a migration on a live table.';

	return success({
		findings,
		counts,
		verdict,
		verdictText,
		notes,
		safeSet: buildSafeSet(findings),
		linesChecked: text.replace(/\s+$/, '').split('\n').length,
	});
}

/** Plain-text version of a report, for the Copy button. */
export function reportToText(report: MigrationReport): string {
	const out: string[] = [`Rails safe migration check: ${report.verdictText}`];
	for (const f of report.findings) {
		out.push('');
		out.push(`line ${f.line}  ${f.method}  ${f.risk}  ${f.lockText}`);
		out.push(f.explanation);
		if (f.sql) out.push(`SQL: ${f.sql}`);
		if (f.saferRewrite) out.push(f.saferRewrite);
	}
	for (const note of report.notes) out.push('', `Note: ${note}`);
	if (report.safeSet) out.push('', report.safeSet);
	return out.join('\n');
}
