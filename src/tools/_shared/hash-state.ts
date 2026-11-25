// Share-link state in the URL #hash only (TOOLS_ROADMAP.md §11.1 item 2, §12.6).
// The hash is never sent to the server. Format: #v=1&key=value&…
// Decoded values are untrusted strings: every tool re-validates them with its
// own field validators before use.

export const HASH_STATE_MAX = 2000;

export type HashValue = string | number | boolean;

/** Encode state as a hash string ("#v=1&…"), or null if it exceeds the size limit. */
export function encodeHashState(state: Record<string, HashValue | undefined>, version = 1): string | null {
	const params = new URLSearchParams();
	params.set('v', String(version));
	for (const key of Object.keys(state).sort()) {
		const value = state[key];
		if (value === undefined || key === 'v') continue;
		params.set(key, String(value));
	}
	const hash = `#${params.toString()}`;
	return hash.length <= HASH_STATE_MAX ? hash : null;
}

/**
 * Decode a location.hash. Returns null when absent, oversized, or of another
 * version; unknown keys are dropped when `allowedKeys` is given.
 */
export function decodeHashState(hash: string, allowedKeys?: readonly string[], version = 1): Record<string, string> | null {
	if (!hash || hash === '#' || hash.length > HASH_STATE_MAX) return null;
	let params: URLSearchParams;
	try {
		params = new URLSearchParams(hash.replace(/^#/, ''));
	} catch {
		return null;
	}
	if (params.get('v') !== String(version)) return null;
	const out: Record<string, string> = {};
	for (const [key, value] of params) {
		if (key === 'v') continue;
		if (allowedKeys && !allowedKeys.includes(key)) continue;
		out[key] = value;
	}
	return out;
}
