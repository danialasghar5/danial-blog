// Tool groups: the category filters, header-menu columns and (gated) group pages
// for the Developer Tools Hub. Single source of truth — TOOLS_ROADMAP.md §5.2.
//
// A group page (/tools/<id>/) is generated only when the group has >= 3 live
// tools AND a non-empty `intro` (zero dead UI; TOOLS_ROADMAP.md §5.3, §12.3).

export const GROUP_IDS = ['jobs', 'postgres', 'rails', 'ai', 'data', 'encoding', 'time', 'code', 'http', 'infra'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

export type MenuColumn = 'Jobs & Queues' | 'Postgres' | 'Rails & AI' | 'Developer utilities';

export interface ToolGroup {
	id: GroupId;
	label: string;
	tier: 'signature' | 'utility';
	menuColumn: MenuColumn;
	order: number;
	/** Original intro paragraphs (plain text) + meta description for the group page.
	 *  Both are required before /tools/<id>/ can be generated. */
	intro?: string[];
	description?: string;
}

export const TOOL_GROUPS: ToolGroup[] = [
	{ id: 'jobs', label: 'Jobs & Queues', tier: 'signature', menuColumn: 'Jobs & Queues', order: 1 },
	{ id: 'postgres', label: 'Postgres & ActiveRecord', tier: 'signature', menuColumn: 'Postgres', order: 2 },
	{ id: 'rails', label: 'Rails Runtime', tier: 'signature', menuColumn: 'Rails & AI', order: 3 },
	{ id: 'ai', label: 'AI Backends', tier: 'signature', menuColumn: 'Rails & AI', order: 4 },
	{ id: 'data', label: 'Data Formats', tier: 'utility', menuColumn: 'Developer utilities', order: 5 },
	{ id: 'encoding', label: 'Encoding & Security', tier: 'utility', menuColumn: 'Developer utilities', order: 6 },
	{ id: 'time', label: 'Time & IDs', tier: 'utility', menuColumn: 'Developer utilities', order: 7 },
	{ id: 'code', label: 'Code & Text', tier: 'utility', menuColumn: 'Developer utilities', order: 8 },
	{ id: 'http', label: 'HTTP & Web', tier: 'utility', menuColumn: 'Developer utilities', order: 9 },
	{ id: 'infra', label: 'Infrastructure', tier: 'utility', menuColumn: 'Developer utilities', order: 10 },
];

export const groupById = (id: GroupId): ToolGroup => {
	const g = TOOL_GROUPS.find((x) => x.id === id);
	if (!g) throw new Error(`Unknown tool group: ${id}`);
	return g;
};

/** Service anchors on /services/ that signature-tool CTAs may point at. */
export const SERVICE_CTAS = {
	'jobs-audit': { label: 'Background Job Reliability Audit', href: '/services/' },
	scaling: { label: 'Sidekiq / Solid Queue Scaling & Tuning', href: '/services/' },
	'postgres-review': { label: 'Postgres Concurrency & Lock Review', href: '/services/' },
} as const;
export type ServiceCtaId = keyof typeof SERVICE_CTAS;

/** Tools that already have a hand-built static page under src/pages/tools/. */
export const STATIC_TOOL_PAGES = ['connection-pool-calculator'] as const;
