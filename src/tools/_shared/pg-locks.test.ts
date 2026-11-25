import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	LOCK_MODES,
	ROW_LOCK_MODES,
	conflictMatrix,
	conflictingModes,
	isSelfConflicting,
	logNameFromMode,
	modeFromLogName,
	rowLocksConflict,
	tableLocksConflict,
} from './pg-locks.ts';

// TOOLS_ROADMAP.md Appendix A, transcribed independently (X = conflict).
// Columns: AS RS RE SUE S SRE E AE
const APPENDIX_A = [
	'.......X', // ACCESS SHARE
	'......XX', // ROW SHARE
	'....XXXX', // ROW EXCLUSIVE
	'...XXXXX', // SHARE UPDATE EXCLUSIVE
	'..XX.XXX', // SHARE
	'..XXXXXX', // SHARE ROW EXCLUSIVE
	'.XXXXXXX', // EXCLUSIVE
	'XXXXXXXX', // ACCESS EXCLUSIVE
];

test('table-level matrix matches Appendix A exactly', () => {
	const m = conflictMatrix();
	APPENDIX_A.forEach((row, i) => {
		assert.deepEqual(
			m[i],
			[...row].map((c) => c === 'X'),
			`row ${LOCK_MODES[i]}`,
		);
	});
});

test('table-level conflicts are symmetric', () => {
	for (const a of LOCK_MODES) for (const b of LOCK_MODES) assert.equal(tableLocksConflict(a, b), tableLocksConflict(b, a), `${a} vs ${b}`);
});

test('known pairs', () => {
	assert.equal(tableLocksConflict('ACCESS SHARE', 'ROW EXCLUSIVE'), false); // SELECT vs UPDATE
	assert.equal(tableLocksConflict('ROW EXCLUSIVE', 'SHARE'), true); // UPDATE vs CREATE INDEX
	assert.equal(tableLocksConflict('ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE'), false); // UPDATE vs CREATE INDEX CONCURRENTLY
	assert.equal(tableLocksConflict('ACCESS SHARE', 'ACCESS EXCLUSIVE'), true); // SELECT vs ALTER TABLE
	assert.equal(isSelfConflicting('SHARE'), false);
	assert.equal(isSelfConflicting('SHARE UPDATE EXCLUSIVE'), true);
	assert.deepEqual(conflictingModes('ACCESS SHARE'), ['ACCESS EXCLUSIVE']);
});

test('row-level matrix (Table 13.3) is symmetric with known cells', () => {
	for (const a of ROW_LOCK_MODES) for (const b of ROW_LOCK_MODES) assert.equal(rowLocksConflict(a, b), rowLocksConflict(b, a));
	assert.equal(rowLocksConflict('FOR KEY SHARE', 'FOR NO KEY UPDATE'), false); // FK check vs non-key UPDATE
	assert.equal(rowLocksConflict('FOR KEY SHARE', 'FOR UPDATE'), true);
	assert.equal(rowLocksConflict('FOR SHARE', 'FOR SHARE'), false);
	assert.equal(rowLocksConflict('FOR UPDATE', 'FOR KEY SHARE'), true);
});

test('log names round-trip', () => {
	for (const mode of LOCK_MODES) assert.equal(modeFromLogName(logNameFromMode(mode)), mode);
	assert.equal(modeFromLogName('ShareLock'), 'SHARE');
	assert.equal(modeFromLogName('NotALock'), null);
});
