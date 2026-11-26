// Tokenizer and call locator for Rails migration text (TOOLS_ROADMAP.md §7 #11).
// This is a pattern scanner, not a Ruby parser. It understands strings, symbols,
// hash labels, comments, heredocs, brackets, do…end blocks and def scopes, which is
// enough to find migration calls and read their arguments. Everything else is opaque.
// Pure: no DOM, no network.

export type TokenKind = 'ident' | 'const' | 'keyword' | 'label' | 'symbol' | 'string' | 'number' | 'ivar' | 'punct' | 'nl';

export interface Token {
	kind: TokenKind;
	/** Source text. For labels: the key without the colon. */
	text: string;
	start: number;
	end: number;
	line: number;
	/** Heredoc body, set on the token that opened the heredoc. */
	heredoc?: string;
}

const KEYWORDS: ReadonlySet<string> = new Set([
	'do', 'end', 'def', 'class', 'module', 'begin', 'case', 'if', 'unless', 'while', 'until', 'then', 'else',
	'elsif', 'when', 'in', 'rescue', 'ensure', 'return', 'nil', 'true', 'false', 'self', 'and', 'or', 'not', 'yield',
]);
const OPENERS: ReadonlySet<string> = new Set(['class', 'module', 'begin', 'case']);
const MODIFIER_IF: ReadonlySet<string> = new Set(['if', 'unless', 'while', 'until']);
const PUNCT3 = ['**=', '...', '<=>', '===', '&&=', '||='];
const PUNCT2 = ['->', '=>', '::', '&.', '&&', '||', '**', '==', '!=', '>=', '<=', '+=', '-=', '*=', '/=', '..', '<<', '>>', '=~', '!~'];
const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);
const HEREDOC_START = /^<<([~-]?)(["'`]?)([A-Za-z_][A-Za-z0-9_]*)\2/;

function lineStartsOf(src: string): number[] {
	const starts = [0];
	for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
	return starts;
}

function lineAt(starts: number[], pos: number): number {
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (starts[mid] <= pos) lo = mid;
		else hi = mid - 1;
	}
	return lo + 1;
}

/** Index just past the closing quote of the string that opens at `start`. */
function scanQuoted(src: string, start: number): number {
	const q = src[start];
	let i = start + 1;
	while (i < src.length) {
		const ch = src[i];
		if (ch === '\\') {
			i += 2;
			continue;
		}
		if (ch === q) return i + 1;
		if (q !== "'" && ch === '#' && src[i + 1] === '{') {
			i = skipInterpolation(src, i + 2);
			continue;
		}
		i++;
	}
	return src.length;
}

function skipInterpolation(src: string, start: number): number {
	let depth = 1;
	let i = start;
	while (i < src.length) {
		const ch = src[i];
		if (ch === '"' || ch === "'" || ch === '`') {
			i = scanQuoted(src, i);
			continue;
		}
		if (ch === '{') depth++;
		else if (ch === '}') {
			depth--;
			if (depth === 0) return i + 1;
		}
		i++;
	}
	return src.length;
}

interface PendingHeredoc {
	id: string;
	indent: boolean;
	token: Token;
}

/** Reads the bodies of heredocs opened on the line that just ended. Returns the index after them. */
function readHeredocBodies(src: string, from: number, pending: PendingHeredoc[]): number {
	let i = from;
	for (const p of pending) {
		const lines: string[] = [];
		while (i < src.length) {
			let eol = src.indexOf('\n', i);
			if (eol < 0) eol = src.length;
			const line = src.slice(i, eol).replace(/\r$/, '');
			i = Math.min(eol + 1, src.length);
			if ((p.indent ? line.trim() : line) === p.id) break;
			lines.push(line);
		}
		p.token.heredoc = lines.join('\n');
	}
	pending.length = 0;
	return i;
}

function startsLine(src: string, i: number): boolean {
	return i === 0 || src[i - 1] === '\n';
}

export function tokenize(src: string): Token[] {
	const toks: Token[] = [];
	const starts = lineStartsOf(src);
	const pending: PendingHeredoc[] = [];
	const n = src.length;
	const push = (kind: TokenKind, start: number, end: number, text?: string): Token => {
		const token: Token = { kind, text: text ?? src.slice(start, end), start, end, line: lineAt(starts, start) };
		toks.push(token);
		return token;
	};
	const lastSignificant = (): Token | undefined => {
		for (let k = toks.length - 1; k >= 0; k--) if (toks[k].kind !== 'nl') return toks[k];
		return undefined;
	};
	const endsValue = (t: Token | undefined): boolean =>
		!!t && (['ident', 'const', 'number', 'string', 'symbol', 'ivar'].includes(t.kind) || (t.kind === 'punct' && (t.text === ')' || t.text === ']' || t.text === '}')));

	let i = 0;
	while (i < n) {
		const c = src[i];
		if (c === '\n') {
			push('nl', i, i + 1);
			i++;
			if (pending.length) i = readHeredocBodies(src, i, pending);
			continue;
		}
		if (c === ' ' || c === '\t' || c === '\r') {
			i++;
			continue;
		}
		if (c === '\\' && src[i + 1] === '\n') {
			i += 2;
			continue;
		}
		if (c === '#') {
			while (i < n && src[i] !== '\n') i++;
			continue;
		}
		if (c === '=' && startsLine(src, i) && src.startsWith('=begin', i)) {
			const close = src.indexOf('\n=end', i);
			if (close < 0) break;
			i = close + 5;
			while (i < n && src[i] !== '\n') i++;
			continue;
		}
		if (c === '_' && startsLine(src, i) && src.startsWith('__END__', i)) break;

		if (c === '<' && src[i + 1] === '<') {
			const m = HEREDOC_START.exec(src.slice(i, i + 120));
			const prev = lastSignificant();
			const spaced = i > 0 && src[i - 1] === ' ';
			const isHeredoc = !!m && (m[1] !== '' || !endsValue(prev) || (prev?.kind === 'ident' && spaced));
			if (m && isHeredoc) {
				const token = push('string', i, i + m[0].length);
				pending.push({ id: m[3], indent: m[1] !== '', token });
				i += m[0].length;
				continue;
			}
		}

		if (c === '"' || c === "'" || c === '`') {
			const end = scanQuoted(src, i);
			if (c !== '`' && src[end] === ':' && src[end + 1] !== ':') {
				push('label', i, end + 1, src.slice(i + 1, end - 1));
				i = end + 1;
			} else {
				push('string', i, end);
				i = end;
			}
			continue;
		}

		if (c === ':' && src[i + 1] === '"') {
			const end = scanQuoted(src, i + 1);
			push('symbol', i, end);
			i = end;
			continue;
		}
		if (c === ':' && src[i + 1] !== ':' && /[A-Za-z_]/.test(src[i + 1] ?? '')) {
			let j = i + 1;
			while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
			if ((src[j] === '?' || src[j] === '!') && src[j + 1] !== '=') j++;
			push('symbol', i, j);
			i = j;
			continue;
		}

		if (/[A-Za-z_]/.test(c)) {
			let j = i;
			while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
			if ((src[j] === '?' || src[j] === '!') && src[j + 1] !== '=') j++;
			const word = src.slice(i, j);
			if (src[j] === ':' && src[j + 1] !== ':' && !word.endsWith('?')) {
				push('label', i, j + 1, word);
				i = j + 1;
				continue;
			}
			const kind: TokenKind = KEYWORDS.has(word) ? 'keyword' : /[A-Z]/.test(word[0]) ? 'const' : 'ident';
			push(kind, i, j);
			i = j;
			continue;
		}

		if (c === '@' || c === '$') {
			let j = i + 1;
			while (j < n && /[A-Za-z0-9_@]/.test(src[j])) j++;
			push('ivar', i, j);
			i = j;
			continue;
		}

		if (/[0-9]/.test(c)) {
			let j = i;
			while (j < n && /[0-9_]/.test(src[j])) j++;
			if (src[j] === '.' && /[0-9]/.test(src[j + 1] ?? '')) {
				j++;
				while (j < n && /[0-9_]/.test(src[j])) j++;
			}
			push('number', i, j);
			i = j;
			continue;
		}

		const three = src.slice(i, i + 3);
		const two = src.slice(i, i + 2);
		if (PUNCT3.includes(three)) {
			push('punct', i, i + 3);
			i += 3;
		} else if (PUNCT2.includes(two)) {
			push('punct', i, i + 2);
			i += 2;
		} else {
			push('punct', i, i + 1);
			i++;
		}
	}
	return toks;
}

export interface ArgItem {
	/** Whole item source, including its key for options (`index: true` → `index: true`). */
	raw: string;
	/** Option key for `key: value` and `:key => value`; null for positional arguments. */
	key: string | null;
	/** Value source: the part after the key, or the whole item when positional. */
	value: string;
	/** First token of the item (used to spot heredoc arguments). */
	first: Token;
}

function matchClose(toks: Token[], open: number): number {
	let depth = 0;
	for (let k = open; k < toks.length; k++) {
		const t = toks[k];
		if (t.kind !== 'punct') continue;
		if (OPEN.has(t.text)) depth++;
		else if (CLOSE.has(t.text)) {
			depth--;
			if (depth === 0) return k;
		}
	}
	return -1;
}

function makeItem(src: string, toks: Token[]): ArgItem {
	const first = toks[0];
	const last = toks[toks.length - 1];
	const raw = src.slice(first.start, last.end);
	let key: string | null = null;
	let rest: Token[] = toks;
	if (first.kind === 'label') {
		key = first.text;
		rest = toks.slice(1);
	} else if ((first.kind === 'symbol' || first.kind === 'string') && toks[1]?.kind === 'punct' && toks[1].text === '=>') {
		key = unquote(first.text.replace(/^:/, ''));
		rest = toks.slice(2);
	}
	const value = key === null ? raw : rest.length ? src.slice(rest[0].start, last.end) : '';
	return { raw, key, value, first };
}

/** Splits tokens in [from, to) at top-level commas. Newlines are ignored here. */
function splitItems(src: string, toks: Token[], from: number, to: number): ArgItem[] {
	const items: ArgItem[] = [];
	let cur: Token[] = [];
	let depth = 0;
	const flush = () => {
		if (cur.length) items.push(makeItem(src, cur));
		cur = [];
	};
	for (let k = from; k < to; k++) {
		const t = toks[k];
		if (t.kind === 'nl') continue;
		if (t.kind === 'punct') {
			if (OPEN.has(t.text)) depth++;
			else if (CLOSE.has(t.text)) depth--;
			else if (t.text === ',' && depth === 0) {
				flush();
				continue;
			}
		}
		cur.push(t);
	}
	flush();
	return items;
}

const ARG_STOP_KEYWORDS: ReadonlySet<string> = new Set(['do', 'end', 'then', 'else', 'elsif', 'rescue', 'ensure', 'if', 'unless', 'while', 'until']);

/** Reads the arguments of the call whose name token is at `nameIdx`. */
function readArgs(src: string, toks: Token[], nameIdx: number): { items: ArgItem[]; next: number } {
	const name = toks[nameIdx];
	const j = nameIdx + 1;
	const nxt = toks[j];
	if (nxt && nxt.kind === 'punct' && nxt.text === '(' && nxt.start === name.end) {
		const close = matchClose(toks, j);
		if (close < 0) return { items: [], next: toks.length };
		return { items: splitItems(src, toks, j + 1, close), next: close + 1 };
	}
	let depth = 0;
	let lastSig: Token | null = null;
	let k = j;
	for (; k < toks.length; k++) {
		const t = toks[k];
		if (t.kind === 'nl') {
			const continued = lastSig?.kind === 'punct' && lastSig.text === ',';
			if (depth === 0 && !continued) break;
			continue;
		}
		if (depth === 0) {
			if (t.kind === 'keyword' && ARG_STOP_KEYWORDS.has(t.text)) break;
			if (t.kind === 'punct' && (t.text === ';' || CLOSE.has(t.text))) break;
		}
		if (t.kind === 'punct') {
			if (OPEN.has(t.text)) depth++;
			else if (CLOSE.has(t.text)) depth--;
		}
		lastSig = t;
	}
	return { items: splitItems(src, toks, j, k), next: k };
}

/** Pairs of `key: value` inside a braces literal such as `{ validate: false }`. */
export function hashOptions(raw: string): Map<string, string> {
	const out = new Map<string, string>();
	const toks = tokenize(raw);
	if (!toks.length || toks[0].kind !== 'punct' || toks[0].text !== '{') return out;
	const close = matchClose(toks, 0);
	if (close < 0) return out;
	for (const item of splitItems(raw, toks, 1, close)) if (item.key !== null) out.set(item.key, item.value);
	return out;
}

export function unquote(text: string): string {
	const s = text.trim();
	if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) {
		return s.slice(1, -1).replace(/\\(["'\\])/g, '$1');
	}
	return s;
}

/** Table or column name from a symbol or string literal (`:users`, `"users"`). Null for anything else. */
export function nameOf(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const s = raw.trim();
	const m = /^:"?([A-Za-z_][\w.]*)"?$/.exec(s) ?? /^(["'])([A-Za-z_][\w.]*)\1$/.exec(s);
	return m ? m[m.length - 1] : null;
}

/** Literal true/false/nil text, or null. */
export function literalOf(raw: string | undefined): 'true' | 'false' | null {
	if (raw === 'true' || raw === 'false') return raw;
	return null;
}

export type Section = 'up' | 'down' | 'change' | 'body';

export interface ScannedCall {
	/** Method name as written, e.g. `add_index` or, for block receivers, `references`. */
	name: string;
	/** Block variable for `t.references`; null for a bare call. */
	receiver: string | null;
	/** For receiver calls: the call that opened the block (`create_table`, `change_table`). */
	blockOwner: string | null;
	/** For receiver calls: the first argument of the block's owner call (the table). */
	blockTable: string | null;
	line: number;
	/** Every argument in order, positional and options. */
	args: ArgItem[];
	positional: ArgItem[];
	options: Map<string, string>;
	section: Section;
	hasBlock: boolean;
	/** Heredoc body passed as the first argument, if any. */
	heredoc: string | null;
}

export interface ScanResult {
	calls: ScannedCall[];
	disablesDdlTransaction: boolean;
	mentionsTimeout: boolean;
	createdTables: string[];
}

/** Method calls that the rules look at, as bare calls. */
export const CALL_NAMES: ReadonlySet<string> = new Set([
	'add_index', 'remove_index', 'add_column', 'change_column', 'change_column_null', 'change_column_default',
	'add_foreign_key', 'validate_foreign_key', 'add_check_constraint', 'validate_check_constraint', 'remove_column',
	'rename_column', 'rename_table', 'add_reference', 'add_belongs_to', 'execute', 'change_table', 'create_table',
]);

/** Calls on a block variable (`t.references`) that the rules look at. */
export const RECEIVER_CALLS: ReadonlySet<string> = new Set([
	'references', 'belongs_to', 'index', 'foreign_key', 'column', 'check_constraint', 'remove',
]);

const SECTION_NAMES: ReadonlySet<string> = new Set(['up', 'down', 'change']);

interface Frame {
	kind: 'def' | 'block' | 'other';
	name?: string;
	varName?: string | null;
	callName?: string | null;
	callTable?: string | null;
}

function statementStart(toks: Token[], i: number): boolean {
	const prev = toks[i - 1];
	if (!prev || prev.kind === 'nl') return true;
	if (prev.kind === 'punct') return ['=', '(', ',', '[', '{', '=>', '&&', '||', ';', '!', '?', ':'].includes(prev.text);
	return prev.kind === 'keyword' && ['then', 'else', 'do', 'begin'].includes(prev.text);
}

function blockVarAfter(toks: Token[], doIdx: number): string | null {
	const bar = toks[doIdx + 1];
	const name = toks[doIdx + 2];
	return bar?.kind === 'punct' && bar.text === '|' && name?.kind === 'ident' ? name.text : null;
}

function sectionOf(stack: Frame[]): Section {
	for (let k = stack.length - 1; k >= 0; k--) {
		const f = stack[k];
		if (f.kind === 'def') return f.name && SECTION_NAMES.has(f.name) ? (f.name as Section) : 'body';
	}
	return 'body';
}

function normalizeRaw(raw: string): string {
	return raw.replace(/\s*\n\s*/g, ' ').replace(/,\s*$/, '');
}

export function scanMigration(src: string): ScanResult {
	const toks = tokenize(src);
	const calls: ScannedCall[] = [];
	const createdTables: string[] = [];
	const stack: Frame[] = [];
	const pendingDo = new Map<number, Frame>();
	let disablesDdlTransaction = false;
	let mentionsTimeout = false;

	for (let i = 0; i < toks.length; i++) {
		const t = toks[i];
		if (/(lock|statement)_timeout/i.test(t.text) || (t.heredoc !== undefined && /(lock|statement)_timeout/i.test(t.heredoc))) {
			mentionsTimeout = true;
		}

		if (t.kind === 'keyword') {
			if (t.text === 'def') {
				const isSelf = toks[i + 1]?.text === 'self' && toks[i + 2]?.text === '.';
				const nameTok = isSelf ? toks[i + 3] : toks[i + 1];
				stack.push({ kind: 'def', name: nameTok?.text ?? '' });
			} else if (t.text === 'do') {
				stack.push(pendingDo.get(i) ?? { kind: 'block', varName: blockVarAfter(toks, i), callName: null, callTable: null });
			} else if (t.text === 'end') {
				stack.pop();
			} else if (OPENERS.has(t.text) || (MODIFIER_IF.has(t.text) && statementStart(toks, i))) {
				stack.push({ kind: 'other' });
			}
			continue;
		}

		if (t.kind !== 'ident') continue;
		if (t.text === 'disable_ddl_transaction!') {
			disablesDdlTransaction = true;
			continue;
		}
		const prev = toks[i - 1];
		const next = toks[i + 1];
		if (prev?.kind === 'keyword' && prev.text === 'def') continue;
		if (next?.kind === 'punct' && next.text === '=') continue;

		let receiver: string | null = null;
		let frame: Frame | undefined;
		if (prev?.kind === 'punct' && prev.text === '.') {
			const recv = toks[i - 2];
			if (!recv || recv.kind !== 'ident') continue;
			frame = findBlockFrame(stack, recv.text);
			if (!frame || !RECEIVER_CALLS.has(t.text)) continue;
			receiver = recv.text;
		} else if (!CALL_NAMES.has(t.text)) {
			continue;
		}

		const { items, next: after } = readArgs(src, toks, i);
		const doIdx = toks[after]?.kind === 'keyword' && toks[after].text === 'do' ? after : -1;
		const positional = items.filter((it) => it.key === null);
		const options = new Map<string, string>();
		for (const it of items) if (it.key !== null) options.set(it.key, it.value);
		const last = positional[positional.length - 1];
		if (last && last.first.text === '{' && positional.length > 1) {
			for (const [k, v] of hashOptions(last.raw)) options.set(k, v);
			positional.pop();
		}
		const heredocToken = positional[0]?.first;
		const heredoc = heredocToken?.heredoc ?? null;
		const name = t.text;
		const call: ScannedCall = {
			name,
			receiver,
			blockOwner: frame?.callName ?? null,
			blockTable: frame?.callTable ?? null,
			line: t.line,
			args: items.map((it) => ({ ...it, raw: normalizeRaw(it.raw) })),
			positional: positional.map((it) => ({ ...it, raw: normalizeRaw(it.raw) })),
			options,
			section: sectionOf(stack),
			hasBlock: doIdx >= 0,
			heredoc,
		};
		calls.push(call);
		if (!receiver && name === 'create_table') {
			const table = nameOf(positional[0]?.raw);
			if (table) createdTables.push(table);
		}
		if (doIdx >= 0) {
			pendingDo.set(doIdx, {
				kind: 'block',
				varName: blockVarAfter(toks, doIdx),
				callName: name,
				callTable: positional[0] ? normalizeRaw(positional[0].raw) : null,
			});
		}
	}

	return { calls, disablesDdlTransaction, mentionsTimeout, createdTables };
}

function findBlockFrame(stack: Frame[], varName: string): Frame | undefined {
	for (let k = stack.length - 1; k >= 0; k--) {
		const f = stack[k];
		if (f.kind === 'def') return undefined;
		if (f.kind === 'block' && f.varName === varName) return f;
	}
	return undefined;
}
