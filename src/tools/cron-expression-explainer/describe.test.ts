import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCron } from './parse.ts';
import { describe as describeCron, clock } from './describe.ts';

const say = (expr: string): string => {
	const r = parseCron(expr);
	assert.equal(r.ok, true, `${expr} must parse`);
	if (!r.ok) throw new Error(expr);
	return describeCron(r.cron);
};

test('every-minute and every-hour phrasing', () => {
	assert.equal(say('* * * * *'), 'Runs every minute.');
	assert.equal(say('*/5 * * * *'), 'Runs every 5 minutes.');
	assert.equal(say('0 * * * *'), 'Runs every hour, on the hour.');
	assert.equal(say('@hourly'), 'Runs every hour, on the hour.');
});

test('single and listed times of day', () => {
	assert.equal(say('0 3 * * *'), 'Runs at 3:00 AM every day.');
	assert.equal(say('30 16 * * *'), 'Runs at 4:30 PM every day.');
	assert.equal(say('0 16,18 * * *'), 'Runs at 4:00 PM and 6:00 PM every day.');
	assert.equal(say('@midnight'), 'Runs at 12:00 AM every day.');
	assert.equal(say('0 12 * * *'), 'Runs at 12:00 PM every day.');
});

test('day of week phrasing', () => {
	assert.equal(say('0 17 * * 2'), 'Runs at 5:00 PM on Tuesday.');
	assert.equal(say('0 0 * * SAT,SUN'), 'Runs at 12:00 AM on Saturday and Sunday.');
	assert.equal(say('0 9 * * 1-5'), 'Runs at 9:00 AM on Monday to Friday.');
});

test('day of month and the OR rule when both are restricted', () => {
	assert.equal(say('0 0 1 * *'), 'Runs at 12:00 AM on the 1st of the month.');
	assert.equal(say('30 4 1,15 * 5'), 'Runs at 4:30 AM on the 1st and 15th of the month or on Friday.');
	assert.equal(say('0 0 2 * *'), 'Runs at 12:00 AM on the 2nd of the month.');
	assert.equal(say('0 0 11,12,13 * *'), 'Runs at 12:00 AM on the 11th, 12th and 13th of the month.');
});

test('step day-of-month counts as unrestricted and is described as AND', () => {
	assert.equal(say('0 0 */2 * 1'), 'Runs at 12:00 AM every 2 days of the month, from the 1st and on Monday (both must match).');
});

test('month phrasing', () => {
	assert.equal(say('0 12 * JAN,JUL *'), 'Runs at 12:00 PM every day in January and July.');
	assert.equal(say('0 0 * 1-3 *'), 'Runs at 12:00 AM every day from January to March.');
	assert.equal(say('0 0 29 2 *'), 'Runs at 12:00 AM on the 29th of the month in February.');
});

test('minute steps inside an hour range', () => {
	assert.equal(say('*/15 9-17 * * 1-5'), 'Runs every 15 minutes between 9:00 AM and 5:59 PM on Monday to Friday.');
	assert.equal(say('0 9-17 * * 1-5'), 'Runs at minute 0 past each hour, between 9:00 AM and 5:59 PM on Monday to Friday.');
});

test('hour steps and six-field seconds', () => {
	assert.equal(say('0 */3 * * *'), 'Runs at minute 0, every 3 hours.');
	assert.equal(say('*/15 * * * * *'), 'Runs every 15 seconds.');
	assert.equal(say('30 0 9 * * 1-5'), 'Runs at second 30, at 9:00 AM on Monday to Friday.');
});

test('a time zone is named at the end', () => {
	assert.equal(say('0 5 * * * America/New_York'), 'Runs at 5:00 AM every day. Times are in America/New_York.');
});

test('clock labels cover midnight, noon and the 59-minute edge', () => {
	assert.equal(clock(0, 0), '12:00 AM');
	assert.equal(clock(12, 0), '12:00 PM');
	assert.equal(clock(23, 59), '11:59 PM');
	assert.equal(clock(9, 5), '9:05 AM');
});
