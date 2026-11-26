// Puma workers × threads model. Pure functions only (no DOM, no Date).
//
// Model (stated on the page):
//  - Ruby's GVL lets one process run Ruby on at most one core at a time. A cluster
//    worker is a separate process, so processes can use cores in parallel; threads
//    inside a process mostly help while a thread waits on I/O.
//  - Threads per process: enough that, on average, one core stays busy while the
//    other threads wait on I/O: ceil(1 / (1 − f)), where f is the I/O share of a
//    request. Clamped to 1–16.
//  - Processes: one per core, but no more than memory allows:
//    floor(usable / (perWorker + threads × perThread)), where usable = memory × (1 − headroom).
//  - Capacity (requests/s) = min(processes × threads / R, min(processes, cores) / (R × (1 − f)))
//    with R the average request time in seconds. The first term is thread-bound, the
//    second is CPU-bound.
//  - DB connections: each process holds a pool of at least its thread count (plus
//    Solid Queue's threads + 2 when Solid Queue runs inside Puma).

import { collect, parseChoice, parseNumberField, type FieldResult, type Result } from '../_shared/validate.ts';

export const RAILS_DEFAULT_THREADS = 3;
export const MAX_THREADS = 16;
export const TIGHT_RATIO = 0.85;

export type PumaMode = 'cluster' | 'single';
export type Verdict = 'OK' | 'Tight' | 'Risk';
export type Binding = 'threads' | 'CPU' | 'both';

/** Raw text (or flags) from the widget or a share link, before validation. */
export type PumaRaw = {
	cores: string;
	mem: string;
	perWorker: string;
	perThread: string;
	headroom: string;
	rt: string;
	io: string;
	mode: string;
	sq: boolean;
	sqThreads: string;
	target: string;
};

/** Validated inputs. `sqThreads` is 0 when Solid Queue is off. */
export type PumaInputs = {
	cores: number;
	mem: number;
	perWorker: number;
	perThread: number;
	headroom: number;
	rt: number;
	io: number;
	mode: PumaMode;
	sq: boolean;
	sqThreads: number;
	target: number | undefined;
};

export const DEFAULTS: PumaRaw = {
	cores: '4',
	mem: '4096',
	perWorker: '400',
	perThread: '10',
	headroom: '20',
	rt: '150',
	io: '50',
	mode: 'cluster',
	sq: false,
	sqThreads: '3',
	target: '',
};

/** Keys a share link may carry (TOOLS_ROADMAP.md §12.6). */
export const SHARE_KEYS = ['cores', 'mem', 'perWorker', 'perThread', 'headroom', 'rt', 'io', 'mode', 'sq', 'sqThreads', 'target'] as const;

const MODES = ['cluster', 'single'] as const;

export function parseInputs(raw: PumaRaw): Result<PumaInputs> {
	const sqThreads: FieldResult<number> = raw.sq
		? parseNumberField(raw.sqThreads, { field: 'sqThreads', label: 'Solid Queue threads', min: 1, max: 64, integer: true }) as FieldResult<number>
		: { ok: true, value: 0 };
	const target = parseNumberField(raw.target, { field: 'target', label: 'Target requests/s', minExclusive: 0, max: 1000000, optional: true });
	return collect<PumaInputs>({
		cores: parseNumberField(raw.cores, { field: 'cores', label: 'CPU cores', min: 1, max: 256, integer: true }) as FieldResult<number>,
		mem: parseNumberField(raw.mem, { field: 'mem', label: 'Memory available to the app (MB)', min: 128, max: 1048576 }) as FieldResult<number>,
		perWorker: parseNumberField(raw.perWorker, { field: 'perWorker', label: 'Memory per worker process (MB)', min: 50, max: 16384 }) as FieldResult<number>,
		perThread: parseNumberField(raw.perThread, { field: 'perThread', label: 'Extra memory per thread (MB)', min: 0, max: 1024 }) as FieldResult<number>,
		headroom: parseNumberField(raw.headroom, { field: 'headroom', label: 'Headroom (%)', min: 0, max: 50 }) as FieldResult<number>,
		rt: parseNumberField(raw.rt, { field: 'rt', label: 'Average request time (ms)', min: 1, max: 60000 }) as FieldResult<number>,
		io: parseNumberField(raw.io, { field: 'io', label: 'Time waiting on I/O (%)', min: 0, max: 95 }) as FieldResult<number>,
		mode: parseChoice(raw.mode, MODES, 'mode', 'Mode') as FieldResult<PumaMode>,
		sq: { ok: true, value: raw.sq },
		sqThreads,
		target: target as FieldResult<number | undefined>,
	});
}

/** Keep only the share-link values that validate; everything else falls back to the default. */
export function sanitizeShared(state: Record<string, string>): Partial<PumaRaw> {
	const out: Record<string, string | boolean> = {};
	for (const key of ['cores', 'mem', 'perWorker', 'perThread', 'headroom', 'rt', 'io', 'sqThreads', 'target'] as const) {
		const v = state[key];
		// Validate each value alone, with the other fields at their defaults; keep it only if it passes.
		if (v !== undefined && parseInputs({ ...DEFAULTS, sq: true, [key]: v }).ok) out[key] = v;
	}
	if (state.mode !== undefined && (MODES as readonly string[]).includes(state.mode)) out.mode = state.mode;
	if (state.sq === 'true' || state.sq === 'false') out.sq = state.sq === 'true';
	return out as Partial<PumaRaw>;
}

/** Values for the share link. sqThreads is written as the default when Solid Queue is off (it is hidden then). */
export function shareState(i: PumaInputs): Record<string, string | number | boolean> {
	const s: Record<string, string | number | boolean> = {
		cores: i.cores,
		mem: i.mem,
		perWorker: i.perWorker,
		perThread: i.perThread,
		headroom: i.headroom,
		rt: i.rt,
		io: i.io,
		mode: i.mode,
		sq: i.sq,
		sqThreads: i.sq ? i.sqThreads : Number(DEFAULTS.sqThreads),
	};
	if (i.target !== undefined) s.target = i.target;
	return s;
}

export interface PumaCalc {
	threads: number;
	threadsIdeal: number;
	processes: number;
	byCpu: number;
	byMemory: number;
	usableMB: number;
	perProcessMB: number;
	memUsedMB: number;
	memRatio: number;
	memVerdict: Verdict;
	rpsByThreads: number;
	rpsByCpu: number;
	capacityRps: number;
	binding: Binding;
	targetCovered: boolean | undefined;
	targetWorkers: number | undefined;
	targetReachable: boolean | undefined;
	targetMemFits: boolean | undefined;
	poolPerProcess: number;
	dbTotal: number;
	state: Verdict;
	cta: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** ceil that forgives float noise (e.g. 5.000000000000001 → 5). */
const up = (x: number) => Math.ceil(x - 1e-9);
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b), 1);

export function calculate(i: PumaInputs): PumaCalc {
	const f = i.io / 100;
	const threadsIdeal = up(100 / (100 - i.io));
	const threads = clamp(threadsIdeal, 1, MAX_THREADS);

	const usableMB = (i.mem * (100 - i.headroom)) / 100;
	const perProcessMB = i.perWorker + threads * i.perThread;
	const byCpu = i.mode === 'cluster' ? i.cores : 1;
	const byMemory = Math.floor(usableMB / perProcessMB);
	const processes = i.mode === 'cluster' ? Math.max(1, Math.min(byCpu, byMemory)) : 1;

	const memUsedMB = processes * perProcessMB;
	const memRatio = memUsedMB / usableMB;
	const memVerdict: Verdict = memUsedMB > usableMB ? 'Risk' : memUsedMB > TIGHT_RATIO * usableMB ? 'Tight' : 'OK';

	const R = i.rt / 1000;
	const rpsByThreads = (processes * threads) / R;
	const rpsByCpu = Math.min(processes, i.cores) / (R * (1 - f));
	const capacityRps = Math.min(rpsByThreads, rpsByCpu);
	const binding: Binding = close(rpsByThreads, rpsByCpu) ? 'both' : rpsByThreads < rpsByCpu ? 'threads' : 'CPU';

	let targetCovered: boolean | undefined;
	let targetWorkers: number | undefined;
	let targetReachable: boolean | undefined;
	let targetMemFits: boolean | undefined;
	if (i.target !== undefined) {
		targetCovered = capacityRps * (1 + 1e-9) >= i.target;
		// Workers needed at the recommended threads: thread-bound and CPU-bound limits, whichever is higher.
		const needThreads = (i.target * R) / threads;
		const needCpu = i.target * R * (1 - f);
		targetWorkers = Math.max(1, up(Math.max(needThreads, needCpu)));
		targetReachable = targetWorkers <= i.cores;
		targetMemFits = targetWorkers * perProcessMB <= usableMB;
	}

	const poolPerProcess = threads + (i.sq ? i.sqThreads + 2 : 0);
	const dbTotal = processes * poolPerProcess;

	const cta = memVerdict === 'Risk' || targetCovered === false;
	const state: Verdict = cta ? 'Risk' : memVerdict === 'Tight' ? 'Tight' : 'OK';

	return {
		threads,
		threadsIdeal,
		processes,
		byCpu,
		byMemory,
		usableMB,
		perProcessMB,
		memUsedMB,
		memRatio,
		memVerdict,
		rpsByThreads,
		rpsByCpu,
		capacityRps,
		binding,
		targetCovered,
		targetWorkers,
		targetReachable,
		targetMemFits,
		poolPerProcess,
		dbTotal,
		state,
		cta,
	};
}

const n0 = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 0 });
const n1 = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 1 });

/** Plain-language reasons, one sentence each. */
export function explain(i: PumaInputs, c: PumaCalc): string[] {
	const out: string[] = [];
	out.push(
		`Each request spends ${i.io}% of its time waiting on I/O, so about ${c.threadsIdeal} thread${c.threadsIdeal === 1 ? '' : 's'} per process keep one core busy.`,
	);
	if (i.mode === 'single') {
		out.push('Single mode runs one process, so one core runs Ruby at a time (GVL) no matter how many cores the host has.');
	} else if (c.byMemory < c.byCpu) {
		out.push(`Memory is the limit: ${n0(c.usableMB)} MB usable fits ${c.byMemory} process${c.byMemory === 1 ? '' : 'es'}, below ${c.byCpu} cores.`);
	} else {
		out.push(`CPU is the limit: one process per core (${c.byCpu}), and memory allows ${c.byMemory}.`);
	}
	if (c.memVerdict === 'Risk') {
		out.push(`Even one process needs ${n0(c.perProcessMB)} MB, more than the ${n0(c.usableMB)} MB usable after headroom.`);
	}
	const limit = c.binding === 'both' ? 'threads and CPU both' : c.binding === 'threads' ? 'threads' : 'CPU';
	out.push(`Capacity is ${n1(c.capacityRps)} requests/s, limited by ${limit}.`);
	if (i.target !== undefined && c.targetWorkers !== undefined) {
		if (c.targetCovered) out.push(`The ${n0(i.target)} requests/s target is covered.`);
		else if (!c.targetReachable) out.push(`${n0(i.target)} requests/s needs ${c.targetWorkers} cores; this host has ${i.cores}.`);
		else if (!c.targetMemFits) out.push(`${n0(i.target)} requests/s needs ${c.targetWorkers} processes, which memory does not fit.`);
		else out.push(`${n0(i.target)} requests/s needs ${c.targetWorkers} processes at this thread count.`);
	}
	return out;
}

/** config/puma.rb and config/database.yml snippets for a calculation. */
export function renderConfig(i: PumaInputs, c: PumaCalc): { puma: string; database: string; env: string[] } {
	const cluster = i.mode === 'cluster';
	const lines = ['# config/puma.rb'];
	if (cluster) lines.push(`workers ENV.fetch("WEB_CONCURRENCY", ${c.processes})`);
	lines.push(`threads_count = ENV.fetch("RAILS_MAX_THREADS", ${c.threads})`);
	lines.push('threads threads_count, threads_count');
	if (cluster) lines.push('preload_app!');
	if (i.sq) lines.push('plugin :solid_queue if SOLID_QUEUE_IN_PUMA');

	const extra = i.sq ? ` + ${i.sqThreads + 2}` : '';
	const db = [
		'# config/database.yml',
		'production:',
		`  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { ${c.threads} }${extra} %>`,
	];
	if (i.sq) db.push(`  # Solid Queue in Puma: ${i.sqThreads} worker threads + 2 for polling and heartbeats.`);

	const env = [];
	if (cluster) env.push(`WEB_CONCURRENCY=${c.processes}`);
	env.push(`RAILS_MAX_THREADS=${c.threads}`);
	if (i.sq) env.push('SOLID_QUEUE_IN_PUMA=true');

	return { puma: lines.join('\n'), database: db.join('\n'), env };
}
