// "Recently used" tools (TOOLS_ROADMAP.md §12.7). Stores slugs only — never
// inputs. Every storage access is guarded: private windows and blocked storage
// must not break a page.

export const RECENT_KEY = 'da:tools:recent';
export const RECENT_MAX = 6;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

export function getRecent(storage: StorageLike | null = defaultStorage()): string[] {
	if (!storage) return [];
	try {
		const parsed: unknown = JSON.parse(storage.getItem(RECENT_KEY) ?? '[]');
		return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string' && SLUG.test(s)).slice(0, RECENT_MAX) : [];
	} catch {
		return [];
	}
}

export function pushRecent(slug: string, storage: StorageLike | null = defaultStorage()): string[] {
	if (!SLUG.test(slug)) return getRecent(storage);
	const next = [slug, ...getRecent(storage).filter((s) => s !== slug)].slice(0, RECENT_MAX);
	try {
		storage?.setItem(RECENT_KEY, JSON.stringify(next));
	} catch {
		/* storage full or blocked: recents are a convenience only */
	}
	return next;
}

export function clearRecent(storage: StorageLike | null = defaultStorage()): void {
	try {
		storage?.removeItem(RECENT_KEY);
	} catch {
		/* ignore */
	}
}
