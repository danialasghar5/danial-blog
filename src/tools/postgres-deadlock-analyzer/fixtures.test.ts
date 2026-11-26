// Each fixtures/<name>.log is run through the analyzer and diffed against
// fixtures/<name>.expected.json. The expected files were checked by hand against
// the Postgres 13–17 message formats (deadlock.c, lmgr.c, lock.c, proc.c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDeadlock } from './parse.ts';
import type { ParseOutcome } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'fixtures');

/** The stable projection that the expected files pin down. */
export function summarize(outcome: ParseOutcome) {
	if (!outcome.ok) return { ok: false, message: outcome.message };
	const r = outcome.report;
	return {
		ok: true,
		form: r.form,
		cycle: r.cycle,
		hasQueries: r.hasQueries,
		victim: r.victim,
		victimQuery: r.victimQuery,
		context: r.context && { op: r.context.op, relation: r.context.relation, block: r.context.block, offset: r.context.offset },
		edges: r.edges.map((e) => ({ pid: e.pid, modeName: e.modeName, mode: e.mode, target: { kind: e.target.kind, raw: e.target.raw }, blockedBy: e.blockedBy })),
		processes: r.processes.map((p) => ({ pid: p.pid, query: p.query })),
		warnings: r.warnings,
	};
}

const names = readdirSync(dir)
	.filter((f) => f.endsWith('.log'))
	.map((f) => f.slice(0, -'.log'.length))
	.sort();

test('fixtures: every expected file has a log and the reverse', () => {
	const expected = readdirSync(dir).filter((f) => f.endsWith('.expected.json')).map((f) => f.slice(0, -'.expected.json'.length)).sort();
	assert.deepEqual(expected, names);
});

for (const name of names) {
	test(`fixture ${name}`, () => {
		const input = readFileSync(join(dir, `${name}.log`), 'utf8');
		const want = JSON.parse(readFileSync(join(dir, `${name}.expected.json`), 'utf8')) as unknown;
		assert.deepEqual(summarize(parseDeadlock(input)), want);
	});
}
