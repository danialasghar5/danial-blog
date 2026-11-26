// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { defineConfig, fontProviders } from 'astro/config';
import { readdirSync, readFileSync } from 'node:fs';

// URL path (/blog/<slug>/, /tools/<slug>/) → last-modified date (updatedDate,
// else pubDate), read from MDX frontmatter so the sitemap carries accurate
// <lastmod> values for posts and tools.
const datesFrom = (dir, route) =>
	readdirSync(dir)
		.filter((f) => /\.mdx?$/.test(f))
		.map((f) => {
			const fm = readFileSync(`${dir}/${f}`, 'utf8').split('---')[1] ?? '';
			const date = (key) => fm.match(new RegExp(`^${key}:\\s*["']?([0-9-]+)`, 'm'))?.[1];
			return [`/${route}/${f.replace(/\.mdx?$/, '')}/`, date('updatedDate') ?? date('pubDate')];
		})
		.filter(([, d]) => d);
const pageDates = new Map([...datesFrom('./src/content/blog', 'blog'), ...datesFrom('./src/content/tools', 'tools')]);
// The hand-built calculator page predates the tools collection and is a protected
// URL; leave its sitemap entry exactly as it was (TOOLS_ROADMAP.md rule 12).
pageDates.delete('/tools/connection-pool-calculator/');

// Append a subtle, hoverable "#" anchor to each article heading so readers can
// deep-link a section. rehypeHeadingIds runs first to assign the same
// github-slugger IDs Astro already generates (existing anchors stay identical);
// autolink then links to them.
const autolinkOptions = {
	behavior: 'append',
	properties: { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 },
	content: { type: 'text', value: '#' },
};

// Wrap every rendered Markdown/MDX <table> in a horizontally-scrollable div so a
// wide table scrolls inside its own box on small screens instead of pushing the
// whole page sideways. Styled by .table-scroll in global.css.
function rehypeWrapTables() {
	/** @param {any} tree */
	return (tree) => {
		/** @param {any} node */
		const walk = (node) => {
			if (!node.children) return;
			/** @param {any} child */
			node.children = node.children.map((/** @type {any} */ child) => {
				walk(child);
				if (child.type === 'element' && child.tagName === 'table') {
					return {
						type: 'element',
						tagName: 'div',
						properties: { className: ['table-scroll'] },
						children: [child],
					};
				}
				return child;
			});
		};
		walk(tree);
	};
}

// https://astro.build/config
export default defineConfig({
	site: 'https://danialasghar.com',
	integrations: [
		mdx(),
		sitemap({
			// Accurate <lastmod> for articles helps Google prioritise recrawls.
			serialize(item) {
				const date = pageDates.get(new URL(item.url).pathname);
				return date ? { ...item, lastmod: new Date(date).toISOString() } : item;
			},
		}),
	],
	// Hide the Astro dev toolbar (dev-only UI; never shipped to production anyway).
	devToolbar: { enabled: false },
	// Dual-theme syntax highlighting: light theme by default, dark theme swapped in
	// via [data-theme="dark"] (see global.css .astro-code overrides). The
	// high-contrast GitHub variants keep every token ≥4.5:1 on our code surface
	// (the standard ones drop to 3.2:1 for some colours).
	markdown: {
		rehypePlugins: [rehypeWrapTables, rehypeHeadingIds, [rehypeAutolinkHeadings, autolinkOptions]],
		shikiConfig: {
			themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' },
			wrap: true,
		},
	},
	// Self-hosted at build time (served from our own domain, not Google).
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Bricolage Grotesque',
			cssVariable: '--font-display',
			weights: [400, 500, 600, 700, 800],
			styles: ['normal'],
			subsets: ['latin'],
			fallbacks: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'Charis SIL',
			cssVariable: '--font-serif',
			weights: [400, 700],
			styles: ['normal', 'italic'],
			subsets: ['latin'],
			fallbacks: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'JetBrains Mono',
			cssVariable: '--font-jbmono',
			weights: [400],
			styles: ['normal'],
			subsets: ['latin'],
			fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
		},
	],
});
