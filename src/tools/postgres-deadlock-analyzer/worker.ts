// Runs the analyzer off the main thread (TOOLS_ROADMAP.md §10.3). The widget
// falls back to the same analyzeReport() inline when Workers are unavailable.
import { analyzeReport } from './analyze.ts';

self.onmessage = (e: MessageEvent<{ id: number; payload: string }>) => {
	const { id, payload } = e.data;
	try {
		self.postMessage({ id, result: analyzeReport(payload) });
	} catch (err) {
		self.postMessage({ id, error: String((err as Error).message) });
	}
};
