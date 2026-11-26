// Solid Queue config/recurring.yml and sidekiq-cron YAML generators (TOOLS_ROADMAP.md §8.5).
// Pure string building. Nothing is evaluated: args are checked with JSON.parse and
// re-serialised, and every string that reaches the YAML is quoted and escaped.

import { failure, success, type FieldError, type Result } from '../_shared/validate.ts';
import { parseCron } from './parse.ts';

export interface GeneratorFields {
	/** Task key (recurring.yml key, sidekiq-cron name). */
	taskKey: string;
	/** Ruby job class, e.g. CleanupJob or Reports::NightlyJob. */
	className: string;
	/** Optional queue name. */
	queue?: string;
	/** Optional JSON array or object of job arguments. */
	args?: string;
	/** Optional integer priority (recurring.yml only). */
	priority?: string;
}

export interface GeneratedYaml {
	recurringYml: string;
	sidekiqCron: string;
}

const TASK_KEY = /^[a-z][a-z0-9_]*$/;
const CLASS_NAME = /^[A-Z][A-Za-z0-9_]*(::[A-Z][A-Za-z0-9_]*)*$/;
const QUEUE = /^[a-z0-9_]+$/;

const LINE_SEPARATORS = new RegExp(`${String.fromCharCode(0x2028)}|${String.fromCharCode(0x2029)}`, 'g');

/** YAML 1.1 (Psych) treats U+2028/U+2029 as line breaks, so write them as JSON-style escapes. */
const escapeLineSeparators = (text: string): string =>
	text.replace(LINE_SEPARATORS, (c) => `\\u${c.charCodeAt(0).toString(16)}`);

/** A double-quoted YAML scalar: backslash and quote escaped, line separators escaped. */
export function yamlString(text: string): string {
	return `"${escapeLineSeparators(text.replace(/\\/g, '\\\\').replace(/"/g, '\\"'))}"`;
}

export interface ValidGenerator {
	taskKey: string;
	className: string;
	queue: string | null;
	args: string | null;
	priority: number | null;
}

/** Validate the generator form. Returns every problem, each tied to its field. */
export function validateGenerator(raw: GeneratorFields): Result<ValidGenerator> {
	const errors: FieldError[] = [];
	const taskKey = (raw.taskKey ?? '').trim();
	const className = (raw.className ?? '').trim();
	const queue = (raw.queue ?? '').trim();
	const argsText = (raw.args ?? '').trim();
	const priorityText = (raw.priority ?? '').trim();

	if (!TASK_KEY.test(taskKey)) {
		errors.push({ field: 'key', message: 'Task key must start with a lowercase letter, then use only lowercase letters, digits and underscores.' });
	}
	if (!CLASS_NAME.test(className)) {
		errors.push({ field: 'cls', message: 'Job class must be a Ruby constant such as CleanupJob or Reports::NightlyJob.' });
	}
	if (queue !== '' && !QUEUE.test(queue)) {
		errors.push({ field: 'queue', message: 'Queue must use only lowercase letters, digits and underscores.' });
	}

	let args: string | null = null;
	if (argsText !== '') {
		try {
			const parsed: unknown = JSON.parse(argsText);
			if (parsed !== null && typeof parsed === 'object') args = JSON.stringify(parsed);
			else errors.push({ field: 'args', message: 'Arguments must be a JSON array or object, such as [1000] or {"days": 30}.' });
		} catch {
			errors.push({ field: 'args', message: 'Arguments are not valid JSON. Use an array such as [1000] or an object such as {"days": 30}.' });
		}
	}

	let priority: number | null = null;
	if (priorityText !== '') {
		if (/^\d{1,3}$/.test(priorityText)) priority = Number(priorityText);
		else errors.push({ field: 'priority', message: 'Priority must be a whole number from 0 to 999.' });
	}

	if (errors.length) return failure(errors);
	return success({ taskKey, className, queue: queue || null, args, priority });
}

/** Both YAML blocks for a validated task and a schedule expression (cron text, optional zone). */
export function generateYaml(fields: ValidGenerator, schedule: string): Result<GeneratedYaml> {
	const cron = parseCron(schedule);
	if (!cron.ok) {
		return failure([{ field: 'schedule', message: cron.error.message }]);
	}
	const text = schedule.trim();

	const recurring: string[] = ['production:', `  ${fields.taskKey}:`, `    class: ${fields.className}`];
	if (fields.queue) recurring.push(`    queue: ${fields.queue}`);
	if (fields.priority !== null) recurring.push(`    priority: ${fields.priority}`);
	if (fields.args) recurring.push(`    args: ${escapeLineSeparators(fields.args)}`);
	recurring.push(`    schedule: ${yamlString(text)}`);

	const sidekiq: string[] = [`${fields.taskKey}:`, `  cron: ${yamlString(text)}`, `  class: ${yamlString(fields.className)}`];
	if (fields.queue) sidekiq.push(`  queue: ${yamlString(fields.queue)}`);
	if (fields.args) sidekiq.push(`  args: ${escapeLineSeparators(fields.args)}`);

	return success({ recurringYml: `${recurring.join('\n')}\n`, sidekiqCron: `${sidekiq.join('\n')}\n` });
}
