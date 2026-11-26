import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, calculate, explain, parseInputs, renderConfig, sanitizeShared, shareState, type PumaInputs, type PumaRaw } from './logic.ts';

// Build raw input from overrides on the defaults (4 cores, 4096 MB, 400 MB/worker, 10 MB/thread,
// 20% headroom, 150 ms, 50% I/O, cluster, no Solid Queue, no target).
const raw = (over: Partial<PumaRaw> = {}): PumaRaw => ({ ...DEFAULTS, ...over });
const ok = (over: Partial<PumaRaw> = {}): PumaInputs => {
	const r = parseInputs(raw(over));
	if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
	return r.value;
};
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);

test('defaults parse cleanly', () => {
	const r = parseInputs(DEFAULTS);
	assert.equal(r.ok, true);
});

test('worked case: 4 cores, 4096 MB, 400 MB/worker, 10 MB/thread, 20% headroom, 150 ms, 50% I/O', () => {
	const i = ok();
	const c = calculate(i);
	assert.equal(c.threads, 2); // ceil(1 / 0.5)
	assert.equal(c.byCpu, 4);
	close(c.usableMB, 3276.8);
	assert.equal(c.perProcessMB, 420);
	assert.equal(c.byMemory, 7); // floor(3276.8 / 420)
	assert.equal(c.processes, 4); // min(4 cores, 7)
	assert.equal(c.memUsedMB, 1680);
	assert.equal(c.memVerdict, 'OK');
	close(c.rpsByThreads, 8 / 0.15); // 4 × 2 / 0.15 = 53.33
	close(c.rpsByCpu, 4 / (0.15 * 0.5)); // 4 / 0.075 = 53.33
	close(c.capacityRps, 160 / 3);
	assert.equal(c.binding, 'both');
	assert.equal(c.poolPerProcess, 2);
	assert.equal(c.dbTotal, 8);
	assert.equal(c.state, 'OK');
	assert.equal(c.cta, false);
});

test('I/O share sets threads: 0% → 1, 20% → 2, 80% → 5, 95% → 16 (ceil 20, clamped)', () => {
	assert.equal(calculate(ok({ io: '0' })).threads, 1);
	assert.equal(calculate(ok({ io: '20' })).threads, 2); // 1 / 0.8 = 1.25
	assert.equal(calculate(ok({ io: '80' })).threads, 5); // exact 5, no float overshoot
	assert.equal(calculate(ok({ io: '95' })).threads, 16); // 20 clamped to 16
	assert.equal(calculate(ok({ io: '90' })).threads, 10);
});

test('memory-bound case: 8 cores, 1024 MB, 300 MB/worker → 2 processes, memory limits', () => {
	const c = calculate(ok({ cores: '8', mem: '1024', perWorker: '300', perThread: '10', headroom: '20', io: '50' }));
	assert.equal(c.threads, 2);
	assert.equal(c.byCpu, 8);
	assert.equal(c.byMemory, 2); // floor(819.2 / 320)
	assert.equal(c.processes, 2);
	assert.equal(c.memUsedMB, 640);
	assert.equal(c.memVerdict, 'OK'); // 640 / 819.2 = 78%
	assert.equal(c.dbTotal, 4);
});

test('Risk: one process does not fit (500 MB worker in 409.6 MB usable)', () => {
	const c = calculate(ok({ cores: '4', mem: '512', perWorker: '500', perThread: '10', headroom: '20' }));
	assert.equal(c.byMemory, 0);
	assert.equal(c.processes, 1); // never below one
	assert.equal(c.memUsedMB, 520);
	assert.equal(c.memVerdict, 'Risk');
	assert.equal(c.state, 'Risk');
	assert.equal(c.cta, true);
});

test('Tight: 4 cores, 2048 MB, 450 MB/worker, 10 MB/thread, 20%, 200 ms, 70% I/O', () => {
	const i = ok({ mem: '2048', perWorker: '450', rt: '200', io: '70' });
	const c = calculate(i);
	assert.equal(c.threads, 4); // ceil(100 / 30) = ceil(3.33)
	close(c.usableMB, 1638.4);
	assert.equal(c.perProcessMB, 490);
	assert.equal(c.byMemory, 3); // floor(3.34)
	assert.equal(c.processes, 3);
	assert.equal(c.memUsedMB, 1470); // 89.7% of usable > 85%
	assert.equal(c.memVerdict, 'Tight');
	assert.equal(c.state, 'Tight');
	assert.equal(c.cta, false);
	close(c.rpsByThreads, 60); // 3 × 4 / 0.2
	close(c.rpsByCpu, 50); // 3 / (0.2 × 0.3)
	close(c.capacityRps, 50);
	assert.equal(c.binding, 'CPU');
	assert.equal(c.dbTotal, 12); // 3 × pool 4
});

test('target covered vs not covered, and workers needed (worked case: 4 cores, 150 ms, 50% I/O)', () => {
	const covered = calculate(ok({ target: '50' }));
	assert.equal(covered.targetCovered, true);
	assert.equal(covered.targetWorkers, 4); // ceil(max(50×0.15/2, 50×0.15×0.5)) = ceil(3.75)
	assert.equal(covered.targetReachable, true);
	assert.equal(covered.targetMemFits, true);
	assert.equal(covered.cta, false);

	const short = calculate(ok({ target: '60' }));
	assert.equal(short.targetCovered, false);
	assert.equal(short.targetWorkers, 5); // ceil(4.5)
	assert.equal(short.targetReachable, false); // needs 5 cores, host has 4
	assert.equal(short.cta, true);
});

test('target that fits memory check: 4 cores, 2048 MB, 70% I/O, 200 ms, target 55', () => {
	const c = calculate(ok({ mem: '2048', perWorker: '450', rt: '200', io: '70', target: '55' }));
	assert.equal(c.targetCovered, false); // capacity 50
	assert.equal(c.targetWorkers, 4); // ceil(max(2.75, 3.3))
	assert.equal(c.targetReachable, true);
	assert.equal(c.targetMemFits, false); // 4 × 490 = 1960 > 1638.4
});

test('single mode: one process, CPU binds (20% I/O, 100 ms)', () => {
	const i = ok({ mode: 'single', rt: '100', io: '20' });
	const c = calculate(i);
	assert.equal(c.threads, 2); // ceil(1.25)
	assert.equal(c.processes, 1);
	close(c.rpsByThreads, 20); // 1 × 2 / 0.1
	close(c.rpsByCpu, 12.5); // 1 / (0.1 × 0.8)
	assert.equal(c.binding, 'CPU');
	const cfg = renderConfig(i, c).puma;
	assert.equal(cfg.includes('workers'), false);
	assert.equal(cfg.includes('preload_app!'), false);
	assert.ok(cfg.includes('threads_count = ENV.fetch("RAILS_MAX_THREADS", 2)'));
});

test('Solid Queue in Puma: pool = threads + sqThreads + 2, per process', () => {
	const c = calculate(ok({ cores: '2', sq: true, sqThreads: '3' }));
	assert.equal(c.threads, 2);
	assert.equal(c.poolPerProcess, 7); // 2 + 3 + 2
	assert.equal(c.processes, 2);
	assert.equal(c.dbTotal, 14);
	const off = calculate(ok({ cores: '2', sq: false, sqThreads: '3' }));
	assert.equal(off.poolPerProcess, 2);
});

test('renderConfig: cluster snippet and database.yml pool line', () => {
	const i = ok();
	const c = calculate(i);
	const out = renderConfig(i, c);
	assert.ok(out.puma.includes('workers ENV.fetch("WEB_CONCURRENCY", 4)'));
	assert.ok(out.puma.includes('threads_count = ENV.fetch("RAILS_MAX_THREADS", 2)'));
	assert.ok(out.puma.includes('threads threads_count, threads_count'));
	assert.ok(out.puma.includes('preload_app!'));
	assert.ok(out.database.includes('  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 2 } %>'));
	assert.deepEqual(out.env, ['WEB_CONCURRENCY=4', 'RAILS_MAX_THREADS=2']);
});

test('invalid inputs give field-level messages', () => {
	const r = parseInputs(raw({ cores: '0', io: '96', mode: 'threaded', target: '-1' }));
	assert.equal(r.ok, false);
	if (r.ok) return;
	const msg = Object.fromEntries(r.errors.map((e) => [e.field, e.message]));
	assert.equal(msg.cores, 'CPU cores must be a whole number from 1 to 256.');
	assert.equal(msg.io, 'Time waiting on I/O (%) must be a number from 0 to 95.');
	assert.equal(msg.mode, 'Mode must be one of: cluster, single.');
	assert.equal(msg.target, 'Target requests/s must be greater than 0.');
});

test('Solid Queue threads are ignored (not validated) when the box is off', () => {
	assert.equal(parseInputs(raw({ sq: false, sqThreads: 'x' })).ok, true);
	assert.equal(parseInputs(raw({ sq: true, sqThreads: 'x' })).ok, false);
});

test('sanitizeShared keeps only valid values; share state round-trips', () => {
	const s = sanitizeShared({ cores: 'abc', io: '30', mode: 'x', sq: 'maybe', rt: '150' });
	assert.deepEqual(s, { io: '30', rt: '150' });
	const i = ok({ target: '40', io: '30' });
	const back = sanitizeShared(Object.fromEntries(Object.entries(shareState(i)).map(([k, v]) => [k, String(v)])));
	assert.equal(back.io, '30');
	assert.equal(back.target, '40');
	assert.equal(back.mode, 'cluster');
});

test('explain() sentences are plain and mention the binding limit', () => {
	const i = ok({ mode: 'single', rt: '100', io: '20' });
	const sentences = explain(i, calculate(i));
	assert.ok(sentences.some((s) => s.includes('limited by CPU')));
	assert.ok(sentences.some((s) => s.includes('Single mode')));
});

test('grid of inputs: no NaN, Infinity or undefined anywhere', () => {
	let n = 0;
	for (const cores of ['1', '4', '256'])
		for (const mem of ['128', '4096', '1048576'])
			for (const perWorker of ['50', '400', '16384'])
				for (const perThread of ['0', '10', '1024'])
					for (const headroom of ['0', '20', '50'])
						for (const rt of ['1', '150', '60000'])
							for (const io of ['0', '50', '95'])
								for (const mode of ['cluster', 'single'])
									for (const sq of [false, true])
										for (const target of ['', '1', '1000000']) {
											const i = ok({ cores, mem, perWorker, perThread, headroom, rt, io, mode, sq, target, sqThreads: '64' });
											const c = calculate(i);
											const values: unknown[] = [
												c.threads, c.processes, c.byCpu, c.byMemory, c.usableMB, c.perProcessMB, c.memUsedMB, c.memRatio,
												c.rpsByThreads, c.rpsByCpu, c.capacityRps, c.poolPerProcess, c.dbTotal,
											];
											if (i.target !== undefined) values.push(c.targetWorkers, c.targetCovered, c.targetReachable, c.targetMemFits);
											for (const v of values) {
												assert.notEqual(v, undefined);
												if (typeof v === 'number') assert.ok(Number.isFinite(v) && v >= 0, `bad ${String(v)} for ${JSON.stringify(i)}`);
											}
											assert.ok(c.threads >= 1 && c.threads <= 16);
											assert.ok(c.processes >= 1);
											const out = renderConfig(i, c);
											assert.ok(!/NaN|Infinity|undefined/.test(out.puma + out.database));
											n++;
										}
	assert.equal(n, 3 * 3 * 3 * 3 * 3 * 3 * 3 * 2 * 2 * 3);
});
