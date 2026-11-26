// The sample loaded by "Load example". A prefixed server log, so the statements,
// the victim and the table all show. Lines are joined explicitly so the tab
// indentation of continuation lines is kept.
export const EXAMPLE_REPORT = [
	'2026-11-20 14:10:02.901 UTC [5521] app_rw@accounts_prod LOG:  process 5521 detected deadlock while waiting for ShareLock on transaction 3340 after 1000.087 ms',
	'2026-11-20 14:10:02.902 UTC [5521] app_rw@accounts_prod ERROR:  deadlock detected',
	'2026-11-20 14:10:02.902 UTC [5521] app_rw@accounts_prod DETAIL:  Process 5521 waits for ShareLock on transaction 3340; blocked by process 5530.',
	'\tProcess 5530 waits for ShareLock on transaction 3338; blocked by process 5521.',
	'\tProcess 5521: UPDATE accounts SET balance = balance - 100 WHERE id = 9',
	'\tProcess 5530: UPDATE accounts SET balance = balance + 100 WHERE id = 3',
	'2026-11-20 14:10:02.902 UTC [5521] app_rw@accounts_prod HINT:  See server log for query details.',
	'2026-11-20 14:10:02.902 UTC [5521] app_rw@accounts_prod CONTEXT:  while updating tuple (0,9) in relation "accounts"',
	'2026-11-20 14:10:02.902 UTC [5521] app_rw@accounts_prod STATEMENT:  UPDATE accounts SET balance = balance - 100 WHERE id = 9',
].join('\n');
