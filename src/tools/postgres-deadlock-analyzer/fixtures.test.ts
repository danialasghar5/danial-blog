// Each fixtures/<name>.log is run through the analyzer and diffed against
// fixtures/<name>.expected.json. The expected files were checked by hand against
// the Postgres 13–17 message formats (deadlock.c, lmgr.c, lock.c, proc.c).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDeadlock } from './parse.ts';
import { summarize } from './fixture-summary.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'fixtures');

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
