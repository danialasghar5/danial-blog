// A lightweight scan of one SQL statement from a log line. It is not a parser:
// it finds the verb, the table names and the row-lock clause, which is all the
// classifier needs. Quotes and schema prefixes are removed from names.

export type StatementKind = 'insert' | 'update' | 'delete' | 'select-lock' | 'select' | 'ddl' | 'advisory' | 'other';

export interface StatementInfo {
	kind: StatementKind;
	/** Table names, unquoted, without schema. In order of appearance, unique. */
	tables: string[];
	/** Column list of an INSERT, unquoted. Empty otherwise. */
	columns: string[];
	/** Row-lock clause of a locking SELECT, e.g. "FOR UPDATE". */
	rowLock: string | null;
	/** DDL verb, e.g. "ALTER TABLE". */
	ddl: string | null;
}

const NAME = String.raw`((?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*))?)`;
const NAME_TOKEN = /"(?:[^"]|"")+"|[A-Za-z_][\w$]*/g;

/** `public."Accounts"` → `Accounts`; `accounts` → `accounts`. */
export function unquoteName(raw: string): string {
	const tokens = raw.match(NAME_TOKEN) ?? [];
	const last = tokens[tokens.length - 1] ?? raw;
	return last.startsWith('"') ? last.slice(1, -1).replace(/""/g, '"') : last;
}

function stripComments(sql: string): string {
	return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim();
}

function allNames(sql: string, re: RegExp): string[] {
	const out: string[] = [];
	for (const m of sql.matchAll(re)) {
		const name = unquoteName(m[1]);
		if (!out.includes(name)) out.push(name);
	}
	return out;
}

// Statement-leading DDL only: a verb in the middle of a statement (e.g. "lock IS NULL") is not DDL.
const DDL_TABLE_PATTERNS: [RegExp, string][] = [
	[new RegExp(String.raw`^\s*ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${NAME}`, 'i'), 'ALTER TABLE'],
	[new RegExp(String.raw`^\s*DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?${NAME}`, 'i'), 'DROP TABLE'],
	[new RegExp(String.raw`^\s*TRUNCATE\s+(?:TABLE\s+)?(?:ONLY\s+)?${NAME}`, 'i'), 'TRUNCATE'],
	[new RegExp(String.raw`^\s*LOCK\s+(?:TABLE\s+)?(?:ONLY\s+)?${NAME}`, 'i'), 'LOCK TABLE'],
	[new RegExp(String.raw`^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w$."]+\s+)?ON\s+(?:ONLY\s+)?${NAME}`, 'i'), 'CREATE INDEX'],
	[new RegExp(String.raw`^\s*CREATE\s+TRIGGER\s+[\w$"]+\s+.*?\bON\s+${NAME}`, 'i'), 'CREATE TRIGGER'],
	[new RegExp(String.raw`^\s*VACUUM\s+(?:FULL\s+)?(?:ANALYZE\s+)?${NAME}`, 'i'), 'VACUUM'],
	[new RegExp(String.raw`^\s*REINDEX\s+(?:TABLE\s+)?${NAME}`, 'i'), 'REINDEX'],
];

export function scanStatement(raw: string): StatementInfo {
	const sql = stripComments(raw);
	const empty = (kind: StatementKind): StatementInfo => ({ kind, tables: [], columns: [], rowLock: null, ddl: null });

	if (/\bpg_(?:try_)?advisory_\w*lock\b/i.test(sql)) return empty('advisory');

	for (const [re, verb] of DDL_TABLE_PATTERNS) {
		const m = re.exec(sql);
		if (m) return { kind: 'ddl', tables: [unquoteName(m[1])], columns: [], rowLock: null, ddl: verb };
	}

	// SELECT first: "SELECT … FOR UPDATE NOWAIT" must not read as an UPDATE.
	if (/^\s*\(?\s*(SELECT|WITH)\b/i.test(sql)) {
		const tables = allNames(sql, new RegExp(String.raw`\b(?:FROM|JOIN)\s+(?:ONLY\s+)?${NAME}`, 'gi'));
		const lock = /\bFOR\s+(NO\s+KEY\s+UPDATE|KEY\s+SHARE|UPDATE|SHARE)\b/i.exec(sql);
		if (lock) return { kind: 'select-lock', tables, columns: [], rowLock: `FOR ${lock[1].toUpperCase().replace(/\s+/g, ' ')}`, ddl: null };
		return { ...empty('select'), tables };
	}

	const insert = new RegExp(String.raw`^\s*INSERT\s+INTO\s+${NAME}(?:\s*\(([^)]*)\))?`, 'i').exec(sql);
	if (insert) {
		const columns = (insert[2] ?? '')
			.split(',')
			.map((c) => unquoteName(c.trim()))
			.filter((c) => c !== '');
		return { kind: 'insert', tables: [unquoteName(insert[1])], columns, rowLock: null, ddl: null };
	}

	const update = new RegExp(String.raw`^\s*UPDATE\s+(?:ONLY\s+)?${NAME}`, 'i').exec(sql);
	if (update) {
		const from = allNames(sql, new RegExp(String.raw`\bFROM\s+(?:ONLY\s+)?${NAME}`, 'gi'));
		return { ...empty('update'), tables: uniqueWith(unquoteName(update[1]), from) };
	}

	const del = new RegExp(String.raw`^\s*DELETE\s+FROM\s+(?:ONLY\s+)?${NAME}`, 'i').exec(sql);
	if (del) return { ...empty('delete'), tables: [unquoteName(del[1])] };

	return empty('other');
}

function uniqueWith(first: string, rest: string[]): string[] {
	return [first, ...rest.filter((t) => t !== first)];
}
