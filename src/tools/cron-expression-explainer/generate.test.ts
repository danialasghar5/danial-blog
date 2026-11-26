import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGenerator, generateYaml, yamlString, type ValidGenerator } from './generate.ts';

const LS = String.fromCharCode(0x2028);
const ESCAPED_LS = '\\u' + '2028'; // the JSON-style escape, built so the source never contains it

const valid = (over: Partial<ValidGenerator> = {}): ValidGenerator => ({
	taskKey: 'nightly_cleanup',
	className: 'CleanupJob',
	queue: 'background',
	args: '[1000]',
	priority: null,
	...over,
});

test('validation accepts a complete, well-formed form', () => {
	const r = validateGenerator({ taskKey: ' nightly_cleanup ', className: 'CleanupJob', queue: 'background', args: '[ 1000 ]' });
	assert.deepEqual(r, {
		ok: true,
		value: { taskKey: 'nightly_cleanup', className: 'CleanupJob', queue: 'background', args: '[1000]', priority: null },
		warnings: [],
	});
});

test('validation: optional fields may be empty', () => {
	const r = validateGenerator({ taskKey: 'a', className: 'A::B', queue: '', args: '' });
	assert.equal(r.ok, true);
	if (r.ok) assert.deepEqual([r.value.queue, r.value.args], [null, null]);
});

test('validation names each bad field', () => {
	const cases: [Parameters<typeof validateGenerator>[0], string][] = [
		[{ taskKey: 'Nightly', className: 'CleanupJob' }, 'key'],
		[{ taskKey: '1st', className: 'CleanupJob' }, 'key'],
		[{ taskKey: 'ok', className: 'cleanup' }, 'cls'],
		[{ taskKey: 'ok', className: 'Bad-Name' }, 'cls'],
		[{ taskKey: 'ok', className: 'CleanupJob', queue: 'Bad-Queue' }, 'queue'],
		[{ taskKey: 'ok', className: 'CleanupJob', args: '{bad' }, 'args'],
		[{ taskKey: 'ok', className: 'CleanupJob', args: '"text"' }, 'args'],
		[{ taskKey: 'ok', className: 'CleanupJob', args: 'null' }, 'args'],
		[{ taskKey: 'ok', className: 'CleanupJob', priority: '-1' }, 'priority'],
		[{ taskKey: 'ok', className: 'CleanupJob', priority: '1000' }, 'priority'],
	];
	for (const [input, field] of cases) {
		const r = validateGenerator(input);
		assert.equal(r.ok, false, JSON.stringify(input));
		if (!r.ok) assert.ok(r.errors.some((e) => e.field === field), `${field} for ${JSON.stringify(input)}`);
	}
});

test('validation keeps every error, not just the first', () => {
	const r = validateGenerator({ taskKey: 'X', className: 'x', queue: 'Q', args: '{', priority: 'high' });
	assert.equal(r.ok, false);
	if (!r.ok) assert.deepEqual(r.errors.map((e) => e.field), ['key', 'cls', 'queue', 'args', 'priority']);
});

test('recurring.yml output matches the Solid Queue format', () => {
	const r = generateYaml(valid(), '0 3 * * *');
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(
			r.value.recurringYml,
			[
				'production:',
				'  nightly_cleanup:',
				'    class: CleanupJob',
				'    queue: background',
				'    args: [1000]',
				'    schedule: "0 3 * * *"',
				'',
			].join('\n'),
		);
	}
});

test('recurring.yml includes priority and omits empty optional keys', () => {
	const r = generateYaml(valid({ queue: null, args: null, priority: 5 }), '*/15 9-17 * * 1-5 America/New_York');
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(
			r.value.recurringYml,
			'production:\n  nightly_cleanup:\n    class: CleanupJob\n    priority: 5\n    schedule: "*/15 9-17 * * 1-5 America/New_York"\n',
		);
	}
});

test('sidekiq-cron output uses the name-keyed cron hash', () => {
	const r = generateYaml(valid({ args: '{"days":30}' }), '@daily');
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(r.value.sidekiqCron, 'nightly_cleanup:\n  cron: "@daily"\n  class: "CleanupJob"\n  queue: "background"\n  args: {"days":30}\n');
	}
});

test('an invalid schedule is rejected with the parser message', () => {
	const r = generateYaml(valid(), '0 25 * * *');
	assert.equal(r.ok, false);
	if (!r.ok) {
		assert.equal(r.errors[0].field, 'schedule');
		assert.equal(r.errors[0].message, 'Field 2 (hour): 25 is out of range 0–23');
	}
});

test('yamlString escapes backslash and quote', () => {
	assert.equal(yamlString('a"b\\c'), '"a\\"b\\\\c"');
	assert.equal(yamlString('0 3 * * *'), '"0 3 * * *"');
});

test('U+2028 and U+2029 never reach the output raw', () => {
	const schedule = '0 3 * * *';
	assert.equal(yamlString('x' + LS + 'y'), `"x${ESCAPED_LS}y"`);
	const r = validateGenerator({ taskKey: 'ok', className: 'CleanupJob', args: `["a${LS}b"]` });
	assert.equal(r.ok, true);
	if (r.ok) {
		const out = generateYaml(r.value, schedule);
		assert.equal(out.ok, true);
		if (out.ok) {
			for (const text of [out.value.recurringYml, out.value.sidekiqCron]) {
				assert.ok(!text.includes(LS), 'raw U+2028 must not appear');
				assert.ok(text.includes(ESCAPED_LS), 'escape must appear');
			}
		}
	}
});

test('nothing is evaluated: code-shaped args stay inert text', () => {
	const r = validateGenerator({ taskKey: 'ok', className: 'CleanupJob', args: '["system(\\"rm -rf /\\")"]' });
	assert.equal(r.ok, true);
	if (r.ok) {
		const out = generateYaml(r.value, '@daily');
		assert.equal(out.ok, true);
		if (out.ok) assert.ok(out.value.recurringYml.includes('args: ["system(\\"rm -rf /\\")"]'));
	}
});
