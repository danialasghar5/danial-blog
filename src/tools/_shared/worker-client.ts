// Typed request/response wrapper around a Web Worker (TOOLS_ROADMAP.md §10.3).
// - Each run gets an id; stale responses (superseded by a newer run) are ignored.
// - A timeout rejects with WorkerTimeoutError and recycles the worker, so a
//   runaway parse (e.g. a pathological regex) cannot hang the tab.
// - If Workers are unavailable, `fallback` runs the same pure function inline.
//
// Worker side contract (worker.ts):
//   self.onmessage = (e) => { const { id, payload } = e.data;
//     self.postMessage({ id, result: compute(payload) }); }   // or { id, error: string }

export class WorkerTimeoutError extends Error {
	constructor() {
		super('Input too large or too complex to process in time.');
		this.name = 'WorkerTimeoutError';
	}
}
export class SupersededError extends Error {
	constructor() {
		super('Superseded by a newer request.');
		this.name = 'SupersededError';
	}
}

export interface WorkerLike {
	postMessage(message: unknown): void;
	terminate(): void;
	onmessage: ((event: { data: unknown }) => void) | null;
	onerror?: ((event: unknown) => void) | null;
}

export interface WorkerClientOptions<P, R> {
	/** Creates the worker, e.g. () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) */
	create: (() => WorkerLike) | null;
	/** Same computation, run inline when Workers are unavailable. */
	fallback: (payload: P) => R;
	timeoutMs?: number;
}

export function createWorkerClient<P, R>({ create, fallback, timeoutMs = 10_000 }: WorkerClientOptions<P, R>) {
	let worker: WorkerLike | null = null;
	let seq = 0;
	let pending: { id: number; resolve: (r: R) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;

	const spawn = (): WorkerLike | null => {
		if (!create) return null;
		try {
			const w = create();
			w.onmessage = (event) => {
				const data = event.data as { id: number; result?: R; error?: string };
				if (!pending || data.id !== pending.id) return;
				const p = pending;
				pending = null;
				clearTimeout(p.timer);
				if (data.error !== undefined) p.reject(new Error(data.error));
				else p.resolve(data.result as R);
			};
			w.onerror = () => {
				if (!pending) return;
				const p = pending;
				pending = null;
				clearTimeout(p.timer);
				p.reject(new Error('The analysis failed unexpectedly.'));
				recycle();
			};
			return w;
		} catch {
			return null;
		}
	};
	const recycle = () => {
		worker?.terminate();
		worker = null;
	};

	return {
		run(payload: P): Promise<R> {
			if (pending) {
				clearTimeout(pending.timer);
				pending.reject(new SupersededError());
				pending = null;
			}
			worker ??= spawn();
			if (!worker) {
				try {
					return Promise.resolve(fallback(payload));
				} catch (e) {
					return Promise.reject(e instanceof Error ? e : new Error(String(e)));
				}
			}
			const id = ++seq;
			const target = worker;
			return new Promise<R>((resolve, reject) => {
				const timer = setTimeout(() => {
					if (pending?.id !== id) return;
					pending = null;
					recycle();
					reject(new WorkerTimeoutError());
				}, timeoutMs);
				pending = { id, resolve, reject, timer };
				target.postMessage({ id, payload });
			});
		},
		dispose() {
			if (pending) clearTimeout(pending.timer);
			pending = null;
			recycle();
		},
	};
}
