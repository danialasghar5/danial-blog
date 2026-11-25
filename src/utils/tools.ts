// Tool registry helpers shared by /tools/, /tools/[slug]/ and (later) the
// header menu and topic hubs. Only `status: live` entries are ever surfaced.
import { existsSync } from 'node:fs';
import { getCollection, type CollectionEntry } from 'astro:content';
import { GROUP_IDS, STATIC_TOOL_PAGES, TOOL_GROUPS, type ToolGroup } from '../data/tool-groups';

export type Tool = CollectionEntry<'tools'>;

export const toolHref = (slug: string): string => `/tools/${slug}/`;

/** featured first, then `order`, then title (TOOLS_ROADMAP.md §12.2). */
export const sortTools = (a: Tool, b: Tool): number =>
	Number(b.data.featured) - Number(a.data.featured) || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title);

export async function liveTools(): Promise<Tool[]> {
	return (await getCollection('tools', (t) => t.data.status === 'live')).sort(sortTools);
}

const MIN_GROUP_TOOLS = 3;

/** Groups that get a /tools/<id>/ page: ≥3 live tools. Throws if one lacks its intro (zero dead UI). */
export function groupsWithPages(live: Tool[]): ToolGroup[] {
	return TOOL_GROUPS.filter((g) => live.filter((t) => t.data.group === g.id).length >= MIN_GROUP_TOOLS).map((g) => {
		if (!g.intro?.length || !g.description) {
			throw new Error(`Tool group "${g.id}" has ${MIN_GROUP_TOOLS}+ live tools but no intro/description in src/data/tool-groups.ts — write them before going live.`);
		}
		return g;
	});
}

/**
 * Build-time registry checks (TOOLS_ROADMAP.md §9.4). Collected and thrown
 * together so one build run reports every problem.
 */
export async function assertRegistry(): Promise<void> {
	const all = await getCollection('tools');
	const live = new Set(all.filter((t) => t.data.status === 'live').map((t) => t.id));
	const posts = new Set((await getCollection('blog', (p) => !p.data.draft)).map((p) => p.id));
	const errors: string[] = [];
	for (const t of all) {
		if ((GROUP_IDS as readonly string[]).includes(t.id)) errors.push(`tool slug "${t.id}" collides with a group id`);
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.id)) errors.push(`tool slug "${t.id}" must be kebab-case`);
		if (t.data.status !== 'live') continue;
		const isStatic = (STATIC_TOOL_PAGES as readonly string[]).includes(t.id);
		if (!isStatic && !existsSync(`src/tools/${t.id}/Widget.astro`)) errors.push(`${t.id}: live, but src/tools/${t.id}/Widget.astro is missing`);
		for (const n of t.data.nextTools) if (!live.has(n.id)) errors.push(`${t.id}: nextTools → "${n.id}" is not live`);
		for (const p of t.data.relatedPosts) if (!posts.has(p.id)) errors.push(`${t.id}: relatedPosts → "${p.id}" is not a published post`);
		if (t.data.tier === 'signature' && !t.data.serviceCta) errors.push(`${t.id}: signature tools need a serviceCta`);
	}
	if (errors.length) throw new Error(`Tool registry errors:\n  - ${errors.join('\n  - ')}`);
}
